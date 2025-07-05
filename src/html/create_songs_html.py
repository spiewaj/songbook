# Tworzy piosenki w xhtml
import os
import copy
from lxml import etree
import src.lib.read_song_xml as rsx


def _add_chunk(chunk, parent, position):
    """class chunk -> html span chunk"""
    span_chunk = etree.SubElement(parent, "span", attrib={"class": "chunk"})
    chord = etree.SubElement(span_chunk, "span", attrib={"class": "chord"})
    span_ch = etree.SubElement(chord, "span", attrib={"class": "ch"})
    span_ch.text = chunk.chord
    span_content = etree.SubElement(span_chunk, "span", attrib={"class": "content"})
    # Nested spans help with formatting as table.
    span_content = etree.SubElement(span_content, "span", attrib={"class": "content-i"})
    if position == 0:
        if chunk.content.startswith(' '):
            span_content.text = chunk.content
        else:
            span_content.text = ' ' + chunk.content
    else:
        span_content.text = chunk.content


def _add_lyric(row, parent):
    """class lyric -> html span lyric"""
    span_lyric = etree.SubElement(parent, "span", attrib={"class": "lyric"})
    for i, chunk in enumerate(row.chunks):
        _add_chunk(chunk, span_lyric, i)


def _add_chords(row, parent, class_name):
    """class chords -> html span ch"""
    span_chords = etree.SubElement(parent, "span", attrib={"class": class_name})
    if row.sidechords:
        for chunk in row.sidechords.split(" "):
            span_ch = etree.SubElement(span_chords, "span", attrib={"class": "ch"})
            span_ch.text = chunk
    else:
        for chunk in row.chunks:
            if len(chunk.chord) > 0:
                span_ch = etree.SubElement(span_chords, "span", attrib={"class": "ch"})
                span_ch.text = chunk.chord


def _add_bis(row, div_row):
    if str(type(row.bis)) == "<class \'bool\'>" and row.bis is True:
        span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
        span_bis.text = u'\u00a0'
    elif str(type(row.bis)) == "<class \'int\'>":
        span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
        span_bis.text = 'x' + str(row.bis)
    else:
        span_unbis = etree.SubElement(div_row, "span", attrib={"class": "bis_inactive"})
        span_unbis.text = u'\u00a0'


def _add_row(row, parent):
    """class row -> html div row with content"""
    if (row.new_chords == 0) or (row.new_chords is False):
        chords_over = "over_false"
    else:
        chords_over = "over_true"
    div_row = etree.SubElement(parent, "div", attrib={"class": "row " + chords_over})
    div_row.text = u'\u200d' # Not visible spaces -> forces the row to be generated as a single line. We remove it in post-processing.
    _add_chords(row, div_row, "chords")
    _add_lyric(row, div_row)
    if str(type(row.bis)) == "<class \'bool\'>" and row.bis is True:
        span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
        span_bis.text =  u'\u00a0'
    elif str(type(row.bis)) == "<class \'int\'>":
        span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
        span_bis.text = 'x' + str(row.bis)
    else:
        span_unbis = etree.SubElement(div_row, "span", attrib={"class": "bis_inactive"})
        span_unbis.text =u'\u00a0'

def _add_instrumental_row(row, parent):
    """class row instrumental-> html div row with content"""
    div_row = etree.SubElement(parent, "div", attrib={"class": "row"})
    if str(type(row.bis)) == "<class \'bool\'>" and row.bis is True:
        _add_chords(row, div_row, "chords_ins")
        _ = etree.SubElement(div_row, "span", attrib={"class": "lyric"})
        span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
        span_bis.text = u'\u00a0'
    elif str(type(row.bis)) == "<class \'int\'>":
        _add_chords(row, div_row, "chords_ins")
        _ = etree.SubElement(div_row, "span", attrib={"class": "lyric"})
        span_bis = etree.SubElement(div_row, "span", attrib={"class": "bis_active"})
        span_bis.text = 'x' + str(row.bis)
    else:
        _add_chords(row, div_row, "chords_ins")
        _ = etree.SubElement(div_row, "span", attrib={"class": "lyric"})
        span_unbis = etree.SubElement(div_row, "span", attrib={"class": "bis_inactive"})
        span_unbis.text = u'\u00a0'

def _add_block(block, parent, block_type, verse_cnt):
    """class verse -> html div verse/chorus/other with content"""
    div_verse = etree.SubElement(parent, "div", attrib={"class": block_type})

    for ro in block.rows:
        if ro.instr:
            _add_instrumental_row(ro, div_verse)
        else:
            _add_row(ro, div_verse)


def _add_creator(creator, describe, parent):
    """class creator -> html div creator # metadane piosenki"""
    div = etree.SubElement(parent, "div", attrib={"class": "creator"})
    span_label = etree.SubElement(div, "span", attrib={"class": "label"})
    span_label.text = describe
    span_content = etree.SubElement(div, "span", attrib={"class": "content_creator"})
    span_content.text = creator

