# Standard HTML song converter
import os
import copy
from lxml import etree
import src.lib.read_song_xml as rsx
from .song_converter import SongConverter
from .song_utils import create_list_of_songs, create_all_songs_html, create_all_songs_html_from_dir
from .html_converter_utils import interpret, replace_in_file


class StandardHtmlConverter(SongConverter):
    def extension(self):
        """Return 'html' for standard HTML output"""
        return 'html'

    def _add_chunk_group(self, chunks, parent, position):
        """Add a group of chunks that share the same position in text"""
        # Debug comment showing chunk group content
        # parent.append(etree.Comment(', '.join(str(c).replace(u'-', '_') for c in chunks)))

        # Callect all chords and create chord stack
        chords = [c.chord for c in chunks if c.chord]
        # concatenate all content
        content = ''
        for c in chunks:
            if c.content:
                content += c.content
        if chords:  # If there are any chords
            span_stack = etree.SubElement(parent, "span", attrib={"class": "ch-stack", "aria-hidden": "true"})
            for chord in chords:
                span_ch = etree.SubElement(span_stack, "span", attrib={
                    "class": "ch",
                    "role": "note",
                    "aria-label": f"chord {chord}"
                })
                span_ch.text = chord
            span_stack.tail = content if content else ''
        else:
            # if there is previous element, append to tail
            last_child = parent[-1] if len(parent) > 0 else None
            if last_child is not None:
                last_child.tail = (last_child.tail or '') + content 
            else:
                parent.text = (parent.text or '') + content

    def _add_lyric(self, row, parent, chords_over_bool):
        """Add line grouping chunks by position"""
        div_line = etree.SubElement(parent, "div", attrib={"class": "lyric"})

        if chords_over_bool:
            i = 0
            chunks = row.chunks
            while i < len(chunks):
                group = []
                while i < len(chunks) and not chunks[i].content:
                        group.append(chunks[i])
                        i += 1
                if i < len(chunks):
                    group.append(chunks[i])
                    i += 1
                self._add_chunk_group(group, div_line, len(div_line))
        else:
            t = ''
            for chunk in row.chunks:
                t += chunk.content
            div_line.text = t


    def _add_chords(self, row, parent, class_name):
        """class chords -> html span ch"""
        span_chords = etree.SubElement(parent, "span", attrib={"class": class_name, "aria-hidden": "true"})
        if row.sidechords:
            for chunk in row.sidechords.split(" "):
                span_ch = etree.SubElement(span_chords, "span", attrib={"class": "ch"})
                span_ch.text = chunk
        else:
            for chunk in row.chunks:
                if len(chunk.chord) > 0:
                    span_ch = etree.SubElement(span_chords, "span", attrib={"class": "ch"})
                    span_ch.text = chunk.chord

    def _add_instrumental_row(self, row, parent):
        """class row instrumental-> html div row with content"""
        div_row = etree.SubElement(parent, "div", attrib={"class": "row"})
        if str(type(row.bis)) == "<class \'bool\'>" and row.bis is True:
            self._add_chords(row, div_row, "chords_ins")
            span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
            span_bis.text = u'\u00a0'
        elif str(type(row.bis)) == "<class \'int\'>":
            self._add_chords(row, div_row, "chords_ins")
            span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
            span_bis.text = 'x' + str(row.bis)
        else:
            self._add_chords(row, div_row, "chords_ins")
            span_unbis = etree.SubElement(div_row, "span", attrib={"class": "bis_inactive"})
            span_unbis.text = u'\u00a0'

    def _add_row(self, row, parent):
        """class row -> html div row with content"""
        chords_over_bool = not ((row.new_chords == 0) or (row.new_chords is False))
        chords_over = "over_true" if chords_over_bool else "over_false"
        div_row = etree.SubElement(parent, "div", attrib={"class": "row " + chords_over})
        div_row.text = u'\u200d' # Not visible spaces -> forces the row to be generated as a single line. We remove it in post-processing.
        self._add_chords(row, div_row, "chords")
        self._add_lyric(row, div_row, chords_over_bool)
        if str(type(row.bis)) == "<class \'bool\'>" and row.bis is True:
            span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
            span_bis.text =  u'\u00a0'
        elif str(type(row.bis)) == "<class \'int\'>":
            span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
            span_bis.text = 'x' + str(row.bis)
        else:
            span_unbis = etree.SubElement(div_row, "span", attrib={"class": "bis_inactive"})
            span_unbis.text =u'\u00a0'

    def _add_block(self, block, parent, block_type, verse_cnt):
        """Add verse with grid layout structure"""
        div_verse = etree.SubElement(parent, "div", attrib={"class": block_type})

        for ro in block.rows:
            if ro.instr:
                self._add_instrumental_row(ro, div_verse)
            else:
                self._add_row(ro, div_verse)

    def _add_creator(self, creator, describe, parent):
        """class creator -> html div creator # metadane piosenki"""
        div = etree.SubElement(parent, "div", attrib={"class": "creator"})
        span_label = etree.SubElement(div, "span", attrib={"class": "label"})
        span_label.text = describe
        span_content = etree.SubElement(div, "span", attrib={"class": "content_creator"})
        span_content.text = creator

    def _add_blocks(self, song, parent):
        """class song -> html div body # blok z metadanymi o piosence i piosenką"""
        body_song = parent.find("body")
        h1_title = etree.SubElement(body_song, "h1", attrib={"class": "title", "id": "title"})
        h1_title.text = song.title
        if song.original_title:
            self._add_creator(song.original_title, "Tytuł oryginalny: ", body_song)
        if song.alias:
            self._add_creator(song.alias, "Tytuł alternatywny: ", body_song)
        if song.text_author:
            self._add_creator(song.text_author, "Słowa: ", body_song)
        if song.translator:
            self._add_creator(song.translator, "Tłumaczenie: ", body_song)
        if song.composer:
            self._add_creator(song.composer, "Muzyka: ", body_song)
        if song.music_source:
            self._add_creator(song.music_source, "Melodia oparta na: ", body_song)
        if song.artist:
            self._add_creator(song.artist, "Wykonawca: ", body_song)
        if song.album:
            self._add_creator(song.album, "Album: ", body_song)
        if song.metre:
            self._add_creator(song.metre, "Metrum: ", body_song)
        if song.barre and int(song.barre) > 0:
            self._add_creator(song.barre, "Kapodaster: ", body_song)

        corpse = etree.SubElement(body_song, "div", attrib={"class": "song_body", "id": "song_body"})
        verse_cnt = 0
        for block in song.blocks:
            if block.block_type.value == 'V':
                b_type = "verse"
                verse_cnt = verse_cnt + 1
            elif block.block_type.value == 'C':
                b_type = "chorus"
            else:
                b_type = "other"
            blockid=""
            if b_type == "verse":
                blockid=str(verse_cnt) + "."
            if b_type == "chorus":
                blockid="Ref:"


            spacer = etree.SubElement(corpse, "div", attrib={"class": "block_spacer"})
            block_id = etree.SubElement(spacer, "span", attrib={"class": "block_id"})
            block_id.text = blockid
            self._add_block(block, corpse, b_type, verse_cnt)

    def _detect_language(self, song, src_xml_path):
        """Detect language from song metadata or XML file, returning (lang, lang_code) tuple"""
        lang = "pl-PL"
        lang_code = "pl"
        
        # Check multiple possible attribute names for language
        song_lang = None
        for attr in ['lang', 'language', 'xml_lang']:
            if hasattr(song, attr) and getattr(song, attr):
                song_lang = getattr(song, attr)
                break
        
        # If still no lang found, try to read directly from XML file
        if not song_lang:
            try:
                from lxml import etree as xml_etree
                xml_tree = xml_etree.parse(src_xml_path)
                xml_root = xml_tree.getroot()
                song_lang = xml_root.get('lang') or xml_root.get('{http://www.w3.org/XML/1998/namespace}lang')
            except:
                pass
        
        if song_lang:
            # Map language codes
            lang_map = {
                'pl': ('pl-PL', 'pl'),
                'en': ('en-US', 'en'),
                'de': ('de-DE', 'de'),
                'fr': ('fr-FR', 'fr'),
                'es': ('es-ES', 'es'),
                'it': ('it-IT', 'it')
            }
            mapped = lang_map.get(song_lang.lower(), None)
            if mapped:
                lang, lang_code = mapped
            else:
                lang_code = song_lang.lower()
                lang = f"{lang_code}-{lang_code.upper()}"
        
        return lang, lang_code

    def xml2html(self, src_xml_path, path_out, song_suffix=None, song_prefix=None, song_head=None, substitions={}):
        song = rsx.parse_song_xml(src_xml_path)
        
        # Determine language from song metadata or default to Polish
        lang, lang_code = self._detect_language(song, src_xml_path)
        
        root_html = etree.Element("html")
        root_html.attrib["lang"] = lang
        head = etree.SubElement(root_html, "head")
        etree.SubElement(head, "meta", attrib={"charset": "utf-8"})
        etree.SubElement(head, "meta", attrib={"name": "viewport", "content": "width=device-width, initial-scale=0.8"})
        
        # SEO meta tags
        title_text = song.title
        if song.artist:
            title_text = f"{song.title} - {song.artist}"
        
        # Localized description text
        desc_text = "Tekst i chwyty piosenki" if lang_code == 'pl' else "Lyrics and chords for"
        etree.SubElement(head, "meta", attrib={"name": "description", "content": f"{desc_text} {title_text}"})
        etree.SubElement(head, "meta", attrib={"property": "og:title", "content": title_text})
        etree.SubElement(head, "meta", attrib={"property": "og:type", "content": "music.song"})
        
        if song.artist:
            etree.SubElement(head, "meta", attrib={"name": "author", "content": song.artist})
        
        # Extract plain lyrics for SEO
        plain_lyrics = song.extract_plain_lyrics()
        
        # JSON-LD structured data for rich snippets with lyrics
        script_ld = etree.SubElement(head, "script", attrib={"type": "application/ld+json"})
        ld_json = {
            "@context": "https://schema.org",
            "@type": "MusicComposition",
            "name": song.title,
            "inLanguage": lang_code
        }
        if song.composer:
            ld_json["composer"] = {"@type": "Person", "name": song.composer}
        if song.text_author:
            ld_json["lyricist"] = {"@type": "Person", "name": song.text_author}
        if song.artist:
            ld_json["author"] = {"@type": "Person", "name": song.artist}
        if plain_lyrics:
            ld_json["lyrics"] = {
                "@type": "CreativeWork",
                "text": plain_lyrics
            }
        
        import json
        script_ld.text = json.dumps(ld_json, ensure_ascii=False, indent=2)
        
        etree.SubElement(head, "link",
                         attrib={"rel": "stylesheet", "type": "text/css", "href": "CSS/song_common.css", "media": "all"})
        etree.SubElement(head, "link",
                         attrib={"rel": "stylesheet", "type": "text/css", "href": "CSS/song.css", "media": "all"})
        
        for s in song_head:
           head.append(interpret(copy.deepcopy(s), substitions))

        body = etree.SubElement(root_html, "body", attrib={"class": "song"})
        for s in song_prefix:
           body.append(interpret(copy.deepcopy(s), substitions))

        self._add_blocks(song, root_html)
        title = etree.SubElement(head, "title")
        title.text = title_text
        et = etree.ElementTree(root_html)
        for s in song_suffix:
           body.append(interpret(copy.deepcopy(s), substitions))

        et.write(path_out, doctype='<!DOCTYPE html>', pretty_print=True, method='html', encoding='utf-8')

        replace_in_file(path_out, path_out, lambda s: s.replace(u'\u200d', ''))
