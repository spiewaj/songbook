"""
Song matching system for filtering songs in songbooks.

This module provides a flexible, object-oriented system for matching songs
based on various criteria like title, artist, genre, glob patterns, etc.
"""

import re
import logging
import os
from abc import ABC, abstractmethod
from pathlib import Path, PurePath


# ============================================================================
# Conditions - for matching string values
# ============================================================================

class Condition(ABC):
    """Abstract base class for matching conditions"""
    
    @abstractmethod
    def matches(self, value):
        """Check if value matches this condition
        
        Args:
            value: The value to check (string or None)
            
        Returns:
            bool: True if value matches the condition
        """
        pass


class EqualsCondition(Condition):
    """Matches if value equals the specified string (case-sensitive)"""
    
    def __init__(self, target):
        """
        Args:
            target: The string to match against
        """
        self.target = target.strip() if target else ""
    
    def matches(self, value):
        if value is None:
            return False
        return str(value).strip() == self.target
    
    def __repr__(self):
        return f"EqualsCondition('{self.target}')"


class RegexpCondition(Condition):
    """Matches if value matches the specified regular expression"""
    
    def __init__(self, pattern):
        """
        Args:
            pattern: Regular expression pattern string
        """
        self.pattern = pattern
        try:
            self.compiled = re.compile(pattern)
        except re.error as e:
            raise ValueError(f"Invalid regular expression pattern: {pattern}") from e
    
    def matches(self, value):
        if value is None:
            return False
        return bool(self.compiled.search(str(value)))
    
    def __repr__(self):
        return f"RegexpCondition('{self.pattern}')"


# ============================================================================
# Song Matchers - for matching entire songs
# ============================================================================

class SongMatcher(ABC):
    """Abstract base class for song matchers"""
    
    @abstractmethod
    def matches(self, song):
        """Check if song matches this matcher
        
        Args:
            song: Song object (SongMeta or AliasMeta) to check
            
        Returns:
            bool: True if song matches
        """
        pass


class FieldSongMatcher(SongMatcher):
    """Matches songs based on a specific field and condition"""
    
    # Field extractors - how to get field values from a song
    # Based on actual SongMeta/AliasMeta API
    FIELD_EXTRACTORS = {
        'title': lambda song: song.effectiveTitle() if hasattr(song, 'effectiveTitle') else None,
        'genre': lambda song: song.genre() if hasattr(song, 'genre') else None,
        'artist': lambda song: song.artist() if hasattr(song, 'artist') else None,
        'lang': lambda song: song.lang() if hasattr(song, 'lang') else None,
        'text_author': lambda song: song.text_author() if hasattr(song, 'text_author') else None,
    }
    
    def __init__(self, field, condition):
        """
        Args:
            field: Field name to match on (e.g., 'title', 'artist', 'genre', 'lang', 'text_author')
            condition: Condition object to apply to field value
        """
        if field not in self.FIELD_EXTRACTORS:
            raise ValueError(f"Unknown field: {field}. Valid fields: {list(self.FIELD_EXTRACTORS.keys())}")
        self.field = field
        self.condition = condition
    
    def matches(self, song):
        """Check if song matches the field condition"""
        try:
            field_value = self.FIELD_EXTRACTORS[self.field](song)
        except Exception as e:
            logging.warning(f"Error extracting field '{self.field}' from song: {e}")
            return False
        
        # All fields in SongMeta return single values (string or None)
        return self.condition.matches(field_value)
    
    def __repr__(self):
        return f"FieldSongMatcher(field='{self.field}', condition={self.condition})"


class GlobSongMatcher(SongMatcher):
    """Matches songs based on glob pattern"""
    
    def __init__(self, glob_pattern, base_dir):
        """
        Args:
            glob_pattern: Glob pattern string (e.g., 'songs/**/*.xml')
            base_dir: Base directory for resolving glob patterns
        """
        self.glob_pattern = glob_pattern
        self.base_dir = Path(base_dir)
    
    def matches(self, song):
        """Check if song's file path matches the glob pattern
        
        Args:
            song: SongMeta or AliasMeta object
            
        Returns:
            bool: True if song's plik() matches the glob pattern
        """
        try:
            song_path = song.plik() if hasattr(song, 'plik') else None
            if song_path is None:
                return False
            
            # Convert to Path object
            song_path = Path(song_path)
            
            # Get path relative to base_dir
            try:
                rel_path = song_path.relative_to(self.base_dir)
            except ValueError:
                # If song_path is not relative to base_dir, try with absolute paths
                try:
                    rel_path = song_path.resolve().relative_to(self.base_dir.resolve())
                except ValueError:
                    # Paths are unrelated, can't match
                    return False
            
            # Convert to string with forward slashes for consistent matching
            rel_path_str = rel_path.as_posix()
            
            # Use PurePath.match() with the full pattern
            # We need to check if the relative path matches the pattern
            r = PurePath(rel_path_str).full_match(self.glob_pattern)
            # print(f"Matching song path '{rel_path_str}' against pattern '{self.glob_pattern}': {r}")  # Debug
            return r
                
        except Exception as e:
            logging.warning(f"Error checking song path against pattern '{self.glob_pattern}': {e}")
            return False
    
    def __repr__(self):
        return f"GlobSongMatcher('{self.glob_pattern}')"


