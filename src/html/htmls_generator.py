import os
import shutil

import src.html.create_songs_html as cash
import sys
import src.lib.songbook as sb

def main():
    target_dir = os.path.join(sb.repo_dir(), "build")  # gdzie ma utworzyć epub
    songbook_file = os.path.join(sb.repo_dir(), "songbooks/default.songbook.yaml") if len(sys.argv) == 1 else sys.argv[1]
    songbook = sb.load_songbook_spec_from_yaml(songbook_file)

    path_songs_html = os.path.join(target_dir, "songs_html")
    if os.path.exists(path_songs_html):
        shutil.rmtree(path_songs_html)
        os.mkdir(path_songs_html)

    cash.create_all_songs_html(songbook.list_of_songs(), path_songs_html)
    path_css = os.path.join(path_songs_html, "CSS")
    os.mkdir(path_css)

    CSS_FILES = [
        "common.css",
        "index.css",
        "song_common.css",
        "song.css",
    ]
    for css_file in CSS_FILES:
        path_tmp_css = os.path.join(sb.repo_dir(), 'src', 'html', 'css', css_file)
        os.symlink(path_tmp_css, os.path.join(path_css, css_file))

if __name__ == "__main__":
    main()
