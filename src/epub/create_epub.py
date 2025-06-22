import os
import zipfile
import copy
import sys

from lxml import etree
import shutil
from zipfile import ZipFile
from datetime import datetime

import src.html.create_songs_html as cash
import src.lib.songbook as sb
import src.lib.any_index_generator as aig

def actual_date():
    return str(datetime.now().strftime("%Y-%m-%d"))

def actual_datetime():
    return str(datetime.now().strftime("%Y-%m-%d  %H:%M"))

NO_NAV_LIMIT = 19

#
# def name_of_file(song):
#     return os.path.splitext(os.path.split(song)[1])[0]

CSS_FILES = ["song.css", "common.css", "song_common.css", "index.css"]

def create_content_opf(songbook, list_of_songs_meta, target_dir, pre_files=[], post_files=[]):
    tmp_path =os.path.join(sb.repo_dir(), "src", "epub", "templates", "content.opf")
    out_path = os.path.join(target_dir, "epub", "OEBPS", "content.opf")
    tree = etree.parse(tmp_path)
    root = tree.getroot()

    manifest = root.getchildren()[1]
    spine = root.getchildren()[2]
    p = 1

    all_files = pre_files + [x.base_file_name() + '.xhtml' for x in list_of_songs_meta if not x.is_alias() ] + post_files

    for f in all_files:
        x = etree.SubElement(manifest, "item")
        x.attrib['id'] = 'p' + str(p)
        x.attrib['href'] = f
        x.attrib['media-type'] = "application/xhtml+xml"
        etree.SubElement(spine, "itemref").attrib['idref'] = 'p' + str(p)
        p = p + 1

    et = etree.ElementTree(root)
    et.write(out_path, doctype='<!DOCTYPE html>', pretty_print=True, method='xml', encoding='utf-8', xml_declaration=True)
    resolveTemplate(songbook, out_path, out_path)

def groupName(title):
  if title[0]>='0' and title[0]<='9':
      return "0..9"
  return title[0].upper()

def create_toc_ncx(list_of_songs_meta, target_dir):
    tmp_path = 'templates/toc.ncx'
    out_path = os.path.join(target_dir, "epub", "OEBPS", "toc.ncx")
    tree = etree.parse(tmp_path)
    root = tree.getroot()
    doctitle = root.getchildren()[1]
    text1 = doctitle.getchildren()[0]
    text1.text += actual_date()
    navmap = root.getchildren()[2]

    parent = navmap
    last_letter=''
    playOrder=1
    for i in range(len(list_of_songs_meta)):
        if len(list_of_songs_meta) > NO_NAV_LIMIT and last_letter != groupName(list_of_songs_meta[i].title()):
           last_letter = groupName(list_of_songs_meta[i].title())
           parent_np = etree.SubElement(navmap, "navPoint")
           parent_np.attrib['id'] = 'p' + str(playOrder)
           parent_np.attrib['playOrder'] = str(playOrder)
           playOrder = playOrder + 1
           parent_nl = etree.SubElement(parent_np, "navLabel")
           parent_text = etree.SubElement(parent_nl, "text")
           parent_text.text = last_letter
           content = etree.SubElement(parent_np, "content")
           content.attrib['src'] = name_of_file(list_of_songs_meta[i].plik) + '.xhtml#title'
           parent = parent_np

        navpoint = etree.SubElement(parent, "navPoint")
        navpoint.attrib['id'] = 'p' + str(playOrder)
        navpoint.attrib['playOrder'] = str(playOrder)
        playOrder = playOrder + 1
        navlabel = etree.SubElement(navpoint, "navLabel")
        text = etree.SubElement(navlabel, "text")
        text.text = list_of_songs_meta[i].title()
        content = etree.SubElement(navpoint, "content")
        content.attrib['src'] = name_of_file(list_of_songs_meta[i].plik) + '.xhtml'
    et = etree.ElementTree(root)
    et.write(out_path, doctype='<!DOCTYPE html>', pretty_print=True, method='xml', encoding='utf-8', xml_declaration=True)

class SongInToc:
    def __init__(self, song):
       self.song = song

    def plik(self):
        return self.song.plik

    def title(self):
        return self.song.effectiveTitle()

    def base_file_name(self):
        return self.song.base_file_name()

def extract_toc_songs(list_of_songs_meta):
    d = dict()
    group = None
    last_letter = None
    for i in range(len(list_of_songs_meta)):
        if len(list_of_songs_meta) > NO_NAV_LIMIT and last_letter != groupName(list_of_songs_meta[i].effectiveTitle()):
            group = groupName(list_of_songs_meta[i].effectiveTitle())
        if not group in d:
            d[group] = []
        d[group].append(SongInToc(list_of_songs_meta[i]))
    return d

