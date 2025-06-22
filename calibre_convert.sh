# Examplar conversions using calibre.
# As sometimes upload from epub does not work directly, it seems that conversion epub->epub works.

/Applications/calibre.app/Contents/MacOS/ebook-convert ./build/spiewnik.epub ./build/spiewnika.azw3
/Applications/calibre.app/Contents/MacOS/ebook-convert ./build/spiewnik.epub ./build/spiewnik2.epub --epub-version=3
/Applications/calibre.app/Contents/MacOS/ebook-convert ./build/spiewnika.azw3 ./build/spiewnika3.epub

