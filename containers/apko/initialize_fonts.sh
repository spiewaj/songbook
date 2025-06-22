#!/bin/bash

# When building the Alpine image (Apko) with Livetex,
# For unknown reason the fonts cannot be generated ad-hoc as part
# of just rendering tex. They land in the output directory and cannot be found there.
# We here precompute the fonts (based on generated `build/songs_tex/missfont.log` output for different page-sizes,
# To enable the rendering.

mktextfm ecssdc10
mktexpk --mfmode / --bdpi 600 --mag 1+0/600 --dpi 600 ecrm1000
mktexpk --mfmode / --bdpi 600 --mag 1+0/600 --dpi 600 ecbx1000
mktexpk --mfmode / --bdpi 600 --mag 1+0/600 --dpi 600 ecbx1728
mktexpk --mfmode / --bdpi 600 --mag 1+0/600 --dpi 600 ecrm1095
mktexpk --mfmode / --bdpi 600 --mag 1+0/600 --dpi 600 ecrm1728
mktexpk --mfmode / --bdpi 600 --mag 1+0/600 --dpi 600 ecrm1200
mktexpk --mfmode / --bdpi 600 --mag 1+0/600 --dpi 600 ectt2488
mktexpk --mfmode / --bdpi 600 --mag 0+540/600 --dpi 540 ecssdc10
mktexpk --mfmode / --bdpi 600 --mag 1+0/600 --dpi 600 ecrm0900
mktexpk --mfmode / --bdpi 600 --mag 1+0/600 --dpi 600 ecbx0900
mktexpk --mfmode / --bdpi 600 --mag 1+0/600 --dpi 600 ectt1728
mktexpk --mfmode / --bdpi 600 --mag 1+0/600 --dpi 600 ectt1000