def toc_songs_to_xhtml(parent, toc_songs_list):
    for i in range(len(toc_songs_list)):
        s = toc_songs_list[i]
        li = etree.SubElement(parent, "li")
        a = etree.SubElement(li, "a")
        a.attrib['href'] = s.base_file_name()+ '.xhtml'
        a.text = s.title()

def create_group_toc_xhtml(group, toc_songs_list, target_dir, page_suffix = None):
    tmp_path = os.path.join(sb.repo_dir(), "src", "epub", "templates", "toc_letter.xhtml")
    file_name = "toc_"+group+".xhtml"
    out_path = os.path.join(target_dir, "epub", "OEBPS", file_name)
    tree = etree.parse(tmp_path)
    root = tree.getroot()
    body = root.getchildren()[1]
    nav = body.getchildren()[0]
    h1 = nav.getchildren()[0]
    h1.text = group
    toc_ol = nav.getchildren()[1]

    toc_songs_to_xhtml(toc_ol, toc_songs_list)
    et = etree.ElementTree(root)
    if page_suffix is not None:
        body.append(copy.deepcopy(page_suffix))
    et.write(out_path, doctype='<!DOCTYPE html>', pretty_print=True, method='xml', encoding='utf-8', xml_declaration=True)
    return file_name

def create_index_toc_xhtml(target_dir, page_suffix = None):
    """
    Creates a new .index.xhtml file in the given file that contains given body (page_suffix).

    :param target_dir:
    :param page_suffix:
    :return:
    """
    tmp_path =  os.path.join(sb.repo_dir(), "src", "epub", "templates", "index.xhtml")
    file_name = "index.xhtml"
    out_path = os.path.join(target_dir, "epub", "OEBPS", file_name)
    tree = etree.parse(tmp_path)
    root = tree.getroot()
    body = root.getchildren()[1]
    et = etree.ElementTree(root)
    if page_suffix is not None:
        body.append(copy.deepcopy(page_suffix))
    et.write(out_path, doctype='<!DOCTYPE html>', pretty_print=True, method='xml', encoding='utf-8', xml_declaration=True)
    return file_name

def create_toc_xhtml(list_of_songs_meta, target_dir, page_suffix):
    files = []
    tmp_path =  os.path.join(sb.repo_dir(), "src", "epub", "templates", "toc.xhtml")
    out_path = os.path.join(target_dir, "epub", "OEBPS", "toc.xhtml")
    tree = etree.parse(tmp_path)
    root = tree.getroot()
    body = root.getchildren()[1]
    nav = body.getchildren()[0]
    toc_ol = nav.getchildren()[1]

    files.append(create_index_toc_xhtml(target_dir, page_suffix))

    toc_songs = extract_toc_songs(list_of_songs_meta)

    li = etree.SubElement(toc_ol, "li")
    a = etree.SubElement(li, "a")
    a.attrib['href'] = 'songs.xhtml'
    a.text ="Piosenki"

    li = etree.SubElement(toc_ol, "li")
    a = etree.SubElement(li, "a")
    a.attrib['href'] = 'index.xhtml'
    a.text ="Spis piosenek"

    for group in toc_songs:
        if group:
            parent_li = etree.SubElement(toc_ol, "li")
            parent_a = etree.SubElement(parent_li, "a", attrib={"href": "toc_" + group + ".xhtml"})
            parent_a.text = group

            # Comment if you want songs for each letter
            if False:
                parent_ol = etree.SubElement(parent_li, "ol")
                toc_songs_to_xhtml(parent_ol, toc_songs[group])

            files.append(create_group_toc_xhtml(group, toc_songs[group], target_dir, page_suffix))
        else:
            toc_songs_to_xhtml(toc_ol, toc_songs[group])

    li = etree.SubElement(toc_ol, "li")
    a = etree.SubElement(li, "a")
    a.attrib['href'] = '_artists.xhtml'
    a.text ="Wykonawcy"

    li = etree.SubElement(toc_ol, "li")
    a = etree.SubElement(li, "a")
    a.attrib['href'] = '_genres.xhtml'
    a.text ="Gatunki"

    et = etree.ElementTree(root)
    et.write(out_path, pretty_print=True, method='xml', encoding='utf-8', xml_declaration=True)
    cash.replace_in_file(out_path, out_path, lambda s: s.replace("</li><li>","</li>\n\t\t<li>").replace("><ol>",">\n<ol>"))
    return files

