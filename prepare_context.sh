# Prepares environment for running the scripts. For now tested on mac

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

if [ ! -d "${SCRIPT_DIR}/.python_venv" ]; then
  # Tested on OSX
  python3 -m venv .python_venv/
  export PATH="/usr/local/opt/icu4c/bin:$PATH"
  export PKG_CONFIG_PATH="/opt/homebrew/opt/icu4c/lib/pkgconfig"
  pip3 install -r "${SCRIPT_DIR}/requirements.txt"
fi

source "${SCRIPT_DIR}/.python_venv/bin/activate"
