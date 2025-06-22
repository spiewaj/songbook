#!/usr/bin/env bash

set -o errexit  #niech ten skrypt przestanie się wykonywać przy pierwszym błędzie
set -o pipefail #jesli któreś polecenie w przetwarzaniu strumieniowym (z |) się wywali to przestań wykonywać

__dir="$(
  cd "$(dirname "$0")" 2>&1 >/dev/null
  pwd -P
)"                          #celem jest ustalenie katalogu gdzie jest wykonywany skrypt i zapisanie na zmiennej dir
__script="$(basename "$0")" #sprawdzenie jak się ten skrypt nazywa

display_usage() {
  echo "Renders a EPUB containing a single song, or a compiled songbook."
  echo "Usage: ${__script} "
} #funkcja która wypisuje pomoc

if [[ $# -gt 1 ]]; then
  display_usage
  exit 1
fi

#cd "${__dir}/src/epub/"
PYTHONPATH="${__dir}" python3 ${__dir}/src/epub/create_epub.py "${@}"

