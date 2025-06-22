# File parsing song in xml

from lxml import etree
from enum import Enum

class RowChunk:  # obsługuje akordy
    def __init__(self, chord='', content=None):
        self.chord = chord
        if content is None:
            self.content = ''
        else:
            self.content = content.strip('\t\n')


class RowType(Enum):
    FIRST = 'F'
    FIRST_SPECIAL = 'FS'
    MIDDLE = 'M'
    LAST = 'L'
    SINGLE = 'S'


class Row:
    def __init__(self, row_type=RowType.MIDDLE, new_chords=False, bis=False, chunks=None, instr=False, sidechords=None):
        self.row_type = row_type
        self.new_chords = new_chords
        self.chunks = [] if chunks is None else chunks
        self.bis = bis
        self.instr = instr
        self.sidechords = sidechords

    @staticmethod
    def parseDOM(root, bis=False):
        if root.text:
            chunks = [RowChunk(content=root.text)]
        else:
            chunks = []
        for chunk in root.getchildren():
            chunks.append(RowChunk(chord=chunk.attrib['a'], content=chunk.tail))
        return Row(
            new_chords=root.attrib.get('important_over', 'false')=='true',
            bis=bis,
            chunks=chunks,
            instr=(root.attrib.get('style', '')=='instr'),
            sidechords=root.attrib.get('sidechords', None))


class BlockType(Enum):
    VERSE = 'V'
    CHORUS = 'C'
    INSTRUMENTAL = 'I'
    OTHER = 'O'

    @staticmethod
    def parse(s):
        return {
            'verse': BlockType.VERSE,
            'chorus': BlockType.CHORUS,
            'instrumental': BlockType.INSTRUMENTAL,
            'other': BlockType.OTHER
        }[s]


class Block:
    def __init__(self, block_type=BlockType.VERSE, rows=None):
        self.block_type = block_type
        self.rows = [] if rows is None else rows

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
        if len(rows) == 1:
            rows[0].row_type = RowType.SINGLE
        elif len(rows) > 1:
            rows[0].row_type = RowType.FIRST_SPECIAL
            rows[-1].row_type = RowType.LAST
        if linked:
            for row in rows:
                row.new_chords = False
        return Block(block_type=block_type, rows=rows)


class Song:
    def __init__(self, title='', text_author='', composer='', artist='', original_title='', translator='', alias='',
                 comment='', music_source='', album='', blocks=None, metre='', barre=''):
        self.title = title if title else ''
        self.text_author = text_author if text_author else ''
        self.composer = composer if composer else ''
        self.artist = artist if artist else ''
        self.original_title = original_title if original_title else ''
        self.translator = translator if translator else ''
        self.alias = alias if alias else ''
        self.comment = comment if comment else ''
        self.blocks = [] if blocks is None else blocks
        self.music_source = music_source if music_source else ''
        self.album = album if album else ''
        self.metre = metre if metre else ''
        self.barre = barre if barre else ''

    @staticmethod
    def parseDOM(root):
        # A child of 'lyric' element may either be a text block, a reference to a text block (e.g. to a chorus), or a tablature.
        text_blocks = root.findall('{*}lyric/{*}block')

        def elementTextOrNone(elem):
            return elem.text if elem is not None else None

        def get_attrib(elem, a):
            return elem.attrib.get(a) if elem is not None else None

        def flatten(block):
            return Block.parseDOM(block) if 'blocknb' not in block.attrib else Block.parseDOM(
                text_blocks[int(block.attrib['blocknb']) - 1], linked=True)

        blocks = [flatten(block) for block in root.find('{*}lyric').getchildren() if
                  block.tag != '{http://21wdh.staszic.waw.pl}tabbs']

        x = root.xpath("./s:music/s:guitar/@barre", namespaces={"s": "http://21wdh.staszic.waw.pl"})
        return Song(
            title=root.get('title'),
            text_author=elementTextOrNone(root.find('{*}text_author')),
            composer=elementTextOrNone(root.find('{*}composer')),
            artist=elementTextOrNone(root.find('{*}artist')),
            original_title=elementTextOrNone(root.find('{*}original_title')),
            translator=elementTextOrNone(root.find('{*}translator')),
            comment=elementTextOrNone(root.find('{*}comment')),
            alias=elementTextOrNone(root.find('{*}alias')),
            blocks=blocks,
            metre=get_attrib(root.find('{*}music'), 'metre'),
            barre=x[0] if x else None,
            album=elementTextOrNone(root.find('{*}album')),
            music_source=elementTextOrNone(root.find('{*}music_source'))
        )


def parse_song_xml(path):
    tree = etree.parse(path)
    song = Song.parseDOM(tree.getroot())
    return song
