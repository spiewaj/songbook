#!/usr/bin/env bash

set -o errexit
set -o pipefail
set -x

__dir="$(
  cd "$(dirname "$0")" 2>&1 >/dev/null
  pwd -P
)"
__script="$(realpath $(basename "$0"))"

display_usage() {
  echo "Renders a PDF containing a single song, or a compiled songbook."
  echo "Usage: ${__script} <single|songbook> <a4|a5> TITLE XML_SONG_FILES..."
  echo "   or: ${__script} <a4|a5> optional: songbook.yaml"

}

if [[ $# -lt 1 ]]; then
  display_usage
  exit 1
fi

tex_dir=${__dir}/build/songs_tex
mkdir -p ${tex_dir}
tex_file=$(realpath "${tex_dir}")/output.tex

MAKE_INDEX=true
if [[ "${@: -1}" =~ \.yaml$ || $# -lt 4 ]]; then
  papersize=$1
  PYTHONPATH="${__dir}" python3 ${__dir}/src/latex/songbook2tex.py "${papersize}" "${@:2}" >${tex_file}
  SONGBOOK_ID=$(PYTHONPATH="${__dir}" python3 ${__dir}/src/songbook2id.py "${@:2}")
  JOB="${SONGBOOK_ID}_${papersize}"
else
  format=$1
  papersize=$2
  title=$3
  if [[ ${format} == "single" ]]; then
    MAKE_INDEX=false
  fi
  PYTHONPATH="${__dir}" python3 ${__dir}/src/latex/songs2tex.py "${format}" "${papersize}" "${title}" "${@:4}" >${tex_file}
  JOB="output"
fi

(cd ${tex_dir}; rm -rf "${JOB}.aind" "${JOB}.gind" "${JOB}.wind" "${JOB}.aadx" "${JOB}.gadx" "${JOB}.wadx")

(
  cd ${tex_dir}

  # Run pdflatex three times to recalculate longtables and toc
  TEXINPUTS=.:${__dir}/src/latex: pdflatex -shell-escape -jobname=${JOB} -output-directory "${tex_dir}" "${tex_file}"
  INDEX_STY=()

  if ${MAKE_INDEX}; then
    (cd ${tex_dir}; texindy -M lang/polish/utf8-lang aliases.idx)
    (cd ${tex_dir}; texindy -M lang/polish/utf8-lang -M ${__dir}/src/formats/no-lg genre.idx)
    (cd ${tex_dir}; texindy -M lang/polish/utf8-lang -M ${__dir}/src/formats/no-lg wyk.idx)
  fi

  TEXINPUTS=.:${__dir}/src/latex: pdflatex -shell-escape -jobname=${JOB} -output-directory "${tex_dir}" "${tex_file}"
  TEXINPUTS=.:${__dir}/src/latex: pdflatex -shell-escape -jobname=${JOB} -output-directory "${tex_dir}" "${tex_file}"
)
