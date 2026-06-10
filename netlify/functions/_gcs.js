require('./_bootstrap');
const { Storage } = require('@google-cloud/storage');

let bucket = null;
function getBucket() {
  if (!bucket) bucket = new Storage().bucket(process.env.GCS_BUCKET);
  return bucket;
}

const SIGN_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Object paths are always namespaced under a deal so one deal can't reach another's files.
function objectPath(dealId, docId, filename) {
  const safe = String(filename).replace(/[^\w.\- ]+/g, '_').slice(0, 200);
  return `deals/${encodeURIComponent(String(dealId))}/${encodeURIComponent(String(docId))}/${safe}`;
}

function isValidPath(path) {
  return typeof path === 'string' && path.startsWith('deals/') && !path.includes('..');
}

async function signedPutUrl(path, contentType) {
  const [url] = await getBucket().file(path).getSignedUrl({
    version: 'v4', action: 'write', expires: Date.now() + SIGN_TTL_MS,
    contentType: contentType || 'application/octet-stream',
  });
  return url;
}

async function signedGetUrl(path) {
  const [url] = await getBucket().file(path).getSignedUrl({
    version: 'v4', action: 'read', expires: Date.now() + SIGN_TTL_MS,
  });
  return url;
}

async function deleteObject(path) {
  await getBucket().file(path).delete({ ignoreNotFound: true });
}

module.exports = { objectPath, isValidPath, signedPutUrl, signedGetUrl, deleteObject };
