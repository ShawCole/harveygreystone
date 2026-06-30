const crypto = require('crypto');

// --- The agreement ---------------------------------------------------------
// Mutual Non-Circumvention & Non-Disclosure Agreement. This is a working
// template for the platform flow — HGC should have counsel review/replace the
// body text. Bump NCNDA_VERSION whenever the text changes (it's part of the hash).
const NCNDA_VERSION = '2026-06-10.1';
const NCNDA_TITLE = 'Mutual Non-Circumvention & Non-Disclosure Agreement (NCNDA)';
const NCNDA_TEXT = `This Mutual Non-Circumvention and Non-Disclosure Agreement ("Agreement") is entered into by and between HGC & ARK Capital Consulting and its authorized representatives (collectively, "HGC"), and the undersigned counterparty and its representatives ("Counterparty"). HGC and Counterparty are each a "Party" and together the "Parties."

1. CONFIDENTIALITY. Each Party may disclose to the other confidential and proprietary information, including business plans, financial information, deal structures, projections, contacts, and materials ("Confidential Information"). Each Party agrees to hold the other's Confidential Information in strict confidence and not to disclose it to any third party without prior written consent.

2. NON-CIRCUMVENTION. Neither Party shall, directly or indirectly, contact, solicit, transact with, or circumvent the other Party in respect of any business opportunity, transaction, investor, lender, source, or contact introduced or made available through this engagement, without the introducing Party's prior written consent, for the duration of this Agreement and for a period of twenty-four (24) months thereafter.

3. PERMITTED USE. Confidential Information shall be used solely for the purpose of evaluating and pursuing the contemplated transaction(s) and for no other purpose. Unauthorized use, competitive analysis, reverse engineering, or public disclosure is strictly prohibited.

4. TERM & SURVIVAL. The confidentiality and non-circumvention obligations survive termination of access and continue for five (5) years, or as required by law. Upon request, each Party shall return or permanently destroy the other's Confidential Information.

5. NO WARRANTY; NO OBLIGATION. Confidential Information is provided "as is." Nothing herein obligates either Party to proceed with any transaction.

6. ELECTRONIC SIGNATURE. The Parties agree that this Agreement may be executed electronically, and that an electronic signature constitutes a valid and binding signature. Each signatory represents they are authorized to bind their respective Party.

By signing below, each signatory acknowledges they have read, understood, and agree to be bound by the terms of this Agreement.`;

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

const agreementHash = () => sha256(`${NCNDA_VERSION}\n${NCNDA_TITLE}\n${NCNDA_TEXT}`);

function newToken() {
  return crypto.randomBytes(24).toString('base64url');
}

// Ensure the deal payload has an NCNDA block; create token + hash if missing.
function ensureNcnda(payload) {
  if (!payload.ncnda) {
    payload.ncnda = {
      token: newToken(),
      agreementVersion: NCNDA_VERSION,
      agreementHash: agreementHash(),
      signatures: [],
      status: 'pending',
    };
  }
  // Keep the hash current if the agreement text/version changed and nobody has signed yet.
  if ((payload.ncnda.signatures || []).length === 0) {
    payload.ncnda.agreementVersion = NCNDA_VERSION;
    payload.ncnda.agreementHash = agreementHash();
  }
  return payload.ncnda;
}

// Build one signature record, server-stamped (timestamp + IP) and hashed.
function makeSignature({ party, name, title, email, ip }) {
  const signedAt = new Date().toISOString();
  const aHash = agreementHash();
  const sigHash = sha256([aHash, party, name || '', title || '', email || '', signedAt, ip || ''].join('|'));
  return { party, name: name || '', title: title || '', email: email || '', signedAt, ip: ip || '', sigHash };
}

// Finalize when at least one internal signature AND a client signature exist.
// Produces a tamper-evident certificate (id + hash chain over all signatures).
function tryFinalize(ncnda) {
  const sigs = ncnda.signatures || [];
  const hasInternal = sigs.some((s) => s.party === 'internal');
  const hasClient = sigs.some((s) => s.party === 'client');
  if (hasInternal && hasClient && ncnda.status !== 'finalized') {
    const finalizedAt = new Date().toISOString();
    const certificateId = crypto.randomBytes(12).toString('hex');
    const chain = sigs.map((s) => s.sigHash).sort().join('|');
    const certHash = sha256([ncnda.agreementHash, chain, finalizedAt, certificateId].join('::'));
    ncnda.status = 'finalized';
    ncnda.finalizedAt = finalizedAt;
    ncnda.certificateId = certificateId;
    ncnda.certHash = certHash;
  }
  return ncnda;
}

// Public, non-sensitive view of the agreement state for the client portal.
function publicView(deal) {
  const n = deal.payload.ncnda || {};
  const sigs = n.signatures || [];
  return {
    dealName: deal.payload.name || 'Document Upload',
    company: deal.payload.company || deal.payload.client || '',
    agreementTitle: NCNDA_TITLE,
    agreementVersion: NCNDA_VERSION,
    agreementText: NCNDA_TEXT,
    status: n.status || 'pending',
    internalSigners: sigs.filter((s) => s.party === 'internal').map((s) => ({ name: s.name, title: s.title, signedAt: s.signedAt })),
    clientSigned: sigs.some((s) => s.party === 'client'),
    clientSigner: (sigs.find((s) => s.party === 'client') || null) && (() => { const c = sigs.find((s) => s.party === 'client'); return { name: c.name, title: c.title, signedAt: c.signedAt }; })(),
    certificateId: n.certificateId || null,
    uploads: (deal.payload.clientUploads || []).map((u) => ({ filename: u.filename, uploadedAt: u.uploadedAt })),
    fundingType: deal.fundingType || deal.payload?.fundingType || null,
    clientIntake: deal.payload?.clientIntake || {},
  };
}

module.exports = {
  NCNDA_VERSION, NCNDA_TITLE, NCNDA_TEXT,
  agreementHash, newToken, ensureNcnda, makeSignature, tryFinalize, publicView, sha256,
};
