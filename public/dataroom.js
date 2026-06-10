/* HGC & ARK — Data Room module.
   Renders the Capital Raise Data Room template (10 sections / 28 subfolders /
   120 docs) per deal: intake-pipeline status, real file uploads (GCS signed
   URLs), and completeness tracking gated by deal size + international flag.
   Loaded as a classic script after the inline app script, so it shares the
   globals `deals`, `saveData`, and `renderDeals`. */
(function () {
  let TEMPLATE = null;
  let currentDealId = null;

  const STATUSES = ['outstanding', 'requested', 'received', 'reviewed', 'na'];
  const STATUS_LABEL = { outstanding: 'Outstanding', requested: 'Requested', received: 'Received', reviewed: 'Reviewed', na: 'N/A' };
  const STATUS_COLOR = { outstanding: '#94a3b8', requested: '#f59e0b', received: '#0ea5e9', reviewed: '#10b981', na: '#cbd5e1' };

  // Which sections count toward "required" at each deal-size band (from the
  // template's Deal Size Guidance). International deals always pull in Sec 06.
  const BAND_SECTIONS = {
    small: ['01', '02', '03', '04', '07'],                                    // $1M–$5M
    mid:   ['01', '02', '03', '04', '05', '06', '07'],                        // $5M–$25M
    large: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'],      // $25M–$100M
  };
  const BAND_LABEL = { small: '$1M–$5M', mid: '$5M–$25M', large: '$25M–$100M' };

  async function loadTemplate() {
    try {
      const res = await fetch('/data-room-template.json');
      TEMPLATE = await res.json();
      const app = document.getElementById('mainApp');
      if (app && app.style.display !== 'none' && typeof renderDeals === 'function') renderDeals();
    } catch (e) {
      console.error('data room template load failed', e);
    }
  }

  // Escape user-controlled strings (e.g. uploaded filenames) before they go
  // into innerHTML, to prevent stored XSS from a malicious filename.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const docId = (section, sfIdx, dIdx) => `${section.id}.${sfIdx}.${dIdx}`;

  function band(capital) {
    const c = Number(capital) || 0;
    if (c >= 25000000) return 'large';
    if (c >= 5000000) return 'mid';
    return 'small';
  }
  function inScope(deal, sectionId) {
    if (deal.intl && sectionId === '06') return true;
    return BAND_SECTIONS[band(deal.capital)].includes(sectionId);
  }
  function isRequired(deal, section, doc) {
    if (deal.intl && section.id === '06') return true; // intl → all of Sec 06 required
    return !!doc.required && inScope(deal, section.id);
  }
  const docState = (deal, id) => (deal.dataRoom && deal.dataRoom[id]) || { status: 'outstanding' };
  const isSatisfied = (st) => st && (st.status === 'received' || st.status === 'reviewed' || st.status === 'na');

  function completeness(deal) {
    if (!TEMPLATE) return { req: 0, reqDone: 0, pct: 0 };
    let req = 0, reqDone = 0;
    TEMPLATE.sections.forEach((sec) => {
      sec.subfolders.forEach((sf, si) => {
        sf.documents.forEach((doc, di) => {
          if (isRequired(deal, sec, doc)) {
            req++;
            if (isSatisfied(docState(deal, docId(sec, si, di)))) reqDone++;
          }
        });
      });
    });
    return { req, reqDone, pct: req ? Math.round((reqDone / req) * 100) : 0 };
  }

  function cardSummary(deal) {
    if (!TEMPLATE) return '<div style="color:#64748b;font-size:12px;">Loading…</div>';
    const c = completeness(deal);
    const color = c.pct >= 100 ? '#10b981' : c.pct >= 50 ? '#f59e0b' : '#ef4444';
    return `<div style="font-size:12px;color:var(--secondary);margin-bottom:6px;">${c.reqDone}/${c.req} required docs · ${c.pct}%</div>
      <div style="height:6px;background:var(--lighter);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${c.pct}%;background:${color};transition:width .3s;"></div></div>`;
  }

  function open(dealId) {
    if (!TEMPLATE) { alert('Data room template is still loading — try again in a moment.'); return; }
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    if (!deal.dataRoom) deal.dataRoom = {};
    currentDealId = dealId;
    document.getElementById('drDealName').textContent = `Data Room — ${deal.name}`;
    render();
    document.getElementById('dataRoomModal').classList.add('show');
  }
  function close() {
    document.getElementById('dataRoomModal').classList.remove('show');
    currentDealId = null;
    if (typeof renderDeals === 'function') renderDeals();
  }

  function render() {
    const deal = deals.find((d) => d.id === currentDealId);
    if (!deal) return;
    const c = completeness(deal);
    const b = band(deal.capital);

    document.getElementById('drControls').innerHTML = `
      <div><div style="font-size:11px;color:var(--secondary);text-transform:uppercase;letter-spacing:.5px;">Readiness</div>
        <div style="font-size:22px;font-weight:800;">${c.reqDone}/${c.req} <span style="font-size:13px;color:var(--secondary);font-weight:600;">required · ${c.pct}%</span></div></div>
      <div><div style="font-size:11px;color:var(--secondary);text-transform:uppercase;letter-spacing:.5px;">Deal Size Band</div>
        <div style="font-weight:700;font-size:15px;">${BAND_LABEL[b]}</div></div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;margin-left:auto;">
        <input type="checkbox" ${deal.intl ? 'checked' : ''} onchange="HGCDataRoom.toggleIntl(this.checked)" style="width:16px;height:16px;cursor:pointer;">
        International / cross-border</label>`;

    let html = '';
    TEMPLATE.sections.forEach((sec) => {
      let sReq = 0, sDone = 0;
      sec.subfolders.forEach((sf, si) => sf.documents.forEach((doc, di) => {
        if (isRequired(deal, sec, doc)) { sReq++; if (isSatisfied(docState(deal, docId(sec, si, di)))) sDone++; }
      }));
      const scoped = inScope(deal, sec.id);
      html += `<div style="margin-bottom:1.25rem;opacity:${scoped ? 1 : 0.6};">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:2px solid var(--border);">
          <div style="font-weight:800;font-size:14px;">${sec.id} · ${sec.name} ${scoped ? '' : '<span style="font-size:11px;color:var(--secondary);font-weight:600;">(optional at this deal size)</span>'}</div>
          <div style="font-size:12px;color:var(--secondary);font-weight:600;">${sDone}/${sReq} req</div>
        </div>`;
      sec.subfolders.forEach((sf, si) => {
        html += `<div style="margin:0.75rem 0 0.35rem;font-size:11px;font-weight:700;color:var(--secondary);text-transform:uppercase;letter-spacing:.6px;">${sf.name}</div>`;
        sf.documents.forEach((doc, di) => {
          html += docRow(deal, docId(sec, si, di), doc, isRequired(deal, sec, doc), docState(deal, docId(sec, si, di)));
        });
      });
      html += `</div>`;
    });
    document.getElementById('drBody').innerHTML = html;
  }

  function docRow(deal, id, doc, req, st) {
    const file = st.file;
    const sel = STATUSES.map((s) => `<option value="${s}" ${st.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('');
    const safePath = file ? file.path.replace(/'/g, "\\'") : '';
    const badge = req
      ? '<span style="font-size:10px;color:#991b1b;background:#fecaca;padding:1px 6px;border-radius:4px;font-weight:700;">REQ</span>'
      : '<span style="font-size:10px;color:#64748b;background:#e2e8f0;padding:1px 6px;border-radius:4px;font-weight:700;">OPT</span>';
    return `<div style="display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:8px 10px;border-radius:8px;background:var(--lighter);margin-bottom:6px;">
      <div style="min-width:0;">
        <div style="font-size:13px;font-weight:600;">${doc.name} ${badge}</div>
        ${file ? `<div style="font-size:11px;color:var(--accent);margin-top:3px;">📄 <a href="#" onclick="HGCDataRoom.download('${safePath}');return false;">${esc(file.filename)}</a> · <a href="#" style="color:#ef4444;" onclick="HGCDataRoom.removeFile('${id}');return false;">remove</a></div>` : ''}
      </div>
      <select onchange="HGCDataRoom.setStatus('${id}', this.value)" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-weight:600;border-left:3px solid ${STATUS_COLOR[st.status] || '#94a3b8'};">${sel}</select>
      <button class="doc-btn" onclick="HGCDataRoom.upload('${id}')" style="white-space:nowrap;">⬆ Upload</button>
    </div>`;
  }

  function setStatus(id, val) {
    const deal = deals.find((d) => d.id === currentDealId);
    if (!deal) return;
    if (!deal.dataRoom) deal.dataRoom = {};
    deal.dataRoom[id] = { ...(deal.dataRoom[id] || {}), status: val, updatedAt: new Date().toISOString() };
    saveData();
    render();
  }
  function toggleIntl(v) {
    const deal = deals.find((d) => d.id === currentDealId);
    if (!deal) return;
    deal.intl = v;
    saveData();
    render();
  }

  async function upload(id) {
    const deal = deals.find((d) => d.id === currentDealId);
    if (!deal) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const f = input.files[0];
      if (!f) return;
      try {
        const r = await fetch('/api/upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId: deal.id, docId: id, filename: f.name, contentType: f.type || 'application/octet-stream' }),
        });
        if (!r.ok) throw new Error('could not get upload URL');
        const { url, path } = await r.json();
        const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': f.type || 'application/octet-stream' }, body: f });
        if (!put.ok) throw new Error('upload to storage failed');
        if (!deal.dataRoom) deal.dataRoom = {};
        const prev = deal.dataRoom[id] || { status: 'outstanding' };
        const nextStatus = (prev.status === 'outstanding' || prev.status === 'requested') ? 'received' : prev.status;
        deal.dataRoom[id] = {
          ...prev, status: nextStatus,
          file: { path, filename: f.name, size: f.size, uploadedAt: new Date().toISOString() },
          updatedAt: new Date().toISOString(),
        };
        saveData();
        render();
      } catch (e) {
        alert('Upload error: ' + e.message);
      }
    };
    input.click();
  }

  async function download(path) {
    try {
      const r = await fetch('/api/download-url?path=' + encodeURIComponent(path));
      if (!r.ok) throw new Error('could not get download URL');
      const { url } = await r.json();
      window.open(url, '_blank');
    } catch (e) {
      alert('Download error: ' + e.message);
    }
  }

  async function removeFile(id) {
    const deal = deals.find((d) => d.id === currentDealId);
    if (!deal || !deal.dataRoom || !deal.dataRoom[id] || !deal.dataRoom[id].file) return;
    if (!confirm('Remove this file from the data room?')) return;
    const path = deal.dataRoom[id].file.path;
    try { await fetch('/api/file', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) }); } catch (e) { /* best effort */ }
    delete deal.dataRoom[id].file;
    saveData();
    render();
  }

  window.HGCDataRoom = { open, close, setStatus, toggleIntl, upload, download, removeFile, cardSummary, completeness };
  loadTemplate();
})();