class OrSongMatcher(SongMatcher):
    """Matches if any of the sub-matchers match (OR logic)"""
    
    def __init__(self, matchers=None):
        """
        Args:
            matchers: List of SongMatcher objects (optional)
        """
        self.matchers = matchers or []
    
    def add_matcher(self, matcher):
        """Add a matcher to the OR list
        
        Args:
            matcher: SongMatcher object to add
        """
        if not isinstance(matcher, SongMatcher):
            raise TypeError(f"Expected SongMatcher, got {type(matcher)}")
        self.matchers.append(matcher)
    
    def matches(self, song):
        """Check if any matcher matches the song"""
        if not self.matchers:
            return False
        return any(matcher.matches(song) for matcher in self.matchers)
    
    def __repr__(self):
        return f"OrSongMatcher({len(self.matchers)} matchers)"


class AndSongMatcher(SongMatcher):
    """Matches if all of the sub-matchers match (AND logic)"""
    
    def __init__(self, matchers=None):
        """
        Args:
            matchers: List of SongMatcher objects (optional)
        """
        self.matchers = matchers or []
    
    def add_matcher(self, matcher):
        """Add a matcher to the AND list
        
        Args:
            matcher: SongMatcher object to add
        """
        if not isinstance(matcher, SongMatcher):
            raise TypeError(f"Expected SongMatcher, got {type(matcher)}")
        self.matchers.append(matcher)
    
    def matches(self, song):
        """Check if all matchers match the song"""
        if not self.matchers:
            return True
        return all(matcher.matches(song) for matcher in self.matchers)
    
    def __repr__(self):
        return f"AndSongMatcher({len(self.matchers)} matchers)"


# ============================================================================
# Parsing functions - convert YAML specs to matcher objects
# ============================================================================

def parse_condition(condition_spec):
    """Parse condition specification into a Condition object
    
    Args:
        condition_spec: Dictionary with 'equals' or 'regexp' key
        
    Returns:
        Condition object
        
    Raises:
        ValueError: If condition specification is invalid
    """
    if not isinstance(condition_spec, dict):
        raise ValueError(f"Condition must be a dictionary, got: {type(condition_spec)}")
    
    if 'equals' in condition_spec:
        return EqualsCondition(condition_spec['equals'])
    elif 'regexp' in condition_spec:
        return RegexpCondition(condition_spec['regexp'])
    
    raise ValueError(f"Invalid condition specification: {condition_spec}. Must have 'equals' or 'regexp' key")


def parse_song_matcher(matcher_spec, base_dir):
    """Parse a single matcher specification into a SongMatcher
    
    Args:
        matcher_spec: Dictionary with matcher specification
        base_dir: Base directory for resolving glob patterns
        
    Returns:
        SongMatcher object
        
    Raises:
        ValueError: If matcher specification is invalid
    """
    if not isinstance(matcher_spec, dict):
        raise ValueError(f"Matcher must be a dictionary, got: {type(matcher_spec)}")
    
    # Check for glob pattern
    if 'glob' in matcher_spec:
        return GlobSongMatcher(matcher_spec['glob'], base_dir)
    
    # Check for field-based matchers
    for field in FieldSongMatcher.FIELD_EXTRACTORS.keys():
        if field in matcher_spec:
            condition = parse_condition(matcher_spec[field])
            return FieldSongMatcher(field, condition)
    
    raise ValueError(
        f"Invalid matcher specification: {matcher_spec}. "
        f"Must have 'glob' or one of: {list(FieldSongMatcher.FIELD_EXTRACTORS.keys())}"
    )


def parse_songs_spec(songs_spec, base_dir):
    """Parse the songs specification from songbook YAML into an OrSongMatcher
    
    Args:
        songs_spec: List of matcher specifications from YAML
        base_dir: Base directory for resolving glob patterns
        
    Returns:
        OrSongMatcher object containing all parsed matchers
    """
    or_matcher = OrSongMatcher()
    
    if not songs_spec:
        logging.warning("Empty songs specification")
        return or_matcher
    
    for i, matcher_spec in enumerate(songs_spec):
        try:
            matcher = parse_song_matcher(matcher_spec, base_dir)
            or_matcher.add_matcher(matcher)
            logging.debug(f"Added matcher {i+1}/{len(songs_spec)}: {matcher}")
        except ValueError as e:
            logging.warning(f"Skipping invalid matcher #{i+1}: {e}")
        except Exception as e:
            logging.error(f"Unexpected error parsing matcher #{i+1}: {e}")
    
    logging.info(f"Parsed {len(or_matcher.matchers)} matchers from songs specification")
    return or_matcher