#!/bin/bash
set -e -x -o pipefail
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# The script optionally accepts a list of song files as arguments
# If no arguments are provided, it processes all songs in the 'songs' directory.

OUTPUT_DIR="${SCRIPT_DIR}/build/songs_pdf"
mkdir -p "${OUTPUT_DIR}"

if [ $# -eq 0 ]; then
  # No arguments provided, process all songs
  SONGS_LIST=( $(find songs -name "*.xml" -type f) )
else
  # Use provided arguments as the list of songs to process
  SONGS_LIST=( "$@" )
fi

# Function to process a single song file
process_song() {
  local song_file="$1"
  local title=$(basename "${song_file}" .xml)
  
  local a4_pdf="${OUTPUT_DIR}/${title}.a4.pdf"
  local a5_pdf="${OUTPUT_DIR}/${title}.a5.pdf"

  # If FORCE_RENDER is not set, check if both A4 and A5 PDFs already exist and are newer than:
  # 1) the song XML itself
  # 2) the generation code / templates / scripts (if GENERATOR_REF_FILE is set)
  if [ -z "${FORCE_RENDER}" ] && [ -f "${a4_pdf}" ] && [ -f "${a5_pdf}" ]; then
    if [ "${a4_pdf}" -nt "${song_file}" ] && [ "${a5_pdf}" -nt "${song_file}" ]; then
      if [ -z "${GENERATOR_REF_FILE}" ] || ([ "${a4_pdf}" -nt "${GENERATOR_REF_FILE}" ] && [ "${a5_pdf}" -nt "${GENERATOR_REF_FILE}" ]); then
        echo "Skipping up-to-date: ${title}"
        return 0
      fi
    fi
  fi

  echo "Processing: ${title} (${song_file})"
  
  for format in a4 a5; do
    local JOB="${title}.${format}"
    JOB=${JOB} ./render_pdf.sh single "${format}" "${title}" "${song_file}" > /dev/null 2>&1
    mv "${SCRIPT_DIR}/build/songs_tex/${JOB}.pdf" "${OUTPUT_DIR}/${JOB}.pdf"
  done
}

# Determine the newest timestamp among generator scripts, templates, and libraries
# This allows detecting generator code changes even across git checkouts or cache restores
GENERATOR_REF_FILE="${SCRIPT_DIR}/build/.generator_ref"
mkdir -p "${SCRIPT_DIR}/build"
# Touch GENERATOR_REF_FILE to match the mtime of the newest generator dependency
NEWEST_GEN_FILE=$(find "${SCRIPT_DIR}/src/latex" "${SCRIPT_DIR}/src/lib" "${SCRIPT_DIR}/render_pdf.sh" "${SCRIPT_DIR}/render_pdfs_songs.sh" -type f -exec stat -f "%m %N" {} + 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f2- || true)
if [ -z "${NEWEST_GEN_FILE}" ]; then
  # Linux fallback (stat -c)
  NEWEST_GEN_FILE=$(find "${SCRIPT_DIR}/src/latex" "${SCRIPT_DIR}/src/lib" "${SCRIPT_DIR}/render_pdf.sh" "${SCRIPT_DIR}/render_pdfs_songs.sh" -type f -exec stat -c "%Y %n" {} + 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f2- || true)
fi

if [ -n "${NEWEST_GEN_FILE}" ] && [ -f "${NEWEST_GEN_FILE}" ]; then
  touch -r "${NEWEST_GEN_FILE}" "${GENERATOR_REF_FILE}"
else
  touch "${GENERATOR_REF_FILE}"
fi

# Export the function so it's available to subprocesses
export -f process_song
export SCRIPT_DIR OUTPUT_DIR FORCE_RENDER GENERATOR_REF_FILE

# Use xargs to process songs in parallel (default: 4 concurrent processes)
# You can set PARALLEL_JOBS environment variable to control concurrency
PARALLEL_JOBS=${PARALLEL_JOBS:-8}

printf '%s\n' "${SONGS_LIST[@]}"  | xargs -P "${PARALLEL_JOBS}" -I {} bash -c 'process_song "$@"' _ {}
