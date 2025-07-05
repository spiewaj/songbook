import os
import shutil

import src.html.create_songs_html as cash
import sys
import src.lib.songbook as sb
from lxml import etree

def load_template(template_file_name):
    """Load an XHTML template from the given path."""
    path_template = os.path.join(sb.repo_dir(), 'src', 'html', 'templates', template_file_name)
    if not os.path.exists(path_template):
        print(f"Template file not found: {path_template}")
        sys.exit(1)
    # file_content = ""
    # with open(path_template, 'r') as f:
    #   file_content = f.read()
    
    root = etree.parse(path_template, etree.XMLParser(recover=True, remove_blank_text=True)).getroot()
    return root.getchildren() if root.tag == 'root' else list(root)

def main():
    target_dir = os.path.join(sb.repo_dir(), "build")  # gdzie ma utworzyć epub
    songbook_file = os.path.join(sb.repo_dir(), "songbooks/default.songbook.yaml") if len(sys.argv) == 1 else sys.argv[1]
    songbook = sb.load_songbook_spec_from_yaml(songbook_file)

    path_songs_html = os.path.join(target_dir, "songs_html")
    if os.path.exists(path_songs_html):
        shutil.rmtree(path_songs_html)
        os.mkdir(path_songs_html)

    # load snipped of xhtml using lxml from templates/_song_prefix.xhtml
    _song_prefix = load_template('_song_prefix.xhtml',)
    _song_head = load_template('_song_head.xhtml')
    _song_suffix = load_template('_song_suffix.xhtml')
    
    cash.create_all_songs_html(songbook.list_of_songs(), path_songs_html, song_prefix=_song_prefix, song_suffix=_song_suffix, song_head=_song_head)
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
    if not os.path.exists(os.path.join(target_dir, "common.js")):
        os.symlink(
            os.path.join(sb.repo_dir(), 'src', 'html', 'templates', 'common.js'),
            os.path.join(target_dir, 'common.js'))

if __name__ == "__main__":
    main()
