import os

def create_list_of_songs(song_set):
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

def create_all_songs_html_from_dir(converter, path_in, path_out, song_suffix=[]):
    return create_all_songs_html(converter, create_list_of_songs(path_in), path_out, song_suffix)

def create_all_songs_html(converter, list_of_songs, path_out, song_suffix=[], song_prefix=[], song_head=[], substitions={}):
    if not os.path.exists(path_out):
        os.mkdir(path_out)

    for song in list_of_songs:
        if not song.is_alias():
            relative_path = os.path.relpath(song.plik(), start=os.path.join(os.path.dirname(__file__), "../../songs"))
            converter.xml2html(song.plik(), 
                             os.path.join(path_out, song.base_file_name() + '.xhtml'), 
                             song_suffix=song_suffix, 
                             song_prefix=song_prefix, 
                             song_head=song_head, 
                             substitions=substitions | {
                                 "{{SRC}}": relative_path, 
                                 "{{BASE_FILENAME}}": song.base_file_name()
                             })
