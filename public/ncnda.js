/* HGC & ARK — team-side Client Portal & NCNDA admin.
   Lets the internal team enable a per-deal client portal, add internal-team
   signatures, share the signing+upload link, and see the client's signature,
   the finalized certificate, and the client's uploaded documents.
   Loaded after the inline app script; shares globals `deals` and `renderDeals`. */
(function () {
  let currentDealId = null;
  let view = null; // { ncnda, portalUrl, clientUploads }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function cardStatus(deal) {
    const n = deal.ncnda;
    if (!n) return '<span class="badge badge-neutral">No portal</span>';
    const client = (n.signatures || []).some((s) => s.party === 'client');
    if (n.status === 'finalized') return '<span class="badge badge-success">NCNDA finalized</span>';
    if (client) return '<span class="badge badge-info">Client signed</span>';
    return '<span class="badge badge-warning">Awaiting client</span>';
  }

  async function open(dealId) {
    currentDealId = dealId;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    document.getElementById('ncDealName').textContent = `Client Portal & NCNDA \u2014 ${deal.name}`;
    document.getElementById('ncBody').innerHTML = '<p class="text-muted">Loading\u2026</p>';
    document.getElementById('ncndaModal').classList.add('show');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const r = await fetch('/api/ncnda?dealId=' + encodeURIComponent(dealId), { signal: controller.signal });
      clearTimeout(timeout);
      if (!r.ok) throw new Error('could not load');
      view = await r.json();
      render();
    } catch (e) {
      const msg = e.name === 'AbortError'
        ? 'Loading is taking longer than expected. Please try again.'
        : 'Could not load the portal. Try again.';
      document.getElementById('ncBody').innerHTML = `<p class="text-danger">${msg}</p>`;
    }
  }
  function close() {
    document.getElementById('ncndaModal').classList.remove('show');
    currentDealId = null;
    if (typeof renderDeals === 'function') renderDeals();
  }

  function render() {
    const n = view.ncnda;
    const sigs = n.signatures || [];
    const internal = sigs.filter((s) => s.party === 'internal');
    const client = sigs.find((s) => s.party === 'client');
    const uploads = view.clientUploads || [];

    const statusBadge = n.status === 'finalized'
      ? '<span class="badge badge-success">Finalized</span>'
      : '<span class="badge badge-warning">Pending signatures</span>';

    const certBlock = n.status === 'finalized'
      ? `<div class="card mt-4">
           <div class="card-body">
             <div class="font-bold text-success mb-2">Verifiable certificate</div>
             <div class="text-xs">ID: <strong>${esc(n.certificateId)}</strong></div>
             <div class="text-xs text-muted" style="word-break:break-all;">Hash: ${esc(n.certHash)}</div>
             <div class="text-xs text-muted">Finalized: ${new Date(n.finalizedAt).toLocaleString()}</div>
             <a href="/api/certificate?cert=${encodeURIComponent(n.certificateId)}" target="_blank" class="btn btn-secondary btn-sm mt-4">Open verification record</a>
           </div>
         </div>`
      : '';

    const sigRow = (s) => `<div class="flex justify-between items-center text-xs" style="padding:6px 0;border-bottom:1px solid var(--gray-100);">
        <span><strong>${esc(s.name)}</strong>${s.title ? ' \u00b7 ' + esc(s.title) : ''} <span class="text-muted">(${esc(s.party)})</span></span>
        <span class="text-muted">${new Date(s.signedAt).toLocaleString()}</span></div>`;

    const uploadRow = (u) => `<div class="flex justify-between items-center text-xs" style="padding:var(--sp-2) var(--sp-3);background:var(--gray-50);border-radius:var(--radius-md);margin-bottom:var(--sp-2);">
        <span><a href="#" data-dl="${esc(u.path)}">${esc(u.filename)}</a></span>
        <span class="text-muted">${new Date(u.uploadedAt).toLocaleString()}</span></div>`;

    document.getElementById('ncBody').innerHTML = `
      <div class="card mb-4">
        <div class="card-body flex gap-4 items-center" style="flex-wrap:wrap;">
          <div>
            <div class="text-xs text-muted" style="text-transform:uppercase;letter-spacing:.5px;">Status</div>
            ${statusBadge}
          </div>
          <div style="flex:1;min-width:220px;">
            <div class="text-xs text-muted" style="text-transform:uppercase;letter-spacing:.5px;">Client portal link</div>
            <div class="flex gap-2 mt-2">
              <input id="ncLink" readonly value="${esc(view.portalUrl)}" class="form-input text-xs" style="flex:1;">
              <button class="btn btn-secondary btn-sm" onclick="HGCNcnda.copy()">Copy</button>
              <button class="btn btn-secondary btn-sm" onclick="HGCNcnda.copyAndOpen()">Copy &amp; Open</button>
            </div>
            <div class="text-xs text-muted mt-2">Send this to the client. They must sign the NCNDA before they can upload.</div>
          </div>
        </div>
      </div>

      <div class="form-row mb-6">
        <div>
          <div class="font-semibold text-sm mb-2">Our signatures (internal)</div>
          ${internal.length ? internal.map(sigRow).join('') : '<div class="text-xs text-muted">No internal signatures yet.</div>'}
          <div class="card mt-4">
            <div class="card-body">
              <div class="font-semibold text-xs mb-2">Add your signature</div>
              <div class="form-group">
                <input id="ncName" class="form-input" placeholder="Full name *">
              </div>
              <div class="form-group">
                <input id="ncTitle" class="form-input" placeholder="Title (e.g. Managing Partner)">
              </div>
              <div class="form-group">
                <input id="ncEmail" class="form-input" placeholder="Email">
              </div>
              <button class="btn btn-primary btn-sm w-full" onclick="HGCNcnda.sign()">Sign NCNDA</button>
              <div id="ncErr" class="form-error mt-2"></div>
            </div>
          </div>
        </div>
        <div>
          <div class="font-semibold text-sm mb-2">Client signature</div>
          ${client ? sigRow(client) : '<div class="text-xs text-muted">Client has not signed yet.</div>'}
          ${certBlock}
        </div>
      </div>

      <div>
        <div class="font-semibold text-sm mb-2">Client uploads (${uploads.length})</div>
        ${uploads.length ? uploads.map(uploadRow).join('') : '<div class="text-xs text-muted">No documents uploaded by the client yet.</div>'}
      </div>`;

    // wire client-upload download links via delegation (no inline handlers)
    const body = document.getElementById('ncBody');
    body.onclick = async (e) => {
      const a = e.target.closest('[data-dl]');
      if (!a) return;
      e.preventDefault();
      try {
        const r = await fetch('/api/download-url?path=' + encodeURIComponent(a.dataset.dl));
        if (!r.ok) throw new Error('no url');
        const { url } = await r.json();
        window.open(url, '_blank');
      } catch (err) { alert('Download error: ' + err.message); }
    };
  }

  function copy() {
    const el = document.getElementById('ncLink');
    el.select();
    navigator.clipboard.writeText(el.value).then(() => {}, () => { document.execCommand('copy'); });
    if (typeof showToast === 'function') showToast('Link copied', 'success');
  }

  function copyAndOpen() {
    const el = document.getElementById('ncLink');
    el.select();
    navigator.clipboard.writeText(el.value).then(() => {}, () => { document.execCommand('copy'); });
    window.open(el.value, '_blank');
    if (typeof showToast === 'function') showToast('Link copied & opened', 'success');
  }

  async function sign() {
    const name = document.getElementById('ncName').value.trim();
    const title = document.getElementById('ncTitle').value.trim();
    const email = document.getElementById('ncEmail').value.trim();
    const err = document.getElementById('ncErr');
    err.textContent = '';
    if (!name) { err.textContent = 'Enter your full name to sign.'; return; }
    try {
      const r = await fetch('/api/ncnda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId: currentDealId, name, title, email }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'could not sign');
      const deal = deals.find((x) => x.id === currentDealId);
      if (deal) deal.ncnda = d.ncnda;
      view.ncnda = d.ncnda;
      render();
      if (typeof showToast === 'function') showToast('NCNDA signed', 'success');
    } catch (e) {
      err.textContent = e.message;
    }
  }

  function ncndaBadge(deal) {
    const n = deal.ncnda;
    if (!n) return '<span class="badge badge-neutral">No NCNDA</span>';
    if (n.status === 'finalized') return '<span class="badge badge-success">Finalized</span>';
    return '<span class="badge badge-warning">Pending Signatures</span>';
  }

  window.HGCNcnda = { open, close, sign, copy, copyAndOpen, cardStatus, ncndaBadge };
})();
