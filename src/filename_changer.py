import os
import unicodedata
import lib.read_song_xml as rsx

path = "../songs"
songs = os.listdir(path)

def strip_accents(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', text) if unicodedata.category(c) != 'Mn')


for file in songs:
    song = rsx.parse_song_xml(os.path.join(path, file))
    title = strip_accents(song.title).replace(' ', '_').replace('.', '').replace(',', '')
    title = title.replace("Ł","L").replace("ł","l").replace('\'','_').replace('\"', '').replace('__','_')
    new_name = title + ".xml"
    os.rename(os.path.join(path, file), os.path.join(path, new_name))

