from abc import ABC, abstractmethod

class SongConverter(ABC):
    @abstractmethod
    def xml2html(self, src_xml_path, path_out, song_suffix=None, song_prefix=None, song_head=None, substitions={}):
        """Convert song from XML to HTML format"""
        pass

    @abstractmethod
    def extension(self):
        """Return the file extension for this converter: 'html' or 'xhtml'"""
        pass
