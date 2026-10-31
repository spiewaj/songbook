#!/usr/bin/env python3
"""
Audit and validate song XML files for the song-verification skill.
"""

import argparse
import glob
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

NS_URI = "http://21wdh.staszic.waw.pl"
NS = {"s": NS_URI}

# Regex for valid Polish chord notation:
# Root: C, D, E, F, G, A, H, B, Cis, Dis, Eis, Fis, Gis, Ais, His, Ces, Des, Es, Fes, Ges, As, Bes (case-insensitive)
# Modifiers: m (rarely used if lowercase, but sometimes maj7), maj, dim, aug, sus, add, numbers, +, -, /, *, ()
ENGLISH_MINOR_RE = re.compile(r"^[A-G](#|b|is|es)?m(?!aj)[0-9a-z/+()-]*$")
VALID_CHORD_RE = re.compile(
    r"^\(?([A-Ha-h](is|es|s|#)?)(maj|min|dim|aug|sus|add|m|[0-9+*/\-^()])*"
    r"(/([A-Ha-h](is|es|s|#)?))?\)?$"
)


def text_or_empty(elem, path):
    val = elem.findtext(path, "", NS)
    return (val or "").strip()


def analyze_song(path):
    issues = []
    warnings = []
    try:
        tree = ET.parse(path)
        root = tree.getroot()
    except Exception as e:
        return {
            "path": path,
            "title": "<PARSE ERROR>",
            "tier": 1,
            "issues": [f"XML parse error: {e}"],
            "warnings": [],
        }

    title = (root.get("title") or "").strip()
    if not title:
        issues.append("Missing title attribute on <song>")

    text_author = text_or_empty(root, "s:text_author")
    composer = text_or_empty(root, "s:composer")
    artist = text_or_empty(root, "s:artist")
    genre = text_or_empty(root, "s:genre")
    comment = text_or_empty(root, "s:comment")
    to_do = text_or_empty(root, ".//s:to_do")
    verificators = [
        (v.text or "").strip()
        for v in root.findall(".//s:verificator", NS)
        if (v.text or "").strip()
    ]

    done_elem = root.find(".//s:done", NS)
    done_tags = set()
    done_chords_val = ""
    if done_elem is not None:
        for child in done_elem:
            tag_name = child.tag.split("}")[-1]
            done_tags.add(tag_name)
            if tag_name == "chords":
                done_chords_val = (child.text or "").strip()

    rows = root.findall(".//s:row", NS)
    ch_elems = root.findall(".//s:ch", NS)
    sidechord_rows = [r for r in rows if (r.get("sidechords") or "").strip()]

    # Check chords
    has_chords = len(ch_elems) > 0
    only_sidechords = (not has_chords) and (len(sidechord_rows) > 0)
    intentionally_chordless = (
        "chords" in done_tags
        and any(kw in comment.lower() for kw in ("glissando", "legato", "a cappella"))
    )
    no_chords = (not has_chords) and (len(sidechord_rows) == 0) and (not intentionally_chordless)

    if no_chords:
        issues.append("No chords (<ch> or sidechords)")
    elif only_sidechords:
        issues.append("Only sidechords present (missing inline <ch> positioning)")

    # Inspect individual chords and rows
    bad_chords = []
    english_minors = []
    important_over_mismatches = 0
    has_important_true = False

    for idx, r in enumerate(rows, 1):
        row_chs = r.findall("s:ch", NS)
        imp = r.get("important_over")
        if imp == "true":
            has_important_true = True

        if not row_chs and not (r.get("sidechords") or "").strip():
            if imp != "never":
                important_over_mismatches += 1
        elif row_chs and imp == "never" and not (r.get("sidechords") or "").strip():
            important_over_mismatches += 1

        for c in row_chs:
            a = (c.get("a") or "").strip()
            if not a:
                bad_chords.append(f"row {idx}: empty <ch/>")
            elif ENGLISH_MINOR_RE.match(a):
                english_minors.append(f"row {idx}: '{a}' (use Polish lowercase minor)")
            elif not VALID_CHORD_RE.match(a):
                bad_chords.append(f"row {idx}: suspicious chord '{a}'")

    if has_chords and not has_important_true:
        warnings.append("Has inline <ch> chords but no row has important_over='true'")
    if important_over_mismatches > 0:
        warnings.append(f"{important_over_mismatches} row(s) have non-standard important_over attribute")
    if english_minors:
        issues.append(f"English minor chord notation: {', '.join(english_minors[:5])}")
    if bad_chords:
        issues.append(f"Suspicious <ch> tags: {', '.join(bad_chords[:5])}")

    # Check metadata
    missing_meta = []
    if not text_author:
        missing_meta.append("text_author")
    if not composer:
        missing_meta.append("composer")
    if not artist:
        missing_meta.append("artist")
    if not genre:
        missing_meta.append("genre")

    if missing_meta:
        warnings.append(f"Missing metadata: {', '.join(missing_meta)}")

    missing_done = {"text", "authors", "chords"} - done_tags
    if missing_done:
        warnings.append(f"Incomplete <status><done>: missing {', '.join(sorted(missing_done))}")

    if not verificators:
        warnings.append("Missing <verificator> (add source URLs/references used to confirm correctness)")

    if to_do:
        issues.append(f"<to_do>: {to_do}")

    # Determine Priority Tier (1 = highest urgency, 5 = lowest urgency)
    if no_chords:
        tier = 1
    elif only_sidechords or bad_chords or english_minors:
        tier = 2
    elif to_do or important_over_mismatches > 0 or (has_chords and not has_important_true):
        tier = 3
    elif missing_meta or missing_done:
        tier = 4
    else:
        tier = 5

    return {
        "path": path,
        "title": title,
        "tier": tier,
        "issues": issues,
        "warnings": warnings,
        "missing_meta": missing_meta,
        "missing_done": sorted(missing_done),
        "to_do": to_do,
    }


