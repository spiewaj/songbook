from lxml import etree
import os
import icu #do sortowania po polskich znakach

class SongMeta:
    def __init__(self, title='', alias='', path='', genre='', artist=''):
        self._title = title if title else ''
        self._alias = alias if alias else ''
        self._plik = path
        self._genre = genre if genre else None
        self._artist = artist if artist else None

    def __repr__(self) -> str:
      return "{" + "File:{} Title:{} Alias:{} Artist:{} Genre:{}".format(self.plik(), self._title, self._alias, self._artist, self._genre) + "}"

    def base_file_name(self):
        return os.path.splitext(os.path.basename(self.plik()))[0]

    @staticmethod
    def parseDOM(root, path):
        def elementTextOrNone(elem):
            return elem.text if elem is not None else None

        return SongMeta(
            title=root.get('title'),
            alias=elementTextOrNone(root.find('{*}alias')),
            path=path,
            genre=elementTextOrNone(root.find('{*}genre')),
            artist=elementTextOrNone(root.find('{*}artist')),
        )

    def effectiveTitle(self):
        return self._title

    def aliases(self):
        return [self._alias] if (self._alias and self._alias != "") else []

    def plik(self):
        return self._plik

    def is_alias(self):
        return False

    def artist(self):
        return self._artist

    def genre(self):
        return self._genre

class AliasMeta:
    def __init__(self, alias, song_meta):
        self._song_meta = song_meta
        self._alias = alias

    def __repr__(self) -> str:
        return "{" + "Alias:{}->{}".format(self._alias, self._song_meta) + "}"

    def base_file_name(self):
        return self._song_meta.base_file_name()

    def effectiveTitle(self):
        return self._alias

    def mainTitle(self):
        return self._song_meta.effectiveTitle()

    def aliases(self):
        return self._song_meta.aliases()

    def artist(self):
        return self._song_meta.artist()

    def genre(self):
        return self._song_meta.genre()

    def is_alias(self):
        return True


def add_song(path, lista):
    tree = etree.parse(path)
    song = SongMeta.parseDOM(tree.getroot(), path)
    for a in song.aliases():
        lista.append(AliasMeta(a, song))
    lista.append(song)

def list_of_song_from_files(files):
    list_od_meta = []
    for file in files:
        add_song(file, list_od_meta)
    collator = icu.Collator.createInstance(icu.Locale('pl_PL.UTF-8'))
    list_od_meta.sort(key=lambda x: collator.getSortKey(x.effectiveTitle()))
    return list_od_meta

def list_of_song(path_in):
    files = []
    for song in os.listdir(path_in):
        if os.path.splitext(song)[1] == '.xml':
            path = path_in + "/" + song
            files.append(path)
    return list_of_song_from_files(files)