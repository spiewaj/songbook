#!/bin/bash
set -e

GOOGLE_PROJECT="spiewaj-com"
SERVICE_NAME="songbook-pdf-render"
REGION="europe-west1"
STORAGE_URI="gs://spiewaj-pdf-renders"
IMAGE="gcr.io/${GOOGLE_PROJECT}/${SERVICE_NAME}"

# Ensure we run from repository root to capture all context (like src/ and songs/)
cd "$(dirname "$0")/../.."

echo "Building the container image via Google Cloud Build..."
gcloud builds submit --project=${GOOGLE_PROJECT} --config=containers/backend/cloudbuild.yaml .

echo "Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --project=${GOOGLE_PROJECT} \
  --region=${REGION} \
  --image=${IMAGE} \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=2 \
  --concurrency=10 \
  --timeout=300 \
  --max-instances=5 \
  --set-env-vars="STORAGE_URI=${STORAGE_URI}"

echo "Deployment finished."
