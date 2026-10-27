"""This code generate one tex plik from n>=1 songs in xml
    and gives tex text on stdout"""

import os
import sys

import song2tex as s2t
import src.lib.songbook as sb
import songbook2tex as sb2t


import re
from lxml import etree


def sanitize_for_hypersetup(text):
    if not text:
        return ""
    text = text.replace("\r", " ").replace("\n", " ")
    text = text.replace("\\", "")
    text = text.replace("{", "(").replace("}", ")")
    text = text.replace("&", r"\&")
    text = text.replace("%", r"\%")
    text = text.replace("#", r"\#")
    text = text.replace("_", r"\_")
    text = text.replace("$", r"\$")
    text = re.sub(r'\s+', ' ', text).strip()
    return text


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

        raw_title = title_of_songbook or ""
        pdf_title = f"{raw_title} – Śpiewaj!" if raw_title else "Śpiewaj!"
        pdf_author = ""
        pdf_subject = ""
        pdf_keywords = ""
        song_url = "https://spiewaj.com/"

        if len(source) == 1 and os.path.isfile(source[0]):
            try:
                tree = etree.parse(source[0])
                root = tree.getroot()
                raw_title = root.get('title') or title_of_songbook or ""
                pdf_title = f"{raw_title} – Śpiewaj!" if raw_title else "Śpiewaj!"

                authors = []
                for tag in ['artist', 'text_author', 'composer']:
                    el = root.find(f'{{*}}{tag}')
                    if el is not None and el.text and el.text.strip():
                        val = el.text.strip()
                        if val not in authors:
                            authors.append(val)
                pdf_author = ", ".join(authors)

                genre_el = root.find('{*}genre')
                genre = genre_el.text.strip() if genre_el is not None and genre_el.text else ""

                if genre:
                    pdf_subject = f"Piosenka ({genre}): {raw_title} – tekst, chwyty i akordy na gitarę"
                else:
                    pdf_subject = f"Piosenka: {raw_title} – tekst, chwyty i akordy na gitarę"

                keywords = ["piosenka", "tekst", "chwyty", "akordy", "śpiewnik", raw_title]
                if genre:
                    keywords.append(genre)
                keywords.extend(authors)
                pdf_keywords = ", ".join([k for k in keywords if k])

                base_name = os.path.splitext(os.path.basename(source[0]))[0]
                song_url = f"https://spiewaj.com/songs_html/{base_name}.html"
            except Exception as e:
                print(f"Warning: could not parse song metadata from {source[0]}: {e}", file=sys.stderr)
        elif len(source) > 1:
            raw_title = title_of_songbook or "Śpiewnik"
            pdf_title = f"{raw_title} – Śpiewaj!"
            pdf_subject = f"Śpiewnik: {raw_title}"
            pdf_keywords = f"śpiewnik, piosenki, chwyty, {raw_title}"

        content = (content
                   .replace(":title:", sanitize_for_hypersetup(raw_title))
                   .replace(":pdftitle:", sanitize_for_hypersetup(pdf_title))
                   .replace(":pdfauthor:", sanitize_for_hypersetup(pdf_author))
                   .replace(":pdfsubject:", sanitize_for_hypersetup(pdf_subject))
                   .replace(":pdfkeywords:", sanitize_for_hypersetup(pdf_keywords))
                   .replace(":url:", song_url)
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
