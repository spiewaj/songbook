#!/bin/bash

set -euo pipefail

SONGBOOK_YAML="${1:-songbooks/smoke.songbook.yaml}"
PYTHON_BIN=".python_venv/bin/python"
if [ ! -x "${PYTHON_BIN}" ]; then
  PYTHON_BIN="python3"
fi

EPUB_ID=$(PYTHONPATH=. "${PYTHON_BIN}" -c "import sys, src.lib.songbook as sb; print(sb.load_songbook_spec_from_yaml(sys.argv[1]).id())" "${SONGBOOK_YAML}")
PYTHONPATH=. "${PYTHON_BIN}" src/epub/create_epub.py "${SONGBOOK_YAML}"
epubcheck "./build/${EPUB_ID}.epub"
