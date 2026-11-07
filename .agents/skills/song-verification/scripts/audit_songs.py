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


def effective_stats(root):
    """Return (effective_inline_chord_count, effective_nonempty_lyric_row_count)."""
    lyric = root.find("s:lyric", NS)
    if lyric is None:
        return 0, 0
    real_blocks = [b for b in lyric if b.tag == f"{{{NS_URI}}}block"]

    def block_counts(b):
        ch_c = 0
        row_c = 0
        for child in b:
            if child.tag == f"{{{NS_URI}}}row":
                ch_c += len(child.findall("s:ch", NS))
                if child.attrib.get("style") != "instr" and "".join(child.itertext()).strip():
                    row_c += 1
            elif child.tag == f"{{{NS_URI}}}bis":
                try:
                    times = int(child.attrib.get("times", "2"))
                except ValueError:
                    times = 2
                sub_ch = 0
                sub_row = 0
                for r in child.findall("s:row", NS):
                    sub_ch += len(r.findall("s:ch", NS))
                    if r.attrib.get("style") != "instr" and "".join(r.itertext()).strip():
                        sub_row += 1
                ch_c += sub_ch * times
                row_c += sub_row * times
        return ch_c, row_c

    total_ch = 0
    total_rows = 0
    for child in lyric:
        if child.tag == f"{{{NS_URI}}}block":
            c, r = block_counts(child)
            total_ch += c
            total_rows += r
        elif child.tag == f"{{{NS_URI}}}blocklink":
            try:
                nb = int(child.attrib.get("blocknb", "1")) - 1
            except ValueError:
                nb = -1
            if 0 <= nb < len(real_blocks):
                c, r = block_counts(real_blocks[nb])
                total_ch += c
                total_rows += r
    return total_ch, total_rows


