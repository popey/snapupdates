#!/bin/bash

# Snap Store sync loop
# Runs indefinitely, syncing every 5 minutes

API_URL="${SYNC_API_URL:-http://localhost:8787/api/sync}"
DELAY="${SYNC_DELAY:-300}"  # 5 minutes in seconds

echo "Starting sync loop..."
echo "API URL: $API_URL"
echo "Delay between syncs: ${DELAY}s ($(($DELAY / 60)) minutes)"
echo ""

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$TIMESTAMP] Running sync..."

    HTTP_CODE=$(curl -s -o /tmp/sync-response.txt -w "%{http_code}" -X POST "$API_URL" 2>/tmp/sync-error.txt)
    CURL_EXIT=$?
    RESPONSE=$(cat /tmp/sync-response.txt 2>/dev/null)
    CURL_ERR=$(cat /tmp/sync-error.txt 2>/dev/null)

    if [ $CURL_EXIT -ne 0 ]; then
        echo "[$TIMESTAMP] curl failed (exit $CURL_EXIT): $CURL_ERR"
    elif [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
        echo "[$TIMESTAMP] OK ($HTTP_CODE): $RESPONSE"
    else
        echo "[$TIMESTAMP] HTTP $HTTP_CODE: $RESPONSE"
    fi

    echo "[$TIMESTAMP] Sleeping for ${DELAY}s..."
    sleep $DELAY
done
