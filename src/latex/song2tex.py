# noinspection PyInterpreter
from lxml import etree
from enum import Enum
import traceback
import sys
import jinja2
import re


def tex_escape(text):
    """
        :param text: a plain text message
        :return: the message escaped to appear correctly in LaTeX
    """
    conv = {
        '&': r'\&',
        '"': "''",
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '^': r'\^{}',
        '\\': r'\textbackslash{}',
        '<': r'\textless{}',
        '>': r'\textgreater{}',
        '...': r'{\dots}'
    }
    if text:
        regex = re.compile('|'.join(re.escape(str(key)) for key in sorted(conv.keys(), key=lambda item: - len(item))))
        return regex.sub(lambda match: conv[match.group()], text)
    else:
        return text


class RowChunk:
    def __init__(self, chord='', content=None):
        self.chord = chord
        if content is None:
            self.content = ''
        else:
            self.content = content.strip('\t\n')


class RowType(Enum):
    FIRST = 'F'
    LAST_BUT_ONE = 'P'
    LAST = 'L'
    INSTRUMENTAL = 'I'
    SHORT = 'S'  # This is shortened chorus usually
    END = 'E'    # The very last row of the song


class Row:
    def __init__(self, row_type='', new_chords=False, bis=False, chunks=[], instr=False, sidechords=None):
        self.row_type = row_type
        self.new_chords = new_chords
        self.chunks = chunks
        self.bis = bis
        self.instr = instr
        self.sidechords = sidechords

    @staticmethod
    def parseDOM(root, bis=False):
        try:
            if root.text:
                chunks = [RowChunk(content=tex_escape(root.text))]
            else:
                chunks = []
            for chunk in root.getchildren():
                chunks.append(RowChunk(chord=tex_escape(chunk.attrib['a']), content=tex_escape(chunk.tail)))
            if len(chunks) > 0 and not (chunks[0].content.startswith(' ')):
                chunks[0].content = ' ' + chunks[0].content

            instr = root.attrib.get('style', 'normal') == 'instr'
            r = Row(new_chords=(root.attrib.get('important_over', 'false')=='true'), bis=bis, chunks=chunks, instr=instr, sidechords=root.attrib.get('sidechords', None))
            if instr:
                r.row_type += RowType.INSTRUMENTAL.value
            return r
        except:
            print("ERROR in ROW: " + str(root), file=sys.stderr)
            raise

    def clone(self):
        return Row(row_type=self.row_type, new_chords=self.new_chords, bis=self.bis, chunks=self.chunks[:], instr=self.instr, sidechords=self.sidechords)


class BlockType(Enum):
    VERSE = 'V'
    CHORUS = 'C'
    OTHER = 'O'

    @staticmethod
    def parse(s):
        return {
            'verse': BlockType.VERSE,
            'chorus': BlockType.CHORUS,
            'other': BlockType.OTHER
        }[s]


class Block:
    def __init__(self, block_type=BlockType.VERSE, rows=[], effective_rows=[]):
        self.block_type = block_type
        self.rows = rows
        self.effective_rows = effective_rows
    
    @staticmethod
    def parseDOM(root, linked=False):
        block_type = BlockType.parse(root.attrib['type'])
        rows = []
        for child in root.getchildren():
            if child.tag == '{http://21wdh.staszic.waw.pl}bis':
                bis_rows = [Row.parseDOM(row, bis=True) for row in child.findall('{*}row')]
                bis_times = int(child.attrib.get('times', '2'))
                bis_rows[-1].bis = bis_times
                rows += bis_rows
            else:
                rows.append(Row.parseDOM(child))
        if len(rows) > 0:
            rows[0].row_type += RowType.FIRST.value
            rows[-1].row_type += RowType.LAST.value
        if len(rows) >= 2:
            rows[-2].row_type += RowType.LAST_BUT_ONE.value
        effective_rows=[]
        if linked:
            for row in rows:
                row.new_chords = False
            for row in rows:
                if not(RowType.INSTRUMENTAL.value in row.row_type):
                  if len(effective_rows) == 0:
                    rowclone = row.clone()
                    rowclone.row_type=RowType.FIRST.value + RowType.LAST.value + RowType.SHORT.value
                    effective_rows = [rowclone]
                  else:
                    effective_rows[0].chunks.append(RowChunk(content=" \dots"))
                    effective_rows[0].bis=False
                    effective_rows[0].sidechords=""
                    break
            if len(effective_rows)==0:
                effective_rows = rows
        else:
            effective_rows=rows
        return Block(block_type=block_type, rows=rows, effective_rows=effective_rows)


def make_one_line(s):
    return s.replace('\n', ' ').replace('\r', ' ').replace(r'  +', ' ') if s else None


