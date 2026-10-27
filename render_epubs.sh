#!/bin/bash
set -e -x
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

PYTHON_BIN="python3"
if [[ -x "${SCRIPT_DIR}/.python_venv/bin/python" ]]; then
  PYTHON_BIN="${SCRIPT_DIR}/.python_venv/bin/python"
fi

for s in ${SCRIPT_DIR}/songbooks/*.yaml; do
  echo "Rendering: ${s}" >&2
  SONGBOOK_ID=$(PYTHONPATH="${SCRIPT_DIR}" "${PYTHON_BIN}" ${SCRIPT_DIR}/src/songbook2id.py "${s}")
  ${SCRIPT_DIR}/render_epub.sh "${s}"
  if [ -f /opt/homebrew/bin/epubcheck ]; then
    epubcheck "${SCRIPT_DIR}/build/${SONGBOOK_ID}.epub"
  else
    java -jar /usr/bin/epubcheck "${SCRIPT_DIR}/build/${SONGBOOK_ID}.epub"
  fi
done