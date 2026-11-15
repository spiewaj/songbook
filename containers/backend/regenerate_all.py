"""Background job to regenerate published songbook artifacts (EPUB, PDF A5/A4) from Firestore."""

import argparse
import glob
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed

from google.cloud import firestore

from containers.backend.main import (
    overlay_branch_data,
    prepare_songbook_image,
    setup_work_dir,
    upload_result,
)


def _find_output(build_dir: str, ext: str) -> str | None:
    files = sorted(glob.glob(os.path.join(build_dir, "**", f"*.{ext}"), recursive=True))
    return files[0] if files else None


def _run_render(work_dir: str, cmd: list[str]) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["PYTHONPATH"] = work_dir
    return subprocess.run(
        cmd,
        cwd=work_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )


def regenerate_songbook(doc_data: dict, formats: list[str], dry_run: bool = False) -> tuple[str, list[str]]:
    """Regenerate requested formats for a single published songbook. Returns (sb_id, errors)."""
    sb_id = doc_data.get("id")
    yaml_content = doc_data.get("yaml")
    branch = doc_data.get("baseRef") or "main"
    errors: list[str] = []

    if not sb_id or not yaml_content:
        return (sb_id or "<unknown>", ["Missing id or yaml"])

    if dry_run:
        print(f"[DRY RUN] Would regenerate {sb_id} (branch={branch}, formats={formats})")
        return (sb_id, [])

    temp_dir = tempfile.mkdtemp(prefix=f"regen_{sb_id}_")
    try:
        work_dir = setup_work_dir(temp_dir)
        overlay_branch_data(branch, work_dir)
        yaml_path = os.path.join(work_dir, "songbooks", "custom.yaml")
        with open(yaml_path, "w", encoding="utf-8") as f:
            f.write(yaml_content)
        prepare_songbook_image(yaml_path, work_dir)

        build_dir = os.path.join(work_dir, "build")
        for fmt in formats:
            shutil.rmtree(build_dir, ignore_errors=True)
            os.makedirs(build_dir, exist_ok=True)
            if fmt == "epub":
                proc = _run_render(work_dir, ["python3", "src/epub/create_epub.py", "songbooks/custom.yaml"])
                out_file = _find_output(build_dir, "epub")
                dest = f"published/{sb_id}/songbook.epub"
                mime = "application/epub+zip"
            elif fmt in ("a5", "a4"):
                proc = _run_render(work_dir, ["bash", "./render_pdf.sh", fmt, "songbooks/custom.yaml"])
                out_file = _find_output(build_dir, "pdf")
                dest = f"published/{sb_id}/{fmt}.pdf"
                mime = "application/pdf"
            else:
                errors.append(f"Unsupported format: {fmt}")
                continue

            if proc.returncode != 0 or not out_file:
                tail = (proc.stdout or "")[-600:]
                errors.append(f"{fmt} failed (rc={proc.returncode}): {tail}")
                continue

            upload_result(out_file, dest, mime)
            print(f"[{sb_id}] Uploaded {dest}")
    except Exception as exc:
        errors.append(f"Exception: {exc}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return (sb_id, errors)


def main() -> int:
    parser = argparse.ArgumentParser(description="Regenerate published songbooks from Firestore.")
    parser.add_argument("--project", default=os.environ.get("FIRESTORE_PROJECT", "wdw-21"))
    parser.add_argument("--formats", default="epub,a5,a4", help="Comma-separated formats: epub,a5,a4")
    parser.add_argument("--only", default=None, help="Optional single songbook ID to regenerate")
    parser.add_argument("--workers", type=int, default=2, help="Parallel worker threads")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    formats = [f.strip().lower() for f in args.formats.split(",") if f.strip()]
    db = firestore.Client(project=args.project)

    if args.only:
        snap = db.collection("songbooks").document(args.only).get()
        docs = [snap.to_dict()] if snap.exists else []
    else:
        docs = [
            d.to_dict()
            for d in db.collection("songbooks").where(
                filter=firestore.FieldFilter("isPublished", "==", True)
            ).stream()
        ]

    print(f"Found {len(docs)} published songbook(s) to regenerate (formats={formats}).")
    failures = 0
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = [pool.submit(regenerate_songbook, doc, formats, args.dry_run) for doc in docs]
        for fut in as_completed(futures):
            sb_id, errs = fut.result()
            if errs:
                failures += 1
                print(f"[{sb_id}] ERRORS: {errs}", file=sys.stderr)

    print(f"Regeneration complete: {len(docs) - failures}/{len(docs)} succeeded.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