def resolveTemplate(songbook, from_file, to_file):
    return  cash.replace_in_file(from_file, to_file,
        lambda s: (s.replace(":date:", actual_date())
                    .replace(":datetime:", actual_datetime())
                    .replace(":title:", songbook.title())
                    .replace(":subtitle:", songbook.subtitle())
                    .replace(":id:", songbook.id())
                    .replace(":uuid:", songbook.uuid())
                    .replace(":url:", songbook.url())
                    .replace(":publisher:", songbook.publisher())
                    .replace(":timestamp:", datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"))
                    .replace(":imageMime:", songbook.imageWebMime())
                    .replace(":imageExt:", songbook.imageWebExt())))


def create_template_epub(songbook, target_path):
    path_epub = os.path.join(target_path, "epub")
    if os.path.exists(path_epub):
        shutil.rmtree(path_epub)
    path_meta = os.path.join(path_epub, "META-INF")
    path_oebps = os.path.join(path_epub, "OEBPS")
    path_css = os.path.join(path_oebps, "CSS")
    path_images = os.path.join(path_oebps, "images")
    os.mkdir(path_epub)
    os.mkdir(path_oebps)
    os.mkdir(path_meta)
    os.mkdir(path_css)
    os.mkdir(path_images)
    template_dir = os.path.join(sb.repo_dir(), "src", "epub", "templates")
    path_tmp_meta = os.path.join(template_dir, "container.xml")
    resolveTemplate(songbook, path_tmp_meta, os.path.join(path_meta, "container.xml"))

    for css_file in CSS_FILES:
        path_tmp_css = os.path.join(template_dir, css_file)
        os.symlink(path_tmp_css, os.path.join(path_css, css_file))
        print("Linking CSS file: " + path_tmp_css + " to " + os.path.join(path_css, css_file))

    path_tmp_mimetype = os.path.join(template_dir, "mimetype")
    shutil.copyfile(path_tmp_mimetype, os.path.join(path_epub, "mimetype"))

    shutil.copyfile(songbook.imageWebPath(), os.path.join(path_images, "cover." + songbook.imageWebExt()))
    resolveTemplate(songbook, os.path.join(template_dir, "songs.xhtml"), os.path.join(path_oebps, "songs.xhtml"))
    resolveTemplate(songbook, os.path.join(template_dir, "cover.xhtml"), os.path.join(path_oebps, "cover.xhtml"))


def create_full_epub(songbook,  target_dir):
    los = songbook.list_of_songs()
    toc_songs = extract_toc_songs(los)
    suffix = etree.Element("div", attrib={"id":"letters", "class": "letters"})
    for group in toc_songs:
        if group:
            a=etree.SubElement(suffix, "a")
            a.attrib["href"] = "toc_" + group + ".xhtml"
            a.text=group
            a.tail=" "

    create_template_epub(songbook, target_dir)
    path_out = os.path.join(target_dir, "epub", "OEBPS")
    cash.create_all_songs_html(los, path_out,  suffix)
    files = []
    files.extend(create_toc_xhtml(los, target_dir, page_suffix = suffix))

    artists = os.path.join(path_out, "_artists.xhtml")
    aig.makeIndex("Wykonawcy", songbook.list_of_songs(), artists, lambda x:x.artist() if not x.is_alias() else None )
    files.append("_artists.xhtml")

    genres = os.path.join(path_out, "_genres.xhtml")
    aig.makeIndex("Gatunki", songbook.list_of_songs(), genres, lambda x:x.genre() if not x.is_alias() else None)
    files.append("_genres.xhtml")

    create_content_opf(songbook, los, target_dir, post_files=files)


def package_epub(songbook, target_dir, target_file="spiewnik.epub"):
    target_dir_epub = os.path.join(target_dir, "epub")
    with ZipFile(os.path.join(target_dir, target_file), 'w', compression=zipfile.ZIP_DEFLATED) as myzip:
        myzip.write(os.path.join(target_dir_epub, "mimetype"), arcname="mimetype", compress_type=zipfile.ZIP_STORED)
        myzip.write(os.path.join(target_dir_epub, "META-INF", "container.xml"),
                    arcname=os.path.join("META-INF", "container.xml"))
        file_list = os.listdir(os.path.join(target_dir_epub, "OEBPS"))
        for file in file_list:
            if file != 'CSS':
                myzip.write(os.path.join(target_dir_epub, "OEBPS", file), arcname=os.path.join("OEBPS", file))
        for css_file in CSS_FILES:
            myzip.write(os.path.join(target_dir_epub, "OEBPS", "CSS", css_file),
                        arcname=os.path.join("OEBPS", "CSS", css_file))
        myzip.write(os.path.join(target_dir_epub, "OEBPS", "images", "cover."+songbook.imageWebExt()),
                            arcname=os.path.join("OEBPS", "images", "cover."+songbook.imageWebExt()))


def main():
    target_dir = os.path.join(sb.repo_dir(), "build")  # gdzie ma utworzyć epub
    songbook_file = os.path.join(sb.repo_dir(), "songbooks/default.songbook.yaml") if len(sys.argv) == 1 else sys.argv[1]
    songbook = sb.load_songbook_spec_from_yaml(songbook_file)

    # które piosenki chcę zawrzeć w śpiewniku (może być katalogiem z plikami xml lub listą plików)
    create_full_epub(songbook, target_dir)
    package_epub(songbook, target_dir, target_file=songbook.id()+".epub")


if __name__ == "__main__":
    main()
