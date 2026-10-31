---
name: song-verification
description: >-
  Deep verification and fixing workflow for song XML files in the songbook repository.
  Use this skill when verifying, auditing, or fixing existing or newly submitted songs
  (lyrics, Polish diacritics, inline guitar chords, important_over attributes, creator metadata,
  and XSD/LaTeX validation), either for a single song, a PR, or batch 1-by-1 verification.
---

# Deep Song Verification Skill

This skill defines the standard operating procedure for deeply verifying and fixing song XML files in `songs/**/*.xml`.

## Critical Rule: Strict Data Integrity & Verification Policy
> [!CAUTION]
> **NEVER GUESS, DEDUCE, OR SYNTHESIZE DATA.**
> - **Zero Tolerance for Hallucinated Chords**: Chords MUST be corroborated by an authoritative, verified source (published songbook, official sheet music, authoritative chords database, or verified acoustic recording). NEVER deduce or hypothesize chord progressions based on poetic meter, rhyme scheme, or "typical ballad progression".
> - **When Chords Cannot Be Verified**: If thorough research reveals NO authoritative chords or recordings:
>   - **DO NOT add chords.**
>   - Leave the lyrics chordless (or keep existing chords unchanged).
>   - Add an explicit note in `<to_do>` stating that chords could not be verified from public or authoritative sources.
>   - Do NOT mark `<chords>` under `<status><done>`.
> - **Authentic Attribution in `<verificator>`**: Every `<verificator>` entry MUST point to a genuine URL or real-world source actually consulted. NEVER invent, fabricate, or assume an unverified source.

## Overview of What "Deep Verification" Covers

Every song (`songs/**/*.xml`) must be verified across **6 dimensions**:

1. **Creator & Song Metadata**:
   - `title` attribute on `<song>` (proper capitalization, no trailing punctuation, canonical title).
   - `<alias>` (optional common alternative title or incipit if different from `title`).
   - `<text_author type="solo|band">` (original lyricist; use `Tradycyjna` only if genuinely traditional).
   - `<composer type="solo|band">` (melody composer, not musical director or cover artist).
   - `<translator>` & `<original_title>` (if the song is a translation/adaptation of a foreign song).
   - `<artist type="solo|band">` (primary performer associated with this version; never put genre names like `Szanty` or `Piosenki Harcerskie` in `<artist>`).
   - `<album>` (original album or soundtrack name when known).
   - `<genre>` (canonical genre used in the songbook, e.g., `Poezja śpiewana`, `Szanty`, `Piosenka turystyczna`, `Piosenka harcerska`, `Rock`, `Pop`, `Folk`, `Kabaret`, `Kolęda`, `Religijna`, `Filmowa`).
   - `<comment>` (preserve external chord/tab source URLs when chords are adapted from an external or foreign-language transcription, capo notes, or performance hints).

2. **Lyrics, Spelling & Typography**:
   - Compare lyrics against authoritative sources (official releases, Wywrota, Poema, Biblioteka Polskiej Piosenki, Discogs).
   - Fix all spelling mistakes, missing Polish diacritics (`ą, ć, ę, ł, ń, ó, ś, ź, ż`), and OCR/transliteration artifacts (e.g., Cyrillic `е` instead of Latin `e`).
   - Check stanza/block division (`<block type="verse|chorus|other">`) and replace duplicated chorus blocks with `<blocklink blocknb="..."/>` where the chorus is identical.
   - Use `<bis times="N">...</bis>` for repeated lines within a block instead of writing `(x2)` in text.

3. **Chords & Musical Notation**:
   - Use **Polish chord notation**:
     - Major chords: uppercase (`C`, `D`, `E`, `F`, `G`, `A`, `H`, `B`, `Fis`, `Cis`, `Gis`, `Dis`, `Es`, `As`). Note: `H` is B-major and `B` is B-flat major (`Bb`)!
     - Minor chords: lowercase (`c`, `d`, `e`, `f`, `g`, `a`, `h`, `b`, `fis`, `cis`, `gis`, `dis`, `es`). Note: `h` is B-minor (`Bm`) and `e` is E-minor (`Em`)!
   - Convert international chord symbols (`Bm` -> `h`, `Em` -> `e`, `Am` -> `a`, `Dm` -> `d`, `F#m` -> `fis`, `C#m` -> `cis`, `Bb` -> `B`, `B` -> `H`) when adapting tabs from English/foreign sources.
   - Ensure chords are placed inline (`<ch a="..."/>`) right before the syllable where the chord change occurs.
   - If a song only has `sidechords="..."` or no chords at all, find an authoritative chord transcription (including searching original foreign versions via Discogs/Ultimate Guitar if it is a translated song) and place inline `<ch a="..."/>` tags.
   - **Preserve `sidechords="..."` formatting**: If a row already has `sidechords="..."` with deliberate formatting (e.g. glued pairs like `DG` or `CC7+` for rapid changes in a measure, parentheses like `(D)` or `(H7)` for passing or optional chords, bar separators `|`), **do not remove `sidechords`**. Inline `<ch a="..."/>` tags and `sidechords` co-exist cleanly; `sidechords` controls the margin layout while `<ch>` controls over-the-word placement. Keep both.
   - Ensure no lyric words or split suffixes (`<ch a="D"/><ch a="is"/>`) are accidentally inside `<ch>` tags.
   - For purely instrumental rows, use `<row important_over="false" style="instr"><ch a="..."/>...</row>`.

