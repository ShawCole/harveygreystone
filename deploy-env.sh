#!/bin/bash
KEY=$(cat ~/hgc-netlify-key.json | tr -d '\n')
gcloud run services update hgc-deal-platform \
  --region=us-central1 \
  --project=dataroom-500817 \
  --update-env-vars="^##^GCP_SA_KEY=${KEY}"
