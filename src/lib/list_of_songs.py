from lxml import etree
import os
import icu #do sortowania po polskich znakach
import glob

class SongMeta:
    def __init__(self, title='', alias='', path='', genre='', artist='', lang=''):
        self._title = title if title else ''
        self._alias = alias if alias else ''
        self._plik = path
        self._genre = genre if genre else None
        self._artist = artist if artist else None
        self._lang = lang if lang else 'pl'

    def __repr__(self) -> str:
      return "{" + "File:{} Title:{} Alias:{} Artist:{} Genre:{} Lang:{}".format(self.plik(), self._title, self._alias, self._artist, self._genre, self._lang) + "}"

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
            lang=root.get('lang'),
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

    def lang(self):
        return self._lang

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

    def lang(self):
        return self._song_meta.lang()

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

def list_of_song_from_globs(glob_patterns, base_dir=None):
    """
    Load songs from multiple glob patterns with deduplication.
    
    Args:
        glob_patterns: List of glob pattern strings
        base_dir: Base directory for resolving patterns (defaults to repo root)
    
    Returns:
        List of SongMeta and AliasMeta objects, sorted by title
    """
    if base_dir is None:
        # Use repo_dir if available, otherwise current directory
        try:
            from . import songbook
            base_dir = songbook.repo_dir()
        except:
            base_dir = os.getcwd()
    
    # Collect all files from glob patterns
    all_files = set()  # Use set for automatic deduplication
    
    for pattern in glob_patterns:
        # Resolve pattern relative to base_dir
        full_pattern = os.path.join(base_dir, pattern)
        
        # Find files matching the pattern
        matched_files = glob.glob(full_pattern, recursive=True)
        
        # Add to set (automatically deduplicates)
        for file_path in matched_files:
            # Normalize path to handle different path separators and resolve symlinks
            normalized_path = os.path.realpath(file_path)
            if os.path.isfile(normalized_path) and normalized_path.endswith('.xml'):
                all_files.add(normalized_path)
    
    # Convert set back to sorted list for consistent ordering
    file_list = sorted(list(all_files))
    
    # Use existing function to load songs from files
    return list_of_song_from_files(file_list)
