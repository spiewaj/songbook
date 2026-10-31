### Recent generated artifacts:
  Generated artifacts are auto-published (post-commit on) https://spiewaj.com.
  You can also check the latest release: https://github.com/spiewaj/songbook/releases/latest.
# About

This project contains:
 - [songs](./songs) (in XML format)
 - tools to generate PDFs, EPUBs and HTMLs out of this songs
 - [web editor](./editor) to enable easy edits of the songs and [github-integration](./editor-github)
 - [web editor](./editor) to enable easy edits of the songs and [github-integration](./editor-github)
# Songs

Currently the songs are hosted in the [./songs](./songs) directory.
They are mostly Polish scouting, tourist, poetic, and bard songs.
Song definitions are XML files conforming to the schema in [`_site/song.xsd`](./_site/song.xsd).

## Song XML Format & Conventions

### Chords: Inline (`<ch>`) and Side Margins (`sidechords`)
Songbook supports two chord rendering layers that co-exist cleanly:
- **Inline Chords (`<ch a="..."/>`)**: Placed within `<row>` immediately preceding the syllable where the chord change happens. These chords are rendered above the corresponding lyric words.
- **Side-Margin Chords (`sidechords="..."` on `<row>`)**: Explicitly overrides the chords rendered in the side margin (in LaTeX, HTML, and Kindle views).
  - **Glued Chords / Quick Rhythms**: e.g., `sidechords="DG CC7+"` indicates chords changing rapidly within a single measure.
  - **Passing / Optional Chords**: e.g., `sidechords="C GD (H7)"` or `sidechords="(D)"` denotes passing or optional accompaniment.
  - **Bar Dividers**: e.g., `sidechords="C | G | a"`.
  - **Preservation Policy**: When adding or refining inline `<ch>` tags, **never remove `sidechords="..."`** attributes that provide deliberate margin formatting.

### Row Display Attributes (`important_over`)
The `important_over` attribute controls chord visibility above the lyrics:
- `important_over="true"`: Designates a reference stanza row (usually the first verse and chorus) where chords above the text are explicitly rendered.
- `important_over="false"`: Used for subsequent stanzas following the same harmonic structure (chords are displayed in the margin), and for instrumental sections (`style="instr"`).
- `important_over="never"`: Used when chords should only be rendered in the margin and never over the text (or for stanzas without inline chords).

### Editorial History (`<verificators>`)
- Each `<verificator>` tag inside `<status><verificators>` provides an immutable track record of editorial contributions, verified sources, and corrections.
- **Never remove** existing `<verificator>` entries; always append new verification notes and consulted source references.

# Editing of the songs

To reduce the friction when working with git/github and XML format we provide a [graphical editor](https://spiewaj.com/editor) and (github-integration https://spiewaj.com/editor/] to make the songs editing as smooth as possible. 
The changes you will make can be easily published for review and added to this repository. 

# Generating PDF songbooks

The songs can be converted to a PDF songbook. We use LaTeX for this. 
You can [download a ready PDF]( https://github.com/spiewaj/songbook/releases/latest) or generate it yourself.

Running the render script requires:
1) a python environment with dependencies listed in requirements.txt
2) a pdflatex compiler with ucs, extsizes, and Polish localization support

# Generating EPUBs songbooks
You can run `./render_epub.sh`.
You can download recent generated EPUB from here: [spiewnik.epub]( https://github.com//songbook/releases/latest).
