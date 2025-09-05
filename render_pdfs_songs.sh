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
  
  local JOB="${title}.${format}"
  echo "Processing: ${title} (${song_file})"
  
  for format in a4 a5; do
    JOB=${JOB} ./render_pdf.sh single "${format}" "${title}" "${song_file}" > /dev/null 2>&1
    mv "${SCRIPT_DIR}/build/songs_tex/${JOB}.pdf" "${OUTPUT_DIR}/${JOB}.pdf"
  done
}

# Export the function so it's available to subprocesses
export -f process_song
export SCRIPT_DIR OUTPUT_DIR

# Use xargs to process songs in parallel (default: 4 concurrent processes)
# You can set PARALLEL_JOBS environment variable to control concurrency
PARALLEL_JOBS=${PARALLEL_JOBS:-8}

printf '%s\n' "${SONGS_LIST[@]}"  | xargs -P "${PARALLEL_JOBS}" -I {} bash -c 'process_song "$@"' _ {}