def _add_blocks(song, parent):
    body_song = parent.find("body")
    """class song -> html div body # blok z metadanymi o piosence i piosenką"""
    h1_title = etree.SubElement(body_song, "h1", attrib={"class": "title", "id": "title"})
    h1_title.text = song.title
    if song.original_title:
        _add_creator(song.original_title, "Tytuł oryginalny: ", body_song)
    if song.alias:
        _add_creator(song.alias, "Tytuł alternatywny: ", body_song)
    if song.text_author:
        _add_creator(song.text_author, "Słowa: ", body_song)
    if song.translator:
        _add_creator(song.translator, "Tłumaczenie: ", body_song)
    if song.composer:
        _add_creator(song.composer, "Muzyka: ", body_song)
    if song.music_source:
        _add_creator(song.music_source, "Melodia oparta na: ", body_song)
    if song.artist:
        _add_creator(song.artist, "Wykonawca: ", body_song)
    if song.album:
        _add_creator(song.album, "Album: ", body_song)
    if song.metre:
        _add_creator(song.metre, "Metrum: ", body_song)
    if song.barre and int(song.barre) > 0:
        _add_creator(song.barre, "Kapodaster: ", body_song)

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
        _add_block(block, corpse, b_type, verse_cnt)

    if song.comment:
        div = etree.SubElement(body_song, "div", attrib={"class": "comment"})
        span_content = etree.SubElement(div, "span", attrib={"class": "comment"})
        span_content.text = song.comment

def substitute_from_dict(text, replacements):
    """
    Substitutes placeholders in a string with values from a dictionary.

    Args:
        text (str): The input string containing placeholders (e.g., '{{placeholder}}').
        replacements (dict): A dictionary where keys are the placeholders to find
                             and values are the strings to substitute them with.

    Returns:
        str: The string with all placeholders substituted.
    """
    for old_string, new_string in replacements.items():
        text = text.replace(old_string, new_string)
    return text


def interpret(c, substitions):
    # recursively replace in c all attributes and texts that contains keys from substitions with provided values.
    if isinstance(c, etree._Element):
        for attr in c.attrib:
            c.attrib[attr] = substitute_from_dict(c.attrib[attr], substitions)
        for child in c:
            interpret(child, substitions)
        if c.text:
            c.text = substitute_from_dict(c.text, substitions)
    return c


def xml2html(src_xml_path, path_out, song_suffix = None, song_prefix = None, song_head = None, substitions={}):  # tworzy piosenkę w wersji html

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

    _add_blocks(song, root_html)
    title = etree.SubElement(head, "title")
    title.text = song.title
    et = etree.ElementTree(root_html)
    for s in song_suffix:
       body.append(interpret(copy.deepcopy(s), substitions))

    et.write(path_out, doctype='<!DOCTYPE html>', pretty_print=True, method='xml', encoding='utf-8', xml_declaration=True)

    replace_in_file(path_out, path_out, lambda s: s.replace(u'\u200d', '').replace(" </span>", "<span class='ws'>_</span></span>").replace('<span class="content-i"> ', '<span class="content-i"><span class="ws">_</span>'))

def replace_in_file(sourceFile, targetFile, f):
    with open(sourceFile, 'r') as file:
        filedata = file.read()

    # Replace the target string
    filedata = f(filedata)

    # Write the file out again
    with open(targetFile, 'w') as file:
        file.write(filedata)

def create_list_of_songs(song_set):
    """ Dostaje jako argument listę piosenek lub ścieżkę do katalogu i zwraca listę piosenek """
    if str(type(song_set)) == "<class 'list'>":
        for i in range(len(song_set)):
            if song_set[i][-4:] == '.xml':
                song_set[i] = song_set[i][0:-4]
        return song_set
    else:
        songs_list = os.listdir(song_set)
        for i in range(len(songs_list)):
            if songs_list[i][-4:] == '.xml':
                songs_list[i] = songs_list[i][0:-4]
        return songs_list


def create_all_songs_html_from_dir(path_in, path_out, song_suffix=[]):
    """Tworzy wszystkie piosenki z listy w formacie html w katalogu path_out"""

    return create_all_songs_html( create_list_of_songs(path_in), path_out, song_suffix)

def create_all_songs_html(list_of_songs, path_out, song_suffix=[], song_prefix=[], song_head=[], substitions={}):
    """Tworzy wszystkie piosenki z listy w formacie html w katalogu path_out"""

    if not os.path.exists(path_out):
        os.mkdir(path_out)

    for song in list_of_songs:
        if not song.is_alias():
            relative_path = os.path.relpath(song.plik(), start=os.path.join(os.path.dirname(__file__), "../../songs"))
            xml2html(song.plik(), os.path.join(path_out,  song.base_file_name() + '.xhtml'), song_suffix=song_suffix, song_prefix=song_prefix, song_head=song_head, substitions=substitions | {"{{SRC}}": relative_path})
