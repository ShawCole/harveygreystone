/* HGC & ARK — Data Room module.
   Renders the Capital Raise Data Room template (10 sections / 28 subfolders /
   120 docs) per deal: intake-pipeline status, real file uploads (GCS signed
   URLs), and completeness tracking gated by deal size + international flag.
   Loaded as a classic script after the inline app script, so it shares the
   globals `deals`, `saveData`, and `renderDeals`. */
(function () {
  let TEMPLATE = null;
  let currentDealId = null;
  const expandedSections = new Set();

  const STATUSES = ['outstanding', 'requested', 'received', 'reviewed', 'na'];
  const STATUS_LABEL = { outstanding: 'Outstanding', requested: 'Requested', received: 'Received', reviewed: 'Reviewed', na: 'N/A' };
  const STATUS_BADGE = { outstanding: 'badge-neutral', requested: 'badge-warning', received: 'badge-info', reviewed: 'badge-success', na: 'badge-neutral' };

  const BAND_SECTIONS = {
    small: ['01', '02', '03', '04', '07'],
    mid:   ['01', '02', '03', '04', '05', '06', '07'],
    large: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'],
  };
  const BAND_LABEL = { small: '$1M\u2013$5M', mid: '$5M\u2013$25M', large: '$25M\u2013$100M' };

  async function loadTemplate() {
    try {
      const res = await fetch('/data-room-template.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      TEMPLATE = await res.json();
      const app = document.getElementById('mainApp');
      if (app && !app.classList.contains('hidden') && typeof renderDeals === 'function') renderDeals();
    } catch (e) {
      console.error('data room template load failed', e);
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const docId = (section, sfIdx, dIdx) => `${section.id}.${sfIdx}.${dIdx}`;

  function band(capital) {
    const c = Number(capital) || 0;
    if (c === 0) return 'zero';
    if (c >= 25000000) return 'large';
    if (c >= 5000000) return 'mid';
    return 'small';
  }
  function inScope(deal, sectionId) {
    if (deal.intl && sectionId === '06') return true;
    const b = band(deal.capital);
    if (b === 'zero') return false;
    return BAND_SECTIONS[b].includes(sectionId);
  }
  function isRequired(deal, section, doc) {
    if (deal.intl && section.id === '06') return true;
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
    if (!TEMPLATE) return '<div class="text-xs text-muted">Loading\u2026</div>';
    const c = completeness(deal);
    const colorClass = c.pct >= 100 ? 'green' : c.pct >= 50 ? 'amber' : 'red';
    return `<div class="text-xs text-muted mb-2">${c.reqDone}/${c.req} required docs \u00b7 ${c.pct}%</div>
      <div class="progress"><div class="progress-fill ${colorClass}" style="width:${c.pct}%"></div></div>`;
  }

  function open(dealId) {
    if (!TEMPLATE) { alert('Data room template is still loading \u2014 try again in a moment.'); return; }
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    if (!deal.dataRoom) deal.dataRoom = {};
    currentDealId = dealId;
    document.getElementById('drDealName').textContent = `Data Room \u2014 ${deal.name}`;
    ensureDelegation();
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

    const bandNote = b === 'zero'
      ? '<div class="text-danger font-semibold text-sm">Set deal capital to see required documents</div>'
      : `<div class="font-bold">${BAND_LABEL[b]}</div>`;

    document.getElementById('drControls').innerHTML = `
      <div class="card-body flex gap-5 items-center" style="flex-wrap:wrap;">
        <div>
          <div class="text-xs text-muted" style="text-transform:uppercase;letter-spacing:.5px;">Readiness</div>
          <div class="font-bold" style="font-size:22px;">${c.reqDone}/${c.req} <span class="text-sm text-muted font-semibold">required \u00b7 ${c.pct}%</span></div>
        </div>
        <div>
          <div class="text-xs text-muted" style="text-transform:uppercase;letter-spacing:.5px;">Deal Size Band</div>
          ${bandNote}
        </div>
        <label class="flex items-center gap-2 text-sm font-semibold" style="cursor:pointer;margin-left:auto;">
          <input type="checkbox" ${deal.intl ? 'checked' : ''} onchange="HGCDataRoom.toggleIntl(this.checked)" style="width:16px;height:16px;cursor:pointer;">
          International / cross-border
        </label>
      </div>`;

    let html = '';
    TEMPLATE.sections.forEach((sec) => {
      let sReq = 0, sDone = 0;
      sec.subfolders.forEach((sf, si) => sf.documents.forEach((doc, di) => {
        if (isRequired(deal, sec, doc)) { sReq++; if (isSatisfied(docState(deal, docId(sec, si, di)))) sDone++; }
      }));
      const scoped = inScope(deal, sec.id);
      const secIdx = TEMPLATE.sections.indexOf(sec);
      const isOpen = expandedSections.has(secIdx);

      html += `<div class="dr-section ${isOpen ? 'open' : ''}" style="${scoped ? '' : 'opacity:0.6;'}">
        <div class="dr-section-header" data-act="toggle-section" data-sec="${secIdx}">
          <div class="dr-section-title">
            <span class="dr-section-toggle">\u25B8</span>
            ${sec.id} \u00b7 ${esc(sec.name)}
            ${scoped ? '' : '<span class="text-xs text-muted font-semibold">(optional at this deal size)</span>'}
          </div>
          <span class="text-xs text-muted font-semibold">${sDone}/${sReq} req</span>
        </div>
        <div class="dr-section-body">`;

      if (isOpen) {
        sec.subfolders.forEach((sf, si) => {
          html += `<div class="dr-subfolder-label">${esc(sf.name)}</div>`;
          sf.documents.forEach((doc, di) => {
            html += docRow(deal, docId(sec, si, di), doc, isRequired(deal, sec, doc), docState(deal, docId(sec, si, di)));
          });
        });
      }

      html += `</div></div>`;
    });
    document.getElementById('drBody').innerHTML = html;
  }

  function docRow(deal, id, doc, req, st) {
    const file = st.file;
    const sel = STATUSES.map((s) => `<option value="${s}" ${st.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('');
    const reqBadge = req
      ? '<span class="badge badge-danger">REQ</span>'
      : '<span class="badge badge-neutral">OPT</span>';
    const fileLine = file
      ? `<div class="text-xs mt-2"><a href="#" class="text-info" data-act="download" data-path="${esc(file.path)}">${esc(file.filename)}</a> \u00b7 <a href="#" class="text-danger" data-act="remove" data-id="${esc(id)}">remove</a></div>`
      : '';
    return `<div class="dr-doc-row">
      <div class="dr-doc-name">
        ${esc(doc.name)} ${reqBadge}
        ${fileLine}
      </div>
      <select data-act="status" data-id="${esc(id)}" class="form-input btn-sm" style="border-left:3px solid var(--gray-300);">${sel}</select>
      <div class="dr-doc-actions">
        <button class="btn btn-secondary btn-sm" data-act="upload" data-id="${esc(id)}">Upload</button>
      </div>
    </div>`;
  }

  let delegated = false;
  function ensureDelegation() {
    if (delegated) return;
    const body = document.getElementById('drBody');
    if (!body) return;
    body.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || !body.contains(el)) return;
      const act = el.dataset.act;
      if (act === 'download') { e.preventDefault(); download(el.dataset.path); }
      else if (act === 'remove') { e.preventDefault(); removeFile(el.dataset.id); }
      else if (act === 'upload') { e.preventDefault(); upload(el.dataset.id); }
      else if (act === 'toggle-section') { e.preventDefault(); const idx = Number(el.dataset.sec); if (expandedSections.has(idx)) expandedSections.delete(idx); else expandedSections.add(idx); render(); }
    });
    body.addEventListener('change', (e) => {
      const el = e.target.closest('select[data-act="status"]');
      if (!el || !body.contains(el)) return;
      setStatus(el.dataset.id, el.value);
    });
    delegated = true;
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
      const btn = document.querySelector(`button[data-act="upload"][data-id="${CSS.escape(id)}"]`);
      if (btn) { btn.disabled = true; btn.textContent = 'Uploading\u2026'; }
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
        if (typeof showToast === 'function') showToast('File uploaded');
      } catch (e) {
        alert('Upload error: ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Upload'; }
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
    try {
      const r = await fetch('/api/file', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
      if (!r.ok) throw new Error('Server returned ' + r.status);
    } catch (e) {
      alert('Could not delete file: ' + e.message);
      return;
    }
    delete deal.dataRoom[id].file;
    saveData();
    render();
  }

  function portfolioReadiness() {
    const el = document.getElementById('dashboardReadiness');
    if (!el || !TEMPLATE) return;
    const rated = deals.map((d) => ({ d, c: completeness(d) }));
    const totReq = rated.reduce((s, x) => s + x.c.req, 0);
    const totDone = rated.reduce((s, x) => s + x.c.reqDone, 0);
    const overall = totReq ? Math.round((totDone / totReq) * 100) : 0;
    const sorted = [...rated].sort((a, b) => a.c.pct - b.c.pct);

    el.innerHTML =
      `<div class="text-sm text-muted mb-4">Portfolio readiness: <strong class="font-bold" style="color:var(--gray-900);">${totDone}/${totReq} required docs (${overall}%)</strong> across ${deals.length} deals</div>` +
      sorted.map(({ d, c }) => {
        const colorClass = c.pct >= 100 ? 'green' : c.pct >= 50 ? 'amber' : 'red';
        return `<div class="flex items-center gap-4" style="padding:.55rem 0;border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="HGCDataRoom.open(${d.id})">
          <div style="flex:1;min-width:0;">
            <div class="font-semibold text-sm">${esc(d.name)}</div>
            <div class="progress mt-2"><div class="progress-fill ${colorClass}" style="width:${c.pct}%"></div></div>
          </div>
          <div class="text-xs text-muted" style="white-space:nowrap;">${c.reqDone}/${c.req} \u00b7 ${c.pct}%</div>
        </div>`;
      }).join('');
  }

  window.HGCDataRoom = { open, close, setStatus, toggleIntl, upload, download, removeFile, cardSummary, completeness, portfolioReadiness };
  loadTemplate();
})();
