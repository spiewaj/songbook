#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

ORG="spiewaj"

set -e -x

# Authorization using:
#  - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
#  - https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
#  The token is configured here: https://github.com/settings/tokens for scopes:  delete:packages, repo, write:packages
#echo "{PERSONAL_ACCESS_TOKEN}" | docker login ghcr.io -u ptabor --password-stdin
#  If you forget - you need to regenerate.


cd "${SCRIPT_DIR}/.."
docker build -f "${SCRIPT_DIR}/Dockerfile" -t europe-docker.pkg.dev/$ORG/songbook/github-latex-worker:latest --platform linux/amd64 .

docker image tag europe-docker.pkg.dev/$ORG/songbook/github-latex-worker ghcr.io/$ORG/github-latex-worker:latest

# docker push europe-docker.pkg.dev/$ORG/songbook/github-latex-worker:latest

docker push ghcr.io/$ORG/github-latex-worker:latest
