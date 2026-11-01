# Instructions for AI Assistants

## Python Environment
Always use the virtual environment when running Python commands or tests in this repository.
Before running python commands, activate the virtual environment or run:
```bash
source prepare_context.sh
```
Or execute Python directly with:
```bash
PYTHONPATH=. .python_venv/bin/python ...
```
The venv is located at `.python_venv/` in the workspace root.

## Pull Requests
Always verify whether the current Pull Request has already been merged before exporting/pushing changes or assuming it is active. If the PR has already been merged, branch off `origin/main` (or rebase/create a new branch) and create a new PR.

## Strict Data Integrity & Verification Policy
**NEVER GUESS, EXTRAPOLATE, OR SYNTHESIZE DATA** when verifying songs, lyrics, chords, or metadata.
- **Authoritative Sources Required**: Every chord, lyric, author, composer, and metadata attribute MUST be backed by a verified, high-confidence source (official recording, published sheet music, authoritative songbooks/databases like Biblioteka Polskiej Piosenki, Śpiewnik Wywroty, Discogs, etc.).
- **No Deduced / Hallucinated Chords**: NEVER deduce or invent chord progressions based on poetic meter, rhyme scheme, or musical tropes (e.g. "typical ballad progression in a-moll").
- **Handling Unknown / Missing Chords**: If no authoritative chords or recordings can be found:
  - Do NOT invent or add chords.
  - Leave the song chordless (or keep existing chords unchanged).
  - Clearly document in `<to_do>` or `<comment>` that the chords/melody are unknown and could not be verified from public sources.
  - Do NOT mark `<chords>` under `<status><done>`.
- **Honest Source Attribution & No Fabricated Names**:
  - Every new `<verificator>` entry MUST point to a genuine, verified URL or authoritative physical reference that was actually consulted.
  - **NEVER create, guess, or invent names of people or contributors** (e.g. NEVER extrapolate usernames like `ptab` into imaginary people like „Piotr Tabernacki”).
  - New verificators must be authoritative URLs. Historical named verificators already present in files (`Onufry`, `Kuba`, `Adam`, `Michał Korch`, etc.) must be preserved, but never invent new person names.
  - **Zero tolerance for hallucinated URLs** (e.g. never invent domains or links).
- **Comment vs To-Do Rules (Editorial vs Reader Comments)**:
  - `<comment>` is strictly for the reader's/singer's attention: supplementary historical background, origins, performance notes, or cultural context.
  - Do NOT repeat content in `<comment>` that is already captured by other explicit fields (`text_author`, `composer`, `artist`, `title`).
  - Editorial comments (internal contributor notes, remarks on difficulty deciphering chords, explanations of why chords/lyrics weren't placed, editor struggles) MUST go into `<to_do>`, NEVER into `<comment>`.
- **Preserve Pseudonyms (ps.)**:
  - When an author or composer is widely known by a pseudonym (e.g. scout or insurgent songs like `Mirosław Jezierski (ps. „Karnisz”)`, `Jan Markowski (ps. „Krzysztof”)`, `Bogusław Adamek (ps. „Bodzio”)`), KEEP the pseudonym in the author tag.
- **Preserve Authentic Folklore & Dialect**:
  - Do not alter or "correct" authentic scout folklore, slang, or intentional archaic/dialect rhymes even if they deviate from standard grammar or spelling.
- **Chord Placement, Timing & Spacing**:
  - Distinguish chord timing relative to vocals: when an accompaniment chord is struck on the beat before or between vocal syllables, preserve appropriate spacing (e.g. `<ch a="F"/> Na rusztach...` vs ` <ch a="F"/>Na...`). Do not mechanically strip leading/trailing spaces around `<ch/>` tags.
- **Instrumental Chords & `sidechords`**:
  - Never put transition/turnaround chords into lyric punctuation (e.g. avoid `wioskach.<ch a="G"/>`) and never place multi-chord groupings in a single chord tag (e.g. `<ch a="(d E a G)"/>` is invalid).
  - Use the `sidechords="..."` attribute on `<row>` (e.g. `<row important_over="false" sidechords="d E a G">...`) or introduce an explicit instrumental line: `<row important_over="false" style="instr"><ch a="G"/></row>`.
- **Schema Constraints for `<alias>` and Composers**:
  - In `_site/song.xsd`, only a single optional `<alias>` is supported (`maxOccurs="1"`). There is NO `<aliases>` element.
  - In `<composer>`, only text is supported; multiple composers should be joined with a comma.
- **Repetitions & Outros**:
  - Always verify whether a chorus is actually repeated at the end before adding duplicated `<blocklink>` elements. Outro fade-outs or single-line repetitions should not be conflated with full-chorus bisy.
