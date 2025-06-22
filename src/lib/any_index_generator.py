import os
import sys
import icu
import src.lib.songbook as sb
from lxml import etree

# def name_of_file(song):
#     return os.path.splitext(os.path.split(song)[1])[0]


def create_index(list_of_songs_meta, song2key=(lambda x:x.genre()) ):
    idx=dict()

    for song in list_of_songs_meta:
        key = song2key(song)
        if key:
            if key in idx:
                l = idx[key]
            else:
                l = []
                idx[key] = l
            l.append(song)
    return idx

def index2dom(idx, parent):
    keys = list(idx.keys())

    collator = icu.Collator.createInstance(icu.Locale('pl_PL.UTF-8'))
    keys.sort(key=lambda x: collator.getSortKey(x))

    for k in keys:
        v = idx[k]
        d = etree.SubElement(parent, "div")
        t = etree.SubElement(d, "span")
        t.text = k
        ul = etree.SubElement(d, "ul")
        for song in v:
            li = etree.SubElement(ul, "li")
            a = etree.SubElement(li, "a", attrib={"href": song.base_file_name()+".xhtml"})
            a.text = song.effectiveTitle()

def makeIndex(title, list_of_songs_meta, out_path, song2key=(lambda x:x.genre())):
    tree = etree.parse(os.path.join(sb.repo_dir(), "./src/epub/templates/index.xhtml"))
    body = tree.getroot().find(".//{http://www.w3.org/1999/xhtml}body")
    h1 = tree.getroot().find(".//{http://www.w3.org/1999/xhtml}h1")
    h1.text = title
    idx = create_index(list_of_songs_meta, song2key)
    index2dom(idx, body)
    et = etree.ElementTree(tree.getroot())
    et.write(out_path, pretty_print=True, method='xml', encoding='utf-8', xml_declaration=True)


def main():
    songbook_file = os.path.join(sb.repo_dir(), "songbooks/default.songbook.yaml") if len(sys.argv) == 1 else sys.argv[1]
    songbook = sb.load_songbook_spec_from_yaml(songbook_file)
    target_dir = os.path.join(sb.repo_dir(), "build")

    makeIndex("Gatunki", songbook.list_of_songs(), os.path.join(target_dir, "genres.html"), lambda x:(x.genre() if not x.is_alias() else None))
    makeIndex("Wykonawcy", songbook.list_of_songs(), os.path.join(target_dir, "artists.html"), lambda x:(x.artist() if not x.is_alias() else None))
    # create_index_xhtml(songbook.list_of_songs(), target_dir)

if __name__ == '__main__':
    main()