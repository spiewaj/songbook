"""This code generate one tex plik from n>=1 songs in xml
    and gives tex text on stdout"""

import os
import sys

import src.lib.songbook as sb

def main():
    if len(sys.argv) < 1:
        print("Usage: python3 songbook2id.py songbook.yaml", file=sys.stderr)
        exit(1)
    songbook_file = None
    for arg in sys.argv[1:]:
        if not arg.startswith("--"):
            songbook_file = arg
            break
    if songbook_file is None:
        songbook_file = os.path.join(sb.repo_dir(), "songbooks/default.songbook.yaml")
    songbook = sb.load_songbook_spec_from_yaml(songbook_file)
    print(songbook.id())


if __name__ == "__main__":
    main()
