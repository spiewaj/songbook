"""This code generate one tex plik from n>=1 songs in xml
    and gives tex text on stdout"""

import os
import sys

import song2tex as s2t
import src.lib.songbook as sb
import songbook2tex as sb2t


def create_ready_tex(songbook, source, papersize, title_of_songbook=None):
    """function create a pdf file in a4 or a5 size
        source - one file or list of files or directory path
        size - A4 or A5
        title - if source is list of songs you can add a title of songbook,
        songbook - True if we want songbook, False if we don't
    """

    if papersize not in ("a4", "a5"):
        print("Wrong size of paper!", file=sys.stderr)
        exit(1)

    if os.path.isdir(source[0]):
        source = [os.path.join(source[0], x) for x in os.listdir(source[0])]

    if songbook:
        songbook_file = os.path.join(sb.repo_dir(), "songbooks/default.songbook.yaml")
        songbook = sb.load_songbook_spec_from_yaml(songbook_file,
                                                   title = title_of_songbook,
                                                   songFiles = source)
        return sb2t.create_ready_tex(songbook, papersize)
    else:
        head = f"single_p.tex"
        foot = f"single_s.tex"

        with open("src/formats/" + head) as f:
            content = f.read()

        content = (content
                   .replace(":title:", title_of_songbook)
                   .replace(":paper:", "paper"+ papersize)
                   .replace(":fontsize:", "19pt" if papersize=="a4" else "14pt"))

        content += "".join([s2t.song2tex(file) for file in source])

        with open("src/formats/" + foot) as f:
            content += f.read()

        return print(content)


def main():
    if len(sys.argv) <= 4:
        print("Usage: python3 songs2tex.py <single|songbook> <a4|a5> TITLE XML_SONG_FILES...", file=sys.stderr)
        exit(1)
    create_ready_tex(sys.argv[1] != 'single', source=sys.argv[4:], papersize=sys.argv[2],
                     title_of_songbook=sys.argv[3])


if __name__ == "__main__":
    main()