class Song:
    def __init__(self, title='', text_author='', composer='', artist='', blocks=[], barre=None, metre=None, genre=None, alias=None):
        self.title = make_one_line(tex_escape(title)) if title else ''
        self.text_author = make_one_line(tex_escape(text_author)) if text_author else ''
        self.composer = make_one_line(tex_escape(composer)) if composer else ''
        self.artist = make_one_line(tex_escape(artist)) if artist else ''
        self.blocks = blocks
        self.barre = barre if barre != '' and barre != '0' and barre != 0 else None
        self.metre = metre
        self.genre = genre
        self.alias = make_one_line(tex_escape(alias))

    @staticmethod
    def parseDOM(root):
        # A child of 'lyric' element may either be a text block, a reference to a text block (e.g. to a chorus), or a tablature.
        text_blocks = root.findall('{*}lyric/{*}block')
        flatten = lambda block: Block.parseDOM(block) if 'blocknb' not in block.attrib else Block.parseDOM(
            text_blocks[int(block.attrib['blocknb']) - 1], linked=True)
        blocks = [flatten(block) for block in root.find('{*}lyric').getchildren() if
                  block.tag != '{http://21wdh.staszic.waw.pl}tabbs']
        get_text = lambda elem: elem.text if elem is not None else None
        get_attrib = lambda attrs: attrs[0] if len(attrs)>0 and attrs[0] else None
        if blocks and blocks[-1].effective_rows:
          blocks[-1].effective_rows[-1].row_type += RowType.END.value # end row

        return Song(
            title=root.get('title'),
            alias=get_text(root.find('{*}alias')),
            text_author=get_text(root.find('{*}text_author')),
            composer=get_text(root.find('{*}composer')),
            artist=get_text(root.find('{*}artist')),
            blocks=blocks,
            barre=get_attrib(root.xpath("./s:music/s:guitar/@barre", namespaces={"s": "http://21wdh.staszic.waw.pl"})),
            metre=get_attrib(root.xpath("./s:music/@metre", namespaces={"s": "http://21wdh.staszic.waw.pl"})),
            genre=get_text(root.find('{*}genre'))
        )


def song2tex(path):
    try:
        tree = etree.parse(path)
        song = Song.parseDOM(tree.getroot())

        latex_jinja_env = jinja2.Environment(
            block_start_string='\BLOCK{',
            block_end_string='}',
            variable_start_string='\VAR{',
            variable_end_string='}',
            comment_start_string='\#{',
            comment_end_string='}',
            line_statement_prefix='%%',
            line_comment_prefix='%#',
            trim_blocks=True,
            lstrip_blocks=True,
            autoescape=False,
            loader=jinja2.FileSystemLoader(sys.path[0])
        )
        template = latex_jinja_env.get_template('song_template.tex')
        res = template.render(song=song)
        res = (res.replace('﻿',' ').replace('😷','').replace('е','e').replace('\u200B','').replace('\u0096','').replace('\u0092','').replace('\u0095','').replace('\u0099','')
               .replace('\u02B9','').replace('\u0092','').replace('\u0088','').replace('\u0085','').replace('\u0080','').replace('\u0081','').replace('\u0082','').replace('\u0087','').replace('\u0084','').replace('\u0093','').replace('\u0094','').replace('\u0091','').replace('\u0098','').replace('\u009B','')
               .replace('\u2028','').replace('\u2005','').replace('\u2003','').replace('\u205F','').replace('\u009F','').replace('\u2502','')
               .replace('\u25BC','$\\downarrow$').replace('\u25B2','$\\uparrow$').replace('🔼','$\\uparrow$').replace('⬆','$\\uparrow$')
               .replace('️⬇','$\\downarrow$').replace('️⬇','$\\downarrow$').replace('️🔽','$\\downarrow$').replace('⬇','$\\downarrow$').replace('🔽','$\\downarrow$')
               .replace('\u02bc','')
               .replace('\uFFFD','').replace('\uFE0F','')
               .replace('\u1E57','p')
               .replace('\uFFFD','#')
               .replace('\u009C','')
               .replace('','')
               .replace('\u99C9','')
               .replace('\u2033','"').replace('\u2032',"'")
               .replace('\u2075','').replace('\u2009','')
               .replace('\u001E','').replace('\uFFFC','').replace('🙂','')
               .replace('\u3164','')
               .replace('\u001b','')
               .replace('\u2212','-'))
        if bool(re.search('[\u0400-\u04FF]', res)):
            return ""
        if bool(re.search('[\u5000-\u50FF]', res)):
            return ""
        if bool(re.search('[\u3000-\u30FF]', res)):
            return ""
        if bool(re.search('[\u8A00-\u8AFF]', res)):
            return ""
        if bool(re.search('[\u6600-\u66FF]', res)):
            return ""
        if bool(re.search('[\u2600-\u26FF]', res)):
            return ""
        if bool(re.search('[\u0300-\u03FF]', res)):
            return ""
        if bool(re.search('[\u0500-\u05FF]', res)):
            return ""
        if bool(re.search('[\u1000-\u10FF]', res)):
            return ""
        return res
    except Exception as e:
        print(path, file=sys.stderr)
        print(e, file=sys.stderr)
        traceback.print_exc()
        return ""

def main():
    if len(sys.argv) < 2:
        print("Wymagana nazwa pliku xml", file=sys.stderr)
        exit(1)
    song2tex(sys.argv[1])


if __name__ == "__main__":
    main()
