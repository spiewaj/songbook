#!/bin/bash

set -e -x

CONTAINER="europe-docker.pkg.dev/wdw-21/songbook/github-latex-worker-alpine"

# Not yet finished nor tested.
docker run -v "$PWD":/work cgr.dev/chainguard/apko build /work/latex.apko.yaml latex-alpine-base:latest /work/latex.tar
docker load -i latex.tar
docker build -t ${CONTAINER} .


docker run --rm -v "${PWD}/../..:/work" -w /work -it ${CONTAINER} /bin/bash

#docker run --rm -v "${PWD}/../..:/work" -w /work -it ${CONTAINER} ./render_pdf.sh songbook a4 test ./songs/alpuhara.xml


#docker push "${CONTAINER}"


# europe-docker.pkg.dev
#gcloud auth login piotr.tabor@gmail.com
#gcloud config set project wdw-21
#gcloud auth configure-docker europe-docker.pkg.dev