"""This code generate one tex plik from n>=1 songs in xml
    and gives tex text on stdout"""

import os
import sys

import song2tex as s2t
import src.lib.songbook as sb
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def str2tex(s):
    return s.replace("\n", "\\\\").replace("#", "\\#").replace("_", "\\_").replace("...", "…")

def create_ready_tex(songbook, papersize, dense=None, pack_songs=None, chords_over_verses=None):
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

    if dense is not None:
        effective_pack = dense if pack_songs is None else pack_songs
        effective_chords_over = (not dense) if chords_over_verses is None else chords_over_verses
    else:
        effective_pack = songbook.pack_songs() if pack_songs is None else pack_songs
        effective_chords_over = songbook.chords_over_verses() if chords_over_verses is None else chords_over_verses

    head = f"songbook_p.tex"
    foot = f"songbook_s.tex"

    with open("src/formats/" + head) as f:
        content = f.read()

    content = (content
               .replace(":paper:", "paper" + papersize)
               .replace(":fontsize:", "19pt" if papersize == "a4" else "14pt")
               .replace(":print_chords_on:", "true" if effective_chords_over else "false")
               .replace(":pack_songs:", "true" if effective_pack else "false")
               .replace(":title:", str2tex(songbook.title()))
               .replace(":subtitle:", str2tex(songbook.subtitle()))
               .replace(":place:", str2tex(songbook.place() + ", ") if songbook.place() else "")
               .replace(":url:", str2tex(songbook.url()))
               .replace(":publisher:", str2tex(songbook.publisher())))

    if songbook.imagePdfPath():
        image_tex = f"\\includegraphics[width=0.95\\textwidth,height=0.58\\textheight,keepaspectratio]{{{songbook.imagePdfPath()}}}"
    else:
        image_tex = ""
        
    content = content.replace(":imagePdfPath:", image_tex)

    content += "".join([s2t.song2tex(file, pack_songs=effective_pack, chords_over_verses=effective_chords_over, papersize=papersize) for _, file in list_title_file])

    with open("src/formats/" + foot) as f:
        content += f.read()

    return print(content)


def main():
    logger.info("Starting songbook2tex")
    if len(sys.argv) <= 1:
        print("Usage: python3 songbook2tex.py <a4|a5> [songbook.yaml] [--dense] [--pack-songs] [--no-chords-over]", file=sys.stderr)
        exit(1)

    papersize = sys.argv[1]
    songbook_file = None
    dense = True if os.environ.get("DENSE", "").lower() in ("1", "true") else None
    pack_songs = None
    chords_over_verses = None

    if os.environ.get("PACK_SONGS", "").lower() in ("1", "true"):
        pack_songs = True
    elif os.environ.get("PACK_SONGS", "").lower() in ("0", "false"):
        pack_songs = False

    if os.environ.get("CHORDS_OVER_VERSES", "").lower() in ("1", "true"):
        chords_over_verses = True
    elif os.environ.get("CHORDS_OVER_VERSES", "").lower() in ("0", "false"):
        chords_over_verses = False

    for arg in sys.argv[2:]:
        if arg == "--dense":
            dense = True
        elif arg == "--no-dense":
            dense = False
        elif arg == "--pack-songs":
            pack_songs = True
        elif arg == "--no-pack-songs":
            pack_songs = False
        elif arg in ("--no-chords-over", "--side-chords-only"):
            chords_over_verses = False
        elif arg == "--chords-over":
            chords_over_verses = True
        elif not arg.startswith("--") and songbook_file is None:
            songbook_file = arg

    if songbook_file is None:
        songbook_file = os.path.join(sb.repo_dir(), "songbooks/default.songbook.yaml")

    songbook = sb.load_songbook_spec_from_yaml(songbook_file)

    create_ready_tex(
        songbook=songbook,
        papersize=papersize,
        dense=dense,
        pack_songs=pack_songs,
        chords_over_verses=chords_over_verses
    )


if __name__ == "__main__":
    main()