def check_single_song(path):
    info = analyze_song(path)
    print(f"=== Checking {path} ({info['title']}) [Tier {info['tier']}] ===")

    # 1. xmllint validation
    xsd_path = "./_site/song.xsd" if os.path.exists("./_site/song.xsd") else "./editor-github/song.xsd"
    xmllint = subprocess.run(
        ["xmllint", "--schema", xsd_path, "--noout", path],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    if xmllint.returncode == 0:
        print("  [PASS] XML Schema (song.xsd)")
    else:
        print(f"  [FAIL] XML Schema:\n{xmllint.stdout.strip()}")

    # 2. Structural & Metadata analysis
    if not info["issues"] and not info["warnings"]:
        print("  [PASS] Chords, important_over, and metadata complete")
    else:
        for iss in info["issues"]:
            print(f"  [ISSUE] {iss}")
        for warn in info["warnings"]:
            print(f"  [WARN]  {warn}")

    # 3. LaTeX generation test
    env = os.environ.copy()
    env["PYTHONPATH"] = "."
    python_bin = ".python_venv/bin/python" if os.path.exists(".python_venv/bin/python") else sys.executable
    tex_proc = subprocess.run(
        [python_bin, "src/latex/songs2tex.py", "single", "a4", info["title"] or "Test", path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
    )
    if tex_proc.returncode == 0 and "\\begin{song}" in tex_proc.stdout:
        print("  [PASS] LaTeX generation (songs2tex.py)")
    else:
        print(f"  [FAIL] LaTeX generation:\n{tex_proc.stderr.strip()}")

    return xmllint.returncode == 0 and tex_proc.returncode == 0


def main():
    parser = argparse.ArgumentParser(description="Audit and validate song XML files.")
    parser.add_argument("--summary", action="store_true", help="Print summary of all songs by priority tier")
    parser.add_argument("--next", type=int, metavar="N", help="List the next N songs to verify")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3, 4, 5], help="Filter --next by priority tier")
    parser.add_argument("--dir", type=str, default="songs", help="Directory to scan (default: songs)")
    parser.add_argument("--check", nargs="+", metavar="FILE", help="Run deep validation checks on specific XML file(s)")
    args = parser.parse_args()

    if args.check:
        all_ok = True
        for f in args.check:
            if not check_single_song(f):
                all_ok = False
        sys.exit(0 if all_ok else 1)

    files = sorted(glob.glob(os.path.join(args.dir, "**", "*.xml"), recursive=True))
    results = [analyze_song(f) for f in files]

    if args.summary or not args.next:
        tiers = {1: [], 2: [], 3: [], 4: [], 5: []}
        for r in results:
            tiers[r["tier"]].append(r)
        print(f"Total songs scanned in '{args.dir}': {len(results)}")
        print(f"  Tier 1 (Missing chords completely):               {len(tiers[1]):4d}")
        print(f"  Tier 2 (Sidechords-only or chord tag anomalies):  {len(tiers[2]):4d}")
        print(f"  Tier 3 (Has <to_do> or important_over issues):    {len(tiers[3]):4d}")
        print(f"  Tier 4 (Missing metadata or incomplete <done>):   {len(tiers[4]):4d}")
        print(f"  Tier 5 (Metadata & chords present; deep audit):   {len(tiers[5]):4d}")

    if args.next:
        filtered = [r for r in results if (args.tier is None or r["tier"] == args.tier)]
        filtered.sort(key=lambda r: (r["tier"], r["path"]))
        for idx, r in enumerate(filtered[: args.next], 1):
            details = "; ".join(r["issues"] + r["warnings"])
            print(f"{idx:3d}. [Tier {r['tier']}] {r['path']} ({r['title']})")
            if details:
                print(f"       -> {details}")


if __name__ == "__main__":
    main()

