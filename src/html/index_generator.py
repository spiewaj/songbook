import datetime
import os
import sys
import src.lib.songbook as sb
from lxml import etree
import logging

# def name_of_file(song):
#     return os.path.splitext(os.path.split(song)[1])[0]
def create_index_html(list_of_songs_meta, target_dir):
    tmp_path = 'index.html'
    out_path = os.path.join(target_dir, tmp_path)
    
    # Try to parse as HTML first, fall back to XHTML if needed
    template_path = os.path.join(sb.repo_dir(), "./src/html/templates/index.xhtml")
    parser = etree.HTMLParser()
    tree = etree.parse(template_path, parser)

    # Add SEO meta tags to head
    head = tree.getroot().find(".//head")
    if head is None:
        head = tree.getroot().find(".//{http://www.w3.org/1999/xhtml}head")
    
    if head is not None:
        # Add charset and viewport if not present
        if head.find(".//meta[@charset]") is None:
            etree.SubElement(head, "meta", attrib={"charset": "utf-8"}, nsmap=None).tail = "\n"
        
        # Add canonical URL
        etree.SubElement(head, "link", attrib={"rel": "canonical", "href": "https://spiewaj.com/"}, nsmap=None).tail = "\n"
        
        # Add meta description with keywords
        desc_meta = etree.SubElement(head, "meta", attrib={
            "name": "description",
            "content": "Śpiewnik harcerski online - teksty i chwyty gitarowe piosenek harcerskich, biesiadnych, turystycznych i obozowych. Darmowy śpiewnik z akordami do druku (PDF) i na Kindle (EPUB)."
        }, nsmap=None)
        desc_meta.tail = "\n"
        
        # Add keywords
        etree.SubElement(head, "meta", attrib={
            "name": "keywords",
            "content": "śpiewnik harcerski, teksty piosenek, chwyty gitarowe, akordy, piosenki harcerskie, piosenki biesiadne, piosenki turystyczne, śpiewnik pdf, śpiewnik kindle"
        }, nsmap=None).tail = "\n"
        
        # Add Open Graph tags
        etree.SubElement(head, "meta", attrib={"property": "og:title", "content": "Spiewaj.com - Śpiewnik harcerski online"}, nsmap=None).tail = "\n"
        etree.SubElement(head, "meta", attrib={"property": "og:type", "content": "website"}, nsmap=None).tail = "\n"
        etree.SubElement(head, "meta", attrib={"property": "og:url", "content": "https://spiewaj.com/"}, nsmap=None).tail = "\n"
        etree.SubElement(head, "meta", attrib={"property": "og:description", "content": "Śpiewnik harcerski - teksty i chwyty piosenek"}, nsmap=None).tail = "\n"
        etree.SubElement(head, "meta", attrib={"property": "og:locale", "content": "pl_PL"}, nsmap=None).tail = "\n"
        etree.SubElement(head, "meta", attrib={"property": "og:site_name", "content": "Spiewaj.com"}, nsmap=None).tail = "\n"
        
        # Add Twitter Card tags
        etree.SubElement(head, "meta", attrib={"name": "twitter:card", "content": "summary"}, nsmap=None).tail = "\n"
        etree.SubElement(head, "meta", attrib={"name": "twitter:title", "content": "Spiewaj.com - Śpiewnik harcerski online"}, nsmap=None).tail = "\n"
        etree.SubElement(head, "meta", attrib={"name": "twitter:description", "content": "Śpiewnik harcerski - teksty i chwyty piosenek"}, nsmap=None).tail = "\n"
        
        # Add JSON-LD structured data with BreadcrumbList and ItemList
        script_ld = etree.SubElement(head, "script", attrib={"type": "application/ld+json"}, nsmap=None)
        import json
        ld_json = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Spiewaj.com",
            "alternateName": "Śpiewnik",
            "url": "https://spiewaj.com/",
            "description": "Śpiewnik - teksty i chwyty piosenek popularnych, harcerskich, turystycznych",
            "inLanguage": "pl-PL",
            "potentialAction": {
                "@type": "SearchAction",
                "target": "https://spiewaj.com/#songSearch={search_term_string}",
                "query-input": "required name=search_term_string"
            }
        }
        script_ld.text = json.dumps(ld_json, ensure_ascii=False, indent=2)
        script_ld.tail = "\n"

    # List of songs - try both HTML and XHTML namespaces
    ul = tree.getroot().find(".//ul[@id='songs']")
    if ul is None:
        ul = tree.getroot().find(".//{http://www.w3.org/1999/xhtml}ul[@id='songs']")
    for i in range(len(list_of_songs_meta)):
        song = list_of_songs_meta[i]
        if song.is_alias():
            continue
        song_html = os.path.join("./songs_html", song.base_file_name() + '.html')
        li = etree.SubElement(ul, "li")
        
        # Main anchor wrapping the title - SEO-friendly structure
        a_main = etree.SubElement(li, "a")
        a_main.attrib['class'] = 'song-link'
        a_main.attrib['href'] = song_html
        
        # Build descriptive title attribute for SEO
        title_text = song.effectiveTitle()
        if song.artist():
            a_main.attrib['title'] = f"{title_text} - {song.artist()} - tekst i chwyty"
        else:
            a_main.attrib['title'] = f"{title_text} - tekst i chwyty"
        
        # Edit button (outside main link for event handling)
        button = etree.SubElement(li, "button")
        button.attrib['class'] = 'editicon'
        button.attrib['onclick'] = "edit('"+os.path.relpath(song.plik(), start=os.path.join(sb.repo_dir(), "songs"))+"');event.stopPropagation();"
        button.attrib['aria-label'] = f"Edytuj {title_text}"
        span = etree.SubElement(button, 'span')
        span.attrib['class'] = 'material-symbols-outlined'
        span.attrib['aria-hidden'] = 'true'
        span.text = 'edit'
        
        # A4 PDF link
        a_a4 = etree.SubElement(li, "a")
        a_a4.attrib['class'] = 'pdflink'
        a_a4.attrib['href'] = f"./songs_pdf/{song.base_file_name()}.a4.pdf"
        a_a4.attrib['target'] = '_blank'
        a_a4.attrib['rel'] = 'noopener'
        a_a4.attrib['title'] = f"{title_text} - PDF A4"
        a_a4.attrib['aria-label'] = f"Pobierz {title_text} PDF A4"
        a_a4.attrib['onclick'] = 'event.stopPropagation();'
        span_a4 = etree.SubElement(a_a4, 'span')
        span_a4.attrib['class'] = 'material-symbols-outlined'
        span_a4.attrib['aria-hidden'] = 'true'
        span_a4.text = 'picture_as_pdf'
        text_a4 = etree.SubElement(a_a4, 'span')
        text_a4.attrib['class'] = 'pdf-label'
        text_a4.text = 'A4'
        
        # A5 PDF link
        a_a5 = etree.SubElement(li, "a")
        a_a5.attrib['class'] = 'pdflink'
        a_a5.attrib['href'] = f"./songs_pdf/{song.base_file_name()}.a5.pdf"
        a_a5.attrib['target'] = '_blank'
        a_a5.attrib['rel'] = 'noopener'
        a_a5.attrib['title'] = f"{title_text} - PDF A5"
        a_a5.attrib['aria-label'] = f"Pobierz {title_text} PDF A5"
        a_a5.attrib['onclick'] = 'event.stopPropagation();'
        span_a5 = etree.SubElement(a_a5, 'span')
        span_a5.attrib['class'] = 'material-symbols-outlined'
        span_a5.attrib['aria-hidden'] = 'true'
        span_a5.text = 'picture_as_pdf'
        text_a5 = etree.SubElement(a_a5, 'span')
        text_a5.attrib['class'] = 'pdf-label'
        text_a5.text = 'A5'
        
        # Title span inside main link
        title_span = etree.SubElement(a_main, "span")
        title_span.attrib['class'] = 'title'
        title_span.text = title_text
        
        # Aliases inside main link
        for song_alias in song.aliases():
            alias = etree.SubElement(a_main, "span", attrib={"class": "alias"})
            alias.text = song_alias
            
        # Artist inside main link
        if song.artist():
            artist = etree.SubElement(a_main, "span", attrib={"class": "artist"})
            artist.text = song.artist()
        
        # Add onclick to li for backward compatibility with existing CSS/JS
        li.attrib['onclick'] = "if(event.target.tagName.toLowerCase() !== 'a' && event.target.tagName.toLowerCase() !== 'button' && !event.target.closest('a') && !event.target.closest('button')) { location.href='"+song_html+"'; }"

    # List of songbooks - try both HTML and XHTML namespaces
    ul = tree.getroot().find(".//ul[@id='songbooks']")
    if ul is None:
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
    # Update html lang attribute
    html_root = tree.getroot()
    if html_root.tag == 'html' or html_root.tag.endswith('}html'):
        html_root.attrib['lang'] = 'pl-PL'
    
    et = etree.ElementTree(tree.getroot())
    et.write(out_path, pretty_print=True, method='html', encoding='utf-8')


