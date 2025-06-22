#!/bin/bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

for s in songbooks/*.yaml; do
  ./render_pdf.sh a4 "${s}"
  ./render_pdf.sh a5 "${s}"
done