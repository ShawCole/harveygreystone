// Public certificate verification. Given a certificate id, returns the
// authoritative, tamper-evident record (parties, timestamps, hashes) so a
// holder of the certificate can independently verify it.
const { ensureSchema, findDealByCertificate } = require('./_db');
const { agreementHash, sha256 } = require('./_ncnda');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  const cert = event.queryStringParameters && event.queryStringParameters.cert;
  if (!cert) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'cert required' }) };
  try {
    await ensureSchema();
    const deal = await findDealByCertificate(cert);
    if (!deal) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'certificate not found' }) };
    const n = deal.payload.ncnda;
    // Recompute the cert hash from stored data to confirm integrity.
    const chain = (n.signatures || []).map((s) => s.sigHash).sort().join('|');
    const recomputed = sha256([n.agreementHash, chain, n.finalizedAt, n.certificateId].join('::'));
    const agreementIntact = n.agreementHash === agreementHash();
    return {
      statusCode: 200, headers: JSON_HEADERS,
      body: JSON.stringify({
        certificateId: n.certificateId,
        status: n.status,
        finalizedAt: n.finalizedAt,
        agreementVersion: n.agreementVersion,
        agreementHash: n.agreementHash,
        certHash: n.certHash,
        valid: recomputed === n.certHash,
        agreementMatchesCurrentTemplate: agreementIntact,
        parties: (n.signatures || []).map((s) => ({ party: s.party, name: s.name, title: s.title, signedAt: s.signedAt, sigHash: s.sigHash })),
      }),
    };
  } catch (err) {
    console.error('certificate error:', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server error' }) };
  }
};
