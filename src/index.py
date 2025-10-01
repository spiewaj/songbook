#!/usr/bin/env python3

import os
import sys
import pathlib
import unicodedata
from collections import defaultdict

# Add the lib directory to the path to import existing modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lib'))

from list_of_songs import list_of_song_from_globs

def create_genre_artist_index(songs_dir="songs", index_dir="songs-index"):
    """
    Creates a directory structure organized by language, genre and artist with symlinks to song files.
    Structure: songs-index/by_genre_artist/language/genre/artist/song.xml
    """
    
    # Create base index directory
    index_base = os.path.join(index_dir, "by_genre_artist")
    pathlib.Path(index_base).mkdir(parents=True, exist_ok=True)
    
    # Use glob pattern to find all XML files recursively
    glob_patterns = [os.path.join(songs_dir, "**/*.xml")]
    
    # Load songs using the new glob-based function
    songs_meta = list_of_song_from_globs(glob_patterns, base_dir=".")
    print(f"Loaded {len(songs_meta)} songs and aliases from: '{songs_dir}'")
    
    # Filter out aliases - we only want to create symlinks for actual songs
    actual_songs = [song for song in songs_meta if not song.is_alias()]
    print(f"Processing {len(actual_songs)} actual songs (excluding aliases)")
    
    # Group songs by language, genre and artist
    lang_genre_artist_songs = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    
    for song_meta in actual_songs:
        # Get language, genre and artist, with fallbacks
        language = song_meta.lang() if song_meta.lang() else "unknown"
        genre = song_meta.genre() if song_meta.genre() else "unknown"
        artist = song_meta.artist() if song_meta.artist() else "unknown"
        
        # Clean up names for filesystem (remove problematic characters)
        language = clean_filename(language)
        genre = clean_filename(genre)
        artist = clean_filename(artist)
        
        lang_genre_artist_songs[language][genre][artist].append(song_meta)
    
    # Create directory structure and symlinks
    created_links = 0
    
    for language, genres in lang_genre_artist_songs.items():
        for genre, artists in genres.items():
            for artist, song_metas in artists.items():
                # Create artist directory
                artist_dir = os.path.join(index_base, language, genre, artist)
                pathlib.Path(artist_dir).mkdir(parents=True, exist_ok=True)
                
                for song_meta in song_metas:
                    # Create symlink
                    song_filename = os.path.basename(song_meta.plik())
                    link_path = os.path.join(artist_dir, song_filename)
                    
                    # Remove existing symlink if it exists
                    if os.path.lexists(link_path):
                        os.unlink(link_path)
                    
                    # Create relative symlink
                    relative_target = os.path.relpath(song_meta.plik(), artist_dir)
                    os.symlink(relative_target, link_path)
                    created_links += 1
    
    print(f"Created {created_links} symlinks")
    print(f"Index structure created in: {index_base}")
    
    # Print summary
    print("\nSummary:")
    for language in sorted(lang_genre_artist_songs.keys()):
        total_artists = 0
        total_songs = 0
        print(f"Language: {language}")
        for genre in sorted(lang_genre_artist_songs[language].keys()):
            artist_count = len(lang_genre_artist_songs[language][genre])
            song_count = sum(len(songs) for songs in lang_genre_artist_songs[language][genre].values())
            total_artists += artist_count
            total_songs += song_count
            print(f"  {genre}: {artist_count} artists, {song_count} songs")
        print(f"  Total for {language}: {total_artists} artists, {total_songs} songs")
        print()

def clean_filename(name):
    """Clean filename by removing problematic characters, accents, and converting to lowercase"""
    if not name:
        return "unknown"
    
    # Convert to lowercase first
    cleaned = name.lower().strip()
    
    # Normalize unicode characters and remove combining marks (accents, diacritics)
    # NFKD normalization decomposes characters into base + combining marks
    nfkd_form = unicodedata.normalize('NFKD', cleaned)
    # Filter out combining characters (accents, diacritics)
    cleaned = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    
    # Replace spaces and problematic characters with underscores
    cleaned = cleaned.replace(' ', '_')
    cleaned = cleaned.replace('/', '_')
    cleaned = cleaned.replace('\\', '_')
    cleaned = cleaned.replace(':', '_')
    cleaned = cleaned.replace('*', '_')
    cleaned = cleaned.replace('?', '_')
    cleaned = cleaned.replace('"', '_')
    cleaned = cleaned.replace("'", '_')
    cleaned = cleaned.replace('<', '_')
    cleaned = cleaned.replace('>', '_')
    cleaned = cleaned.replace('|', '_')
    cleaned = cleaned.replace('&', '_')
    cleaned = cleaned.replace('.', '_')
    cleaned = cleaned.replace(',', '_')
    cleaned = cleaned.replace(';', '_')
    cleaned = cleaned.replace('!', '_')
    cleaned = cleaned.replace('(', '_')
    cleaned = cleaned.replace(')', '_')
    cleaned = cleaned.replace('[', '_')
    cleaned = cleaned.replace(']', '_')
    cleaned = cleaned.replace('{', '_')
    cleaned = cleaned.replace('}', '_')
    
    # Remove multiple underscores
    while '__' in cleaned:
        cleaned = cleaned.replace('__', '_')
    
    # Remove leading/trailing underscores
    cleaned = cleaned.strip('_')
    
    return cleaned if cleaned else "unknown"

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Create language/genre/artist index of songs')
    parser.add_argument('--songs-dir', default='songs', help='Directory containing song XML files')
    parser.add_argument('--index-dir', default='songs-index', help='Output directory for index structure')
    parser.add_argument('--clean', action='store_true', help='Clean existing index before creating new one')
    
    args = parser.parse_args()
    
    # Clean existing index if requested
    if args.clean and os.path.exists(args.index_dir):
        import shutil
        print(f"Cleaning existing index: {args.index_dir}")
        shutil.rmtree(args.index_dir)
    
    create_genre_artist_index(args.songs_dir, args.index_dir)