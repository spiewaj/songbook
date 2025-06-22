"""This code generate one tex plik from n>=1 songs in xml
    and gives tex text on stdout"""

import os
import sys

import song2tex as s2t
import src.lib.songbook as sb


def str2tex(s):
    return s.replace("\n", "\\\\").replace("#", "\\#").replace("_", "\\_").replace("...", "…")

def create_ready_tex(songbook, papersize):
    """function create a pdf file in a4 or a5 size
        source - one file or list of files or directory path
        size - A4 or A5
        title - if source is list of songs you can add a title of songbook,
        songbook - Specification of the songbook to generate
    """
    source = songbook.list_of_songs()

    list_title_file = []

    for s in source:
        if not s.is_alias():
            title = s.effectiveTitle()
            print(s, file=sys.stderr)
            list_title_file.append((title, s.plik()))

    if papersize not in ("a4", "a5"):
        print("Wrong size of paper!", file=sys.stderr)
        exit(1)

    head = f"songbook_p.tex"
    foot = f"songbook_s.tex"

    with open("src/formats/" + head) as f:
        content = f.read()

    content = (content
               .replace(":paper:", "paper" + papersize)
               .replace(":fontsize:", "19pt" if papersize == "a4" else "14pt")
               .replace(":title:", str2tex(songbook.title()))
               .replace(":subtitle:", str2tex(songbook.subtitle()))
               .replace(":place:", str2tex(songbook.place() + ", ") if songbook.place() else "")
               .replace(":url:", str2tex(songbook.url()))
               .replace(":publisher:", str2tex(songbook.publisher()))
               .replace(":imagePdfPath:", songbook.imagePdfPath()))

    content += "".join([s2t.song2tex(file) for _, file in list_title_file])

    with open("src/formats/" + foot) as f:
        content += f.read()

    return print(content)


def main():
    if len(sys.argv) <= 1:
        print("Usage: python3 songbook2tex.py <a4|a5> songbook.yaml", file=sys.stderr)
        exit(1)
    songbook_file = os.path.join(sb.repo_dir(), "songbooks/default.songbook.yaml") if len(sys.argv) == 2 else sys.argv[2]
    songbook = sb.load_songbook_spec_from_yaml(songbook_file)

    create_ready_tex(songbook=songbook, papersize=sys.argv[1])


if __name__ == "__main__":
    main()
