#!/bin/bash
set -e

echo "=== Building Docker Image ==="
docker build -t songbook-pdf-render-local -f containers/backend/Dockerfile .

echo "=== Starting Docker Container ==="
docker run -d -p 8080:8080 -e PORT=8080 -e STORAGE_URI="/tmp" --name test-backend songbook-pdf-render-local
# Wait for container to start up and run the warmup clone
sleep 5

echo "=== Submitting Rendering Job ==="
# Create payload using jq
jq -n --arg branch "main" --arg papersize "a4" --arg yaml "$(cat ./songbooks/dino.songbook.yaml)" '{branch: $branch, papersize: $papersize, yaml_content: $yaml}' > test_payload.json

# Post to container
JOB_RESP=$(curl -s -X POST "http://localhost:8080/api/render/songbook_yaml" -H "Content-Type: application/json" -d @test_payload.json)
echo "Response: $JOB_RESP"

JOB_ID=$(echo "$JOB_RESP" | jq -r .job_id)
if [ "$JOB_ID" == "null" ]; then
    echo "Failed to start job. Check response."
    docker logs test-backend
    docker rm -f test-backend
    rm test_payload.json
    exit 1
fi

echo "Job ID: $JOB_ID started successfully! Polling status..."

# Poll status
while true; do
    STATUS_RESP=$(curl -s "http://localhost:8080/api/jobs/$JOB_ID")
    STATUS=$(echo "$STATUS_RESP" | jq -r .status)
    echo "Current Status: $STATUS"
    
    if [ "$STATUS" == "done" ]; then
        echo "Job finished successfully! Downloading PDF..."
        curl -s "http://localhost:8080/api/jobs/$JOB_ID/download" -o "test_output.pdf"
        ls -lh test_output.pdf
        break
    elif [ "$STATUS" == "error" ]; then
        echo "Job failed with error. Log:"
        echo "$STATUS_RESP" | jq -r .log
        break
    fi
    
    sleep 5
done

echo "=== Cleaning up ==="
docker rm -f test-backend
rm test_payload.json
echo "Test complete!"
