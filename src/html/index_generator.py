import datetime
import os
import sys
import src.lib.songbook as sb
from lxml import etree

# def name_of_file(song):
#     return os.path.splitext(os.path.split(song)[1])[0]
def create_index_xhtml(list_of_songs_meta, target_dir):
    tmp_path = 'index.xhtml'
    out_path = os.path.join(target_dir, tmp_path)
    tree = etree.parse(os.path.join(sb.repo_dir(), "./src/html/templates/index.xhtml"))

    # List of songs
    ul = tree.getroot().find(".//{http://www.w3.org/1999/xhtml}ul[@id='songs']")
    for i in range(len(list_of_songs_meta)):
        song = list_of_songs_meta[i]
        if song.is_alias():
            continue
        song_html = os.path.join("./songs_html", song.base_file_name() + '.xhtml')
        li = etree.SubElement(ul, "li")
        # entire li is clickable and should navigate to the song
        li.attrib['onclick'] = "location.href='"+song_html+"';"

        # <button onclick='edit("zaciagnijcie_na_oknie_niebieska_zaslone.xhtml")'><span class="material-symbols-outlined">edit</span></button>
        button = etree.SubElement(li, "button")
        button.attrib['class'] = 'editicon'
        button.attrib['onclick'] = "edit('"+os.path.relpath(song.plik(), start=os.path.join(sb.repo_dir(), "songs"))+"');event.stopPropagation();"
        span = etree.SubElement(button, 'span')
        span.attrib['class'] = 'material-symbols-outlined'
        span.text = 'edit'
        a = etree.SubElement(li, "a")
        a.attrib['href'] = song_html
        a.text = list_of_songs_meta[i].effectiveTitle()
        for song_alias in song.aliases():
            alias = etree.SubElement(li, "span", attrib={"class": "alias"})
            alias.text = song_alias
        if song.artist():
            artist = etree.SubElement(li, "span", attrib={"class": "artist"})
            artist.text = song.artist()

    # List of songbooks
    ul = tree.getroot().find(".//{http://www.w3.org/1999/xhtml}ul[@id='songbooks']")
    for songbook in sb.songbooks():
        if not songbook.hidden():
            li = etree.SubElement(ul, "li", attrib={"id": songbook.id()})
            li.text=songbook.title() + ":"
            a_epub = etree.SubElement(ul, "a", attrib={"class": "epub", "href": songbook.id()+".epub"})
            a_epub.text = "EPUB (kindle)"
            a_a5pdf = etree.SubElement(ul, "a", attrib={"class": "pdf", "href": os.path.join("songs_tex", songbook.id()+"_a5.pdf")})
            a_a5pdf.text = "PDF (a5)"
            a_a4pdf = etree.SubElement(ul, "a", attrib={"class": "pdf", "href": os.path.join("songs_tex", songbook.id()+"_a4.pdf")})
            a_a4pdf.text = "PDF (a4)"
    et = etree.ElementTree(tree.getroot())
    et.write(out_path, pretty_print=True, method='xml', encoding='utf-8', xml_declaration=True)


def create_sitemap_xml(list_of_songs_meta, target_dir):
    sitemap_path = os.path.join(target_dir, "sitemap.xml")
    root = etree.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for song in list_of_songs_meta:
        if song.is_alias():
            continue
        url = etree.SubElement(root, "url")
        loc = etree.SubElement(url, "loc")
        loc.text = os.path.join(".", "songs_html", song.base_file_name() + ".xhtml")
        lastmod = etree.SubElement(url, "lastmod")
        lastmod.text =  datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S+00:00")
        changefreq = etree.SubElement(url, "changefreq")
        changefreq.text = "weekly"


    for songbook in sb.songbooks():
        if not songbook.hidden():
            # https://spiewaj.com/dino.epub
            # https://spiewaj.com/songs_tex/dino_a5.pdf
            # https://spiewaj.com/songs_tex/dino_a4.pdf
            for format in ["{}.epub", "songs_tex/{}_a5.pdf", "songs_tex/{}_a4.pdf"]:
                url = etree.SubElement(root, "url")
                loc = etree.SubElement(url, "loc")
                loc.text = os.path.join(".", format.format(songbook.id()))
                lastmod = etree.SubElement(url, "lastmod")
                lastmod.text = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S+00:00")
            changefreq = etree.SubElement(url, "changefreq")
            changefreq.text = "monthly"
    
    tree = etree.ElementTree(root)
    tree.write(sitemap_path, pretty_print=True, xml_declaration=True, encoding='utf-8')
    print(f"Sitemap created at {sitemap_path}")

def main():
    songbook_file = os.path.join(sb.repo_dir(), "songbooks/default.songbook.yaml") if len(sys.argv) == 1 else sys.argv[1]
    songbook = sb.load_songbook_spec_from_yaml(songbook_file)
    target_dir = os.path.join(sb.repo_dir(), "build")

    create_index_xhtml(songbook.list_of_songs(), target_dir)
    create_sitemap_xml(songbook.list_of_songs(), target_dir)

    index_js_path =os.path.join(target_dir, "index.js")
    if os.path.exists(index_js_path):
        os.remove(index_js_path)
    os.symlink(os.path.join(sb.repo_dir(), 'src', 'html', 'templates', "index.js"), index_js_path)

main()