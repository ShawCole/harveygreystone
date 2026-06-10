// Materialize the GCP service-account key from env into a temp file so that
// google-auth-library (Cloud SQL connector) and the Storage client pick it up
// via Application Default Credentials. Runs once per cold start.
const fs = require('fs');

if (process.env.GCP_SA_KEY && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const path = '/tmp/hgc-sa-key.json';
  try {
    fs.writeFileSync(path, process.env.GCP_SA_KEY);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
  } catch (err) {
    console.error('bootstrap: failed to write SA key', err.message);
  }
}

module.exports = {};
