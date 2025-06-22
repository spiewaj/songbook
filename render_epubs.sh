#!/bin/bash
set -e -x
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

for s in ${SCRIPT_DIR}/songbooks/*.yaml; do
  echo "Rendering: ${s}" >&2
  SONGBOOK_ID=$(PYTHONPATH="${SCRIPT_DIR}" python3 ${SCRIPT_DIR}/src/songbook2id.py "${s}")
  ${SCRIPT_DIR}/render_epub.sh "${s}"
  if [ -f /opt/homebrew/bin/epubcheck ]; then
    epubcheck "${SCRIPT_DIR}/build/${SONGBOOK_ID}.epub"
  else
    java -jar /usr/bin/epubcheck "${SCRIPT_DIR}/build/${SONGBOOK_ID}.epub"
  fi
done