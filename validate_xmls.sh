#!/bin/bash

find ./songs -name '*.xml' | xargs xmllint --schema ./editor-github/song.xsd --noout
