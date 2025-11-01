# Tworzy piosenki w xhtml
import os
import copy
from lxml import etree
import src.lib.read_song_xml as rsx
from .song_converter import SongConverter
from .song_utils import create_list_of_songs, create_all_songs_html, create_all_songs_html_from_dir
from .html_converter_utils import interpret, replace_in_file


class StandardHtmlConverter(SongConverter):
    def _get_line_text(self, row):
        """Helper to get clean text without chords"""
        return ''.join(chunk.content if chunk.content else ' ' for chunk in row.chunks)

    def _add_chunk(self, chunk, parent, position):
        """Add chord and text with accessibility attributes"""
        if chunk.chord:
            span_ch = etree.SubElement(parent, "span", attrib={
                "class": "chord",
                "role": "note",
                "aria-label": f"chord {chunk.chord}",
                # Optional: hide from indexing/screen readers
                # "aria-hidden": "true",
                "data-chord": chunk.chord  # Preserve chord info for scripts
            })
            span_ch.text = chunk.chord

        # Add text directly to parent with aria role
        text_content = chunk.content if chunk.content else ' '
        if position == 0 and not chunk.content.startswith(' '):
            text_content = ' ' + text_content
            
        if parent.text is None:
            parent.text = text_content
        else:
            last_child = parent[-1] if len(parent) > 0 else None
            if last_child is not None:
                last_child.tail = text_content
            else:
                parent.text = parent.text + text_content

    def _add_lyric(self, row, parent):
        """Add line with accessibility role and title"""
        div_line = etree.SubElement(parent, "div", attrib={
            "class": "line",
            "role": "text",
            "aria-label": "lyrics line",
            "title": self._get_line_text(row)
        })
        for i, chunk in enumerate(row.chunks):
            self._add_chunk(chunk, div_line, i)

    def _add_chords(self, row, parent, class_name):
        """Add side chords if present"""
        if row.sidechords:
            div_sidechords = etree.SubElement(parent, "div", attrib={"class": "sidechords"})
            for chunk in row.sidechords.split(" "):
                span_ch = etree.SubElement(div_sidechords, "span", attrib={"class": "chord"})
                span_ch.text = chunk

    def _add_row(self, row, parent):
        """class row -> html div row with content"""
        if (row.new_chords == 0) or (row.new_chords is False):
            chords_over = "over_false"
        else:
            chords_over = "over_true"
        div_row = etree.SubElement(parent, "div", attrib={"class": "row " + chords_over})
        div_row.text = u'\u200d' # Not visible spaces -> forces the row to be generated as a single line. We remove it in post-processing.
        self._add_chords(row, div_row, "chords")
        self._add_lyric(row, div_row)
        if str(type(row.bis)) == "<class \'bool\'>" and row.bis is True:
            span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
            span_bis.text =  u'\u00a0'
        elif str(type(row.bis)) == "<class \'int\'>":
            span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
            span_bis.text = 'x' + str(row.bis)
        else:
            span_unbis = etree.SubElement(div_row, "span", attrib={"class": "bis_inactive"})
            span_unbis.text =u'\u00a0'

    def _add_instrumental_row(self, row, parent):
        """class row instrumental-> html div row with content"""
        div_row = etree.SubElement(parent, "div", attrib={"class": "row"})
        if str(type(row.bis)) == "<class \'bool\'>" and row.bis is True:
            self._add_chords(row, div_row, "chords_ins")
            _ = etree.SubElement(div_row, "span", attrib={"class": "lyric"})
            span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
            span_bis.text = u'\u00a0'
        elif str(type(row.bis)) == "<class \'int\'>":
            self._add_chords(row, div_row, "chords_ins")
            _ = etree.SubElement(div_row, "span", attrib={"class": "lyric"})
            span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
            span_bis.text = 'x' + str(row.bis)
        else:
            self._add_chords(row, div_row, "chords_ins")
            _ = etree.SubElement(div_row, "span", attrib={"class": "lyric"})
            span_unbis = etree.SubElement(div_row, "span", attrib={"class": "bis_inactive"})
            span_unbis.text = u'\u00a0'

    def _add_block(self, block, parent, block_type, verse_cnt):
        """class verse -> html div verse/chorus/other with content"""
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
        body_song = parent.find("body")
        """class song -> html div body # blok z metadanymi o piosence i piosenką"""
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

        if song.comment:
            div = etree.SubElement(body_song, "div", attrib={"class": "comment"})
            span_content = etree.SubElement(div, "span", attrib={"class": "comment"})
            span_content.text = song.comment


    def xml2html(self, src_xml_path, path_out, song_suffix=None, song_prefix=None, song_head=None, substitions={}):
        xhtml_namespace = "http://www.w3.org/1999/xhtml"
        epub_namespace = "http://www.idpf.org/2007/ops"
        xhtml = "{%s}" % xhtml_namespace
        nsmap = {None: xhtml_namespace,
                 "epub": epub_namespace}

        song = rsx.parse_song_xml(src_xml_path)
        root_html = etree.Element(xhtml + "html", nsmap=nsmap)
        root_html.attrib[etree.QName("lang")] = "pl-PL"
        head = etree.SubElement(root_html, "head")
        etree.SubElement(head, "link",
                         attrib={"rel": "stylesheet", "type": "text/css", "href": "CSS/song_common.css", "media": "all"})
        etree.SubElement(head, "link",
                         attrib={"rel": "stylesheet", "type": "text/css", "href": "CSS/song.css", "media": "all"})
        etree.SubElement(head, "meta", attrib={"name": "viewport", "content": "width=device-width, initial-scale=0.8"})
        
        for s in song_head:
           head.append(interpret(copy.deepcopy(s), substitions))

        body = etree.SubElement(root_html, "body", attrib={"class": "song", etree.QName("http://www.idpf.org/2007/ops", "type"):"bodymatter"})
        for s in song_prefix:
           body.append(interpret(copy.deepcopy(s), substitions))

        self._add_blocks(song, root_html)
        title = etree.SubElement(head, "title")
        title.text = song.title
        et = etree.ElementTree(root_html)
        for s in song_suffix:
           body.append(interpret(copy.deepcopy(s), substitions))

        et.write(path_out, doctype='<!DOCTYPE html>', pretty_print=True, method='xml', encoding='utf-8', xml_declaration=True)

        replace_in_file(path_out, path_out, lambda s: s.replace(u'\u200d', '').replace(" </span>", "<span class='ws'>_</span></span>").replace('<span class="content-i"> ', '<span class="content-i"><span class="ws">_</span>'))
