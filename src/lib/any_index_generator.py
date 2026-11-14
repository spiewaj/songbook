import hashlib
import os
import sys
import icu
import src.lib.songbook as sb
from lxml import etree

# def name_of_file(song):
#     return os.path.splitext(os.path.split(song)[1])[0]


def anchor_id(key):
    """Return a deterministic, XML-safe HTML id for an index key."""
    return "idx_" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def create_index(list_of_songs_meta, song2key=(lambda x:x.genre()) ):
    idx=dict()
    seen=dict()

    for song in list_of_songs_meta:
        keys = song2key(song)
        if not keys:
            continue
        if isinstance(keys, str):
            keys = [keys]
        for key in keys:
            if not key:
                continue
            song_id = song.base_file_name()
            if key not in idx:
                idx[key] = []
                seen[key] = set()
            if song_id not in seen[key]:
                seen[key].add(song_id)
                idx[key].append(song)
    return idx

def index2dom(idx, parent):
    keys = list(idx.keys())

    collator = icu.Collator.createInstance(icu.Locale('pl_PL.UTF-8'))
    keys.sort(key=lambda x: collator.getSortKey(x))

    for k in keys:
        v = idx[k]
        d = etree.SubElement(parent, "div", attrib={"id": anchor_id(k)})
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