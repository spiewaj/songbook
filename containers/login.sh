#!/bin/bash

gcloud auth login piotr.tabor@gmail.com
gcloud config set project wdw-21
gcloud auth configure-docker europe-docker.pkg.dev

# Authorization using:
#  - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
#  - https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry

#echo "{PERSONAL_ACCESS_TOKEN}" | docker login ghcr.io -u ptabor --password-stdin