4. **`important_over` Attribute Standardization**:
   - `important_over="true"`: Set **only** on the first occurrence of each distinct chord progression/phrase (typically the first verse and the chorus, or the first half of a verse if the second half repeats the exact same progression).
   - `important_over="false"`: Set on subsequent verses or repeating couplets within the same block that follow the already-introduced chord progression, as well as `style="instr"` rows.
   - `important_over="never"`: Set on any `<row>` that has **no `<ch>` tags** (or in pure `sidechords`-only songs).

5. **Verification `<status>` & `<verificators>` Source Attribution & Preservation**:
   - **NEVER REMOVE existing `<verificator>` entries**: They represent an immutable historical record of work done, corrections made, and editorial decisions by previous contributors.
   - **Append only**: Always **append** new verification notes and genuine source references (URLs or physical citations) used to confirm lyrics, chords, or metadata:
     ```xml
     <status>
       <done>
         <text/>
         <authors/>
         <chords>chord positioning</chords>
       </done>
       <verificators>
         <!-- NEVER remove existing verificators; append new verification notes and sources: -->
         <verificator>Original contributor or historical note</verificator>
         <verificator>https://example.com/authoritative-lyrics-source</verificator>
         <verificator>https://example.com/authoritative-chords-source</verificator>
       </verificators>
       <to_do/>
     </status>
     ```
   - Remove or update `<to_do>` once the issue described in `<to_do>` has been resolved. If an ambiguity remains that cannot be resolved from public sources, document it clearly in `<to_do>` or `<comment>`.

6. **Automated Validation & LaTeX Compilation Check**:
   - Always run the validation script on every modified song XML:
     ```bash
     PYTHONPATH=. .python_venv/bin/python .agents/skills/song-verification/scripts/audit_songs.py --check <path/to/song.xml>
     ```
   - This verifies:
     1. XML Schema compliance (`xmllint --schema ./_site/song.xsd --noout`).
     2. Chord notation & `important_over` consistency rules.
     3. LaTeX generation (`src/latex/songs2tex.py`).

---

## Step-by-Step Procedure for Verifying a Single Song

1. **Inspect & Audit the Song**:
   Run:
   ```bash
   PYTHONPATH=. .python_venv/bin/python .agents/skills/song-verification/scripts/audit_songs.py --check songs/path/to/song.xml
   ```
   Read the XML file completely to see current metadata, lyrics, chords, `<comment>`, and `<to_do>`.

2. **Research Authoritative Sources**:
   - Search the web (`search_web`) for the song title + artist + `"tekst"` / `"chwyty"` / `"akordy"` / `"autor"` (e.g. Biblioteka Polskiej Piosenki, Śpiewnik Wywroty, Discogs, Ultimate Guitar).
   - If the song is a Polish adaptation or soundtrack song without Polish chords online:
     - Look up the release on Discogs (`https://api.discogs.com/...` or web search) to find the original composer and international title.
     - Search Ultimate Guitar / Chordify for the original title's chords, map them to the Polish syllables, convert chord names to Polish notation (`Bm` -> `h`, `Em` -> `e`, `Am` -> `a`, `Bb` -> `B`, `B` -> `H`), and save the reference URL in `<comment>`.

3. **Apply Fixes to the XML File**:
   - Update metadata (`<text_author>`, `<composer>`, `<translator>`, `<original_title>`, `<artist>`, `<album>`, `<genre>`, `<comment>`).
   - Fix lyric typos, diacritics, punctuation, `<bis>`, and `<blocklink>`.
   - Add/fix inline `<ch a="..."/>` tags and standardize `important_over` attributes across all rows.
   - Update `<status><done>` and clear resolved `<to_do>` items.

4. **Validate**:
   Re-run:
   ```bash
   PYTHONPATH=. .python_venv/bin/python .agents/skills/song-verification/scripts/audit_songs.py --check songs/path/to/song.xml
   ```
   Ensure zero schema errors, zero chord/attribute warnings, and clean LaTeX output.

---

## Running the 1-by-1 Process (1 Song per PR)

Each verified song is submitted in its own dedicated Pull Request (1 song per PR), branched freshly off `origin/main`:

1. Fetch latest `origin/main` and pick the next song using [audit_songs.py](./scripts/audit_songs.py):
   ```bash
   git fetch origin
   PYTHONPATH=. .python_venv/bin/python .agents/skills/song-verification/scripts/audit_songs.py --next 5
   ```
2. Create a dedicated branch off `origin/main` for that single song:
   ```bash
   git checkout -b fix/song-<song-slug> origin/main
   ```
3. Deeply verify and fix the song following steps 1–4 above, then run `--check`:
   ```bash
   PYTHONPATH=. .python_venv/bin/python .agents/skills/song-verification/scripts/audit_songs.py --check songs/path/to/song.xml
   ```
4. Commit, push, and open a PR for that single song:
   ```bash
   git add songs/path/to/song.xml
   git commit -m "fix(songs): verify and complete <Song Title>"
   git push -u origin fix/song-<song-slug>
   gh pr create --title "fix(songs): verify <Song Title>" --body "..."
   ```

