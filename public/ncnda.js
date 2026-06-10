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
    if (!n) return '<div style="font-size:11px;color:var(--secondary);">Portal not set up</div>';
    const client = (n.signatures || []).some((s) => s.party === 'client');
    const color = n.status === 'finalized' ? '#10b981' : client ? '#0ea5e9' : '#f59e0b';
    const label = n.status === 'finalized' ? 'NCNDA finalized ✓' : client ? 'Client signed — needs our signature' : 'Awaiting client signature';
    return `<div style="font-size:11px;font-weight:700;color:${color};">🔏 ${label}</div>`;
  }

  async function open(dealId) {
    currentDealId = dealId;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    document.getElementById('ncDealName').textContent = `Client Portal & NCNDA — ${deal.name}`;
    document.getElementById('ncBody').innerHTML = '<p style="color:var(--secondary);">Loading…</p>';
    document.getElementById('ncndaModal').classList.add('show');
    try {
      const r = await fetch('/api/ncnda?dealId=' + encodeURIComponent(dealId));
      if (!r.ok) throw new Error('could not load');
      view = await r.json();
      render();
    } catch (e) {
      document.getElementById('ncBody').innerHTML = '<p style="color:var(--danger);">Could not load the portal. Try again.</p>';
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

    const statusColor = n.status === 'finalized' ? '#10b981' : '#f59e0b';
    const statusText = n.status === 'finalized' ? 'Finalized' : 'Pending signatures';

    const certBlock = n.status === 'finalized'
      ? `<div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.3);border-radius:12px;padding:1rem;margin-top:1rem;">
           <div style="font-weight:700;color:#065f46;margin-bottom:4px;">✓ Verifiable certificate</div>
           <div style="font-size:12px;">ID: <strong>${esc(n.certificateId)}</strong></div>
           <div style="font-size:11px;color:var(--secondary);word-break:break-all;">Hash: ${esc(n.certHash)}</div>
           <div style="font-size:11px;color:var(--secondary);">Finalized: ${new Date(n.finalizedAt).toLocaleString()}</div>
           <a href="/api/certificate?cert=${encodeURIComponent(n.certificateId)}" target="_blank" style="font-size:12px;font-weight:600;">Open verification record →</a>
         </div>`
      : '';

    const sigRow = (s) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
        <span><strong>${esc(s.name)}</strong>${s.title ? ' · ' + esc(s.title) : ''} <span style="color:var(--secondary);">(${esc(s.party)})</span></span>
        <span style="color:var(--secondary);">${new Date(s.signedAt).toLocaleString()}</span></div>`;

    const uploadRow = (u) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--lighter);border-radius:8px;margin-bottom:6px;font-size:12px;">
        <span>📄 <a href="#" data-dl="${esc(u.path)}">${esc(u.filename)}</a></span>
        <span style="color:var(--secondary);">${new Date(u.uploadedAt).toLocaleString()}</span></div>`;

    document.getElementById('ncBody').innerHTML = `
      <div style="display:flex;gap:1rem;align-items:center;background:var(--lighter);border-radius:12px;padding:1rem;margin-bottom:1.25rem;flex-wrap:wrap;">
        <div><div style="font-size:11px;color:var(--secondary);text-transform:uppercase;letter-spacing:.5px;">Status</div>
          <div style="font-weight:800;color:${statusColor};">${statusText}</div></div>
        <div style="flex:1;min-width:220px;">
          <div style="font-size:11px;color:var(--secondary);text-transform:uppercase;letter-spacing:.5px;">Client portal link</div>
          <div style="display:flex;gap:6px;margin-top:4px;">
            <input id="ncLink" readonly value="${esc(view.portalUrl)}" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;">
            <button class="btn btn-secondary btn-small" onclick="HGCNcnda.copy()">Copy</button>
          </div>
          <div style="font-size:11px;color:var(--secondary);margin-top:4px;">Send this to the client. They must sign the NCNDA before they can upload.</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;">
        <div>
          <div style="font-weight:700;font-size:13px;margin-bottom:.5rem;">Our signatures (internal)</div>
          ${internal.length ? internal.map(sigRow).join('') : '<div style="font-size:12px;color:var(--secondary);">No internal signatures yet.</div>'}
          <div style="margin-top:1rem;padding:1rem;border:1px dashed var(--border);border-radius:10px;">
            <div style="font-weight:600;font-size:12px;margin-bottom:.5rem;">Add your signature</div>
            <input id="ncName" placeholder="Full name *" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-bottom:6px;">
            <input id="ncTitle" placeholder="Title (e.g. Managing Partner)" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-bottom:6px;">
            <input id="ncEmail" placeholder="Email" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-bottom:8px;">
            <button class="btn btn-primary btn-small" style="width:100%;" onclick="HGCNcnda.sign()">Sign NCNDA</button>
            <div class="ncErr" id="ncErr" style="color:var(--danger);font-size:12px;margin-top:6px;"></div>
          </div>
        </div>
        <div>
          <div style="font-weight:700;font-size:13px;margin-bottom:.5rem;">Client signature</div>
          ${client ? sigRow(client) : '<div style="font-size:12px;color:var(--secondary);">Client has not signed yet.</div>'}
          ${certBlock}
        </div>
      </div>

      <div style="margin-top:1.5rem;">
        <div style="font-weight:700;font-size:13px;margin-bottom:.5rem;">Client uploads (${uploads.length})</div>
        ${uploads.length ? uploads.map(uploadRow).join('') : '<div style="font-size:12px;color:var(--secondary);">No documents uploaded by the client yet.</div>'}
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
      // reflect into the in-memory deal so the card status updates on close
      const deal = deals.find((x) => x.id === currentDealId);
      if (deal) deal.ncnda = d.ncnda;
      view.ncnda = d.ncnda;
      render();
    } catch (e) {
      err.textContent = e.message;
    }
  }

  window.HGCNcnda = { open, close, sign, copy, cardStatus };
})();
