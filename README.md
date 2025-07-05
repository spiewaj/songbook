# Deprecation

The maintained version of this repository is at https://github.com/spiewaj/songbook and the generated songbooks/artifacts on: https://spiewaj.com .

### Recent generated artifacts:
  Generated artifacts are auto-published (post-commit on) https://songbook.21wdw.org.
  You can also check the latest release: https://github.com/wdw21/songbook/releases/latest.
# About

This project contains:
 - [songs](./songs) (in XML format)
 - tools to generate PDFs, EPUBs and HTMLs out of this songs
 - [web editor](./editor) to enable easy edits of the songs and [github-integration](./editor-github)
 - [web editor](./editor) to enable easy edits of the songs and [github-integration](./editor-github)
# Songs

Currently the songs are hosted in the [./songs](./songs) directory.
They are mostly Polish scouting and tourists songs. If the set growths, we will organize it into language specific directories.
The XML format is pretty well self-describing.

# Editing of the songs

To reduce the friction when working with git/github and XML format we provide a [graphical editor](https://songbook.21wdw.org/editor) and (github-integration https://ghe.songbook.21wdw.org/editor/] to make the songs editing as smooth as possible. 
The changes you will make can be easily published for review and added to this repository. 

# Generating PDF songbooks

The songs can be converted to a PDF songbook. We use LaTeX for this. 
You can [download a ready PDF]( https://github.com/wdw21/songbook/releases/latest) or generate it yourself.

Running the render script requires:
1) a python environment with dependencies listed in requirements.txt
2) a pdflatex compiler with ucs, extsizes, and Polish localization support

# Generating EPUBs songbooks
You can run `./render_epub.sh`.
You can download recent generated EPUB from here: [spiewnik.epub]( https://github.com/wdw21/songbook/releases/latest).