def create_sitemap_xml(list_of_songs_meta, target_dir):
    sitemap_path = os.path.join(target_dir, "sitemap.xml")
    root = etree.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    base = "https://spiewaj.com/"
    for song in list_of_songs_meta:
        if song.is_alias():
            continue
        # Add HTML version of the song
        url = etree.SubElement(root, "url")
        loc = etree.SubElement(url, "loc")
        loc.text = os.path.join(base, "songs_html", song.base_file_name() + ".html")
        lastmod = etree.SubElement(url, "lastmod")
        lastmod.text =  datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S+00:00")
        changefreq = etree.SubElement(url, "changefreq")
        changefreq.text = "weekly"
        
        # Add A4 and A5 PDF versions of the song
        for format in ["a4", "a5"]:
            url = etree.SubElement(root, "url")
            loc = etree.SubElement(url, "loc")
            loc.text = os.path.join(base, "songs_pdf", f"{song.base_file_name()}.{format}.pdf")
            lastmod = etree.SubElement(url, "lastmod")
            lastmod.text = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S+00:00")
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
                loc.text = os.path.join(base, format.format(songbook.id()))
                lastmod = etree.SubElement(url, "lastmod")
                lastmod.text = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S+00:00")
            changefreq = etree.SubElement(url, "changefreq")
            changefreq.text = "monthly"
    
    tree = etree.ElementTree(root)
    tree.write(sitemap_path, pretty_print=True, xml_declaration=True, encoding='utf-8')
    logging.info(f"Sitemap created at {sitemap_path}")

def main():
    songbook_file = os.path.join(sb.repo_dir(), "songbooks/default.songbook.yaml") if len(sys.argv) == 1 else sys.argv[1]
    songbook = sb.load_songbook_spec_from_yaml(songbook_file)
    target_dir = os.path.join(sb.repo_dir(), "build")

    logging.info(f"Generating HTML index in {target_dir} from songbook spec {songbook_file}, song count: {len(songbook.list_of_songs())}")

    create_index_html(songbook.list_of_songs(), target_dir)
    create_sitemap_xml(songbook.list_of_songs(), target_dir)

    index_js_path =os.path.join(target_dir, "index.js")
    if os.path.exists(index_js_path):
        os.remove(index_js_path)
    os.symlink(os.path.join(sb.repo_dir(), 'src', 'html', 'templates', "index.js"), index_js_path)

main()