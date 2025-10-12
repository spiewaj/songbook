import yaml
import glob, os
import uuid
import hashlib
import logging
import src.lib.list_of_songs as loslib
from src.lib.song_matchers import parse_songs_spec

def repo_dir():
    return os.path.dirname(os.path.realpath(__file__))+"/../.."

# If the path starts from "./" we assume its
def resolvePath(path, start):
    if path.startswith("./"):
        return os.path.join(start, path)
    else:
        return os.path.join(repo_dir(), path)

def md5(str):
    m = hashlib.md5()
    m.update(str.encode('utf-8'))
    return m.hexdigest()

class SongbookSpec:
  def __init__(self, spec, specFile):
    self.spec = spec["songbook"]
    self.basedir = os.path.dirname(specFile)
    self.specFile = specFile

  def __str__(self):
      return str(self.spec)

  def list_of_songs(self):
      """Get list of songs matching the songbook's criteria"""
      if "songs" not in self.spec:
          logging.warning(f"No songs specification in songbook '{self.title()}'")
          return []
      
      # Parse the songs specification into an OrSongMatcher
      or_matcher = parse_songs_spec(self.spec["songs"], base_dir=repo_dir())
      
      logging.info(f"Loading songs for songbook '{self.title()}' with {len(or_matcher.matchers)} matchers")
      
      all_songs = loslib.list_of_song_from_globs(["songs/**/*.xml"], base_dir=repo_dir())
      logging.info(f"Filtering {len(all_songs)} total songs")
      
      matching_songs = [song for song in all_songs if or_matcher.matches(song)]
      
      logging.info(f"Found {len(matching_songs)} matching songs for '{self.title()}'")
      return matching_songs

  def title(self):
      return self.spec["title"] if "title" in self.spec else "Śpiewnik"

  def subtitle(self):
      return self.spec["subtitle"] if "subtitle" in self.spec else ""

  def url(self):
      return self.spec["url"] if "url" in self.spec else ""

  def id(self):
    if "id" in self.spec:
        return self.spec["id"]
    if "uuid" in self.spec:
        return self.spec["uuid"]
    return md5(self.specFile)

  def uuid(self):
      return self.spec["uuid"] if "uuid" in self.spec else uuid.UUID(md5(self.id()))

  def publisher(self):
      return self.spec["publisher"] if "publisher" in self.spec else ""

  def place(self):
      return self.spec["place"] if "place" in self.spec else ""

  def hidden(self):
      return self.spec["hidden"] if "hidden" in self.spec else False

  def imagePdfPath(self):
      return resolvePath(self.spec["image"]["pdf"] if "image" in self.spec and "pdf" in self.spec["image"] else "songbooks/wdw21/znak21.pdf", start=self.basedir)

  def imageWebPath(self):
      if "image" in self.spec:
          if "png" in self.spec["image"]: return resolvePath(self.spec["image"]["png"], start=self.basedir)
          if "svg" in self.spec["image"]: return resolvePath(self.spec["image"]["svg"], start=self.basedir)
          if "jpg" in self.spec["image"]: return resolvePath(self.spec["image"]["jpg"], start=self.basedir)
      return resolvePath("songbooks/wdw21/znak21.jpg", start=self.basedir)

  def imageWebExt(self):
      if "image" in self.spec:
          if "png" in self.spec["image"]: return "png"
          if "svg" in self.spec["image"]: return "svg"
          if "jpg" in self.spec["image"]: return "jpg"
      return "image/jpeg"

  def imageWebMime(self):
      if "image" in self.spec:
          if "png" in self.spec["image"]: return "image/png"
          if "svg" in self.spec["image"]: return "image/svg+xml"
          if "jpg" in self.spec["image"]: return "image/jpeg"
      return "image/jpeg"

def load_songbook_spec_from_yaml(filename, title=None, songFiles=None):
    with open(filename) as stream:
        songbook = yaml.safe_load(stream)
        if title:
            songbook["songbook"]["title"] = title
        if songFiles:
            songbook["songbook"]["songs"] = map(lambda s: {"glob": s}, songFiles)
        return SongbookSpec(songbook, specFile=os.path.abspath(filename))

def songbooks():
    logging.info("searching: " + os.path.join(repo_dir(), "songbooks/*.yaml"))
    return map(load_songbook_spec_from_yaml, glob.glob(os.path.join(repo_dir(), "songbooks/*.yaml")))
