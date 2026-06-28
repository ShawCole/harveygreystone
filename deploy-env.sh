#!/bin/bash
KEY=$(cat ~/hgc-netlify-key.json | tr -d '\n')
gcloud run services update hgc-deal-platform \
  --region=us-central1 \
  --project=dataroom-500817 \
  --set-env-vars="CLOUD_SQL_CONNECTION_NAME=dataroom-500817:us-central1:hgc-db,DB_USER=hgcapp,DB_PASS=9MQojFBFrz0emJvwmztd/k0I28NEhMco,DB_NAME=hgc,GCS_BUCKET=hgc-dataroom-docs-500817,SESSION_SECRET=XdVndTwlgeT_5JqLmmHEdtAtfa_phNH7JQCj8solG8A,APP_PASSWORD=HGCARK2027!" \
  --update-env-vars="^##^GCP_SA_KEY=${KEY}"
