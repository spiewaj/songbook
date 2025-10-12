#!/bin/bash

gcloud functions deploy editor-github-pr-proxy \
  --allow-unauthenticated \
  --project wdw-21 \
  --region=europe-west3 --runtime nodejs20 --trigger-http --max-instances=3 --source . --memory=128Mi --gen2 \
  --entry-point=app \
  --set-secrets=GITHUB_TOKEN=projects/wdw-21/secrets/github-comments-token:latest