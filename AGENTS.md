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
- **Honest Source Attribution**: Every `<verificator>` entry MUST point to a genuine URL or verified physical reference that was actually consulted. NEVER invent or assume a source.