def check_regression_against_base(path, root, base_ref="origin/main"):
    """Compare current XML root against base_ref:path to detect information loss."""
    issues = []
    warnings = []
    rel_path = os.path.relpath(path)
    res = subprocess.run(
        ["git", "show", f"{base_ref}:{rel_path}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if res.returncode != 0 or not res.stdout.strip():
        return issues, warnings

    try:
        base_root = ET.fromstring(res.stdout)
    except Exception:
        return issues, warnings

    # 1. Check barre & metre attributes on <music> or <guitar>
    base_barre = ""
    curr_barre = ""
    for elem_name in ("s:guitar", "s:music"):
        b_el = base_root.find(f".//{elem_name}", NS)
        c_el = root.find(f".//{elem_name}", NS)
        if b_el is not None and (b_el.get("barre") or "").strip() not in ("", "0"):
            base_barre = b_el.get("barre").strip()
        if c_el is not None and (c_el.get("barre") or "").strip() not in ("", "0"):
            curr_barre = c_el.get("barre").strip()
    if base_barre and not curr_barre:
        issues.append(f"LOST_BARRE: base had barre='{base_barre}', current has '{curr_barre or '0'}'")

    base_metre = ""
    curr_metre = ""
    b_mus = base_root.find(".//s:music", NS)
    c_mus = root.find(".//s:music", NS)
    if b_mus is not None and (b_mus.get("metre") or "").strip():
        base_metre = b_mus.get("metre").strip()
    if c_mus is not None and (c_mus.get("metre") or "").strip():
        curr_metre = c_mus.get("metre").strip()
    if base_metre and not curr_metre:
        issues.append(f"LOST_METRE: base had metre='{base_metre}', current removed it")

    # 2. Check metadata fields
    for tag in ("alias", "album", "original_title", "translator", "text_author", "composer", "artist"):
        b_val = text_or_empty(base_root, f"s:{tag}")
        c_val = text_or_empty(root, f"s:{tag}")
        if b_val and not c_val:
            warnings.append(f"LOST_METADATA: <{tag}> had '{b_val}' in base, now empty")

    # 3. Check comment loss / truncation
    b_comment = text_or_empty(base_root, "s:comment")
    c_comment = text_or_empty(root, "s:comment")
    c_todo = text_or_empty(root, ".//s:to_do")
    if b_comment and not c_comment and b_comment not in c_todo:
        warnings.append(f"DELETED_COMMENT: base had <comment> '{b_comment[:80]}', now empty")
    elif b_comment and c_comment and len(c_comment) < len(b_comment) * 0.75:
        warnings.append(
            f"SHORTENED_COMMENT: <comment> length dropped from {len(b_comment)} to {len(c_comment)} chars"
        )

    # 4. Check verificators (lost historical verificators or newly added non-URL names)
    b_verifs = [
        (v.text or "").strip()
        for v in base_root.findall(".//s:verificator", NS)
        if (v.text or "").strip()
    ]
    c_verifs = [
        (v.text or "").strip()
        for v in root.findall(".//s:verificator", NS)
        if (v.text or "").strip()
    ]
    lost_verifs = [v for v in b_verifs if v not in c_verifs]
    if lost_verifs:
        issues.append(f"LOST_VERIFICATOR: removed historical verificator(s) {lost_verifs}")

    added_verifs = [v for v in c_verifs if v not in b_verifs]
    non_url_added = [v for v in added_verifs if not v.startswith(("http://", "https://"))]
    if non_url_added:
        issues.append(
            f"NON_URL_VERIFICATOR: newly added <verificator> must be a verified URL, found: {non_url_added}"
        )

    # 5. Check effective chords and lyric rows
    b_ch, b_rows = effective_stats(base_root)
    c_ch, c_rows = effective_stats(root)
    if b_rows > 0 and c_rows < b_rows:
        warnings.append(
            f"FEWER_EFFECTIVE_ROWS: non-empty effective lyric rows dropped from {b_rows} to {c_rows} ({c_rows - b_rows:+d})"
        )
    if b_ch > 0 and c_ch < b_ch - 2:
        warnings.append(
            f"FEWER_EFFECTIVE_CHORDS: effective inline chords dropped from {b_ch} to {c_ch} ({c_ch - b_ch:+d})"
        )

    return issues, warnings


def analyze_song(path, check_diff=False):
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
    sidechord_issues = []
    sidechord_warnings = []
    has_important_true = False

    for idx, r in enumerate(rows, 1):
        row_chs = r.findall("s:ch", NS)
        row_ch_names = [(c.get("a") or "").strip() for c in row_chs]
        sc_attr = (r.get("sidechords") or "").strip()
        sc_tokens = sc_attr.split() if sc_attr else []
        imp = r.get("important_over")

        if imp == "true":
            has_important_true = True

        # Audit sidechords and important_over interactions
        if sc_attr:
            if not row_chs:
                if imp != "never":
                    sidechord_issues.append(
                        f"row {idx}: has sidechords='{sc_attr}' without inline <ch>, but important_over='{imp}' (must be 'never')"
                    )
            else:
                if imp == "never":
                    sidechord_issues.append(
                        f"row {idx}: has inline <ch> tags but important_over='never' (must be 'true' or 'false')"
                    )

                if sc_tokens == row_ch_names:
                    sidechord_warnings.append(
                        f"row {idx}: redundant sidechords='{sc_attr}' matches inline chords; converters automatically generate side chords"
                    )
                else:
                    clean_sc = [t.strip("()[],.") for t in sc_tokens]
                    missing_from_side = [c for c in row_ch_names if c not in clean_sc]
                    if missing_from_side:
                        sidechord_issues.append(
                            f"row {idx}: sidechords='{sc_attr}' overrides side column but omits inline chord(s) {missing_from_side}; sidechords must be a superset of inline chords"
                        )

                    extra_side = [t for t in clean_sc if t not in row_ch_names]
                    if extra_side and imp in ("true", "false"):
                        sidechord_issues.append(
                            f"row {idx}: inline <ch> is missing chord(s) {extra_side} present in sidechords='{sc_attr}'; place chords inline over syllables or in an explicit instrumental line"
                        )
        else:
            if not row_chs:
                if imp != "never":
                    important_over_mismatches += 1
            elif imp == "never":
                sidechord_issues.append(
                    f"row {idx}: has inline <ch> tags but important_over='never' (must be 'true' or 'false')"
                )

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
    if sidechord_issues:
        issues.extend(sidechord_issues)
    if sidechord_warnings:
        warnings.extend(sidechord_warnings)
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

    if check_diff:
        diff_issues, diff_warnings = check_regression_against_base(path, root)
        issues.extend(diff_issues)
        warnings.extend(diff_warnings)

    # Determine Priority Tier (1 = highest urgency, 5 = lowest urgency)
    if no_chords:
        tier = 1
    elif only_sidechords or bad_chords or english_minors:
        tier = 2
    elif to_do or important_over_mismatches > 0 or (has_chords and not has_important_true) or sidechord_issues:
        tier = 3
    elif missing_meta or missing_done or sidechord_warnings:
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
    info = analyze_song(path, check_diff=True)
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

    return xmllint.returncode == 0 and tex_proc.returncode == 0 and len(info["issues"]) == 0


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

