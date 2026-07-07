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
  let inlineTarget = null;

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
    inlineTarget = null;
    document.getElementById('drDealName').textContent = `Data Room \u2014 ${deal.name}`;
    ensureDelegation();
    render();
    document.getElementById('dataRoomModal').classList.add('show');
  }
  function close() {
    document.getElementById('dataRoomModal').classList.remove('show');
    currentDealId = null;
    inlineTarget = null;
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

    // If rendering inline (deal detail modal), build everything into inlineTarget
    if (inlineTarget) {
      renderInline(currentDealId, inlineTarget);
      return;
    }

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

    let html = `
      <div class="card mb-6">
        <div class="card-header">
          <div class="card-header-title">Batch Upload</div>
        </div>
        <div class="card-body">
          <div class="upload-zone" id="drBatchZone">
            <div class="upload-zone-text">
              <strong>Drop multiple files here</strong> or click to select<br>
              <span class="text-xs text-muted">Files will be auto-matched to document categories</span>
            </div>
          </div>
          <input type="file" id="drBatchInput" multiple style="display:none">
          <div id="drBatchPreview"></div>
        </div>
      </div>`;
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

    // Set up batch upload zone
    const batchZone = document.getElementById('drBatchZone');
    const batchInput = document.getElementById('drBatchInput');
    if (batchZone && batchInput) {
      batchZone.onclick = () => batchInput.click();
      batchZone.ondragover = (e) => { e.preventDefault(); batchZone.classList.add('dragover'); };
      batchZone.ondragleave = () => batchZone.classList.remove('dragover');
      batchZone.ondrop = (e) => { e.preventDefault(); batchZone.classList.remove('dragover'); handleBatchFiles(e.dataTransfer.files); };
      batchInput.onchange = () => { handleBatchFiles(batchInput.files); batchInput.value = ''; };
    }
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
  const delegatedContainers = new WeakSet();
  function ensureDelegation() {
    // Attach to whichever container exists (modal drBody or inline target)
    const targets = [document.getElementById('drBody'), inlineTarget].filter(Boolean);
    targets.forEach(body => {
      if (delegatedContainers.has(body)) return;
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
      delegatedContainers.add(body);
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

  // --- Batch upload with auto-categorization ---

  function matchFileToDoc(filename) {
    if (!TEMPLATE) return null;
    const name = filename.toLowerCase().replace(/[-_\.]/g, ' ').replace(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|csv|txt)$/i, '');
    let best = null, bestScore = 0;

    TEMPLATE.sections.forEach((sec) => {
      sec.subfolders.forEach((sf, si) => {
        sf.documents.forEach((doc, di) => {
          const docName = doc.name.toLowerCase();
          const fileWords = name.split(/\s+/).filter(w => w.length > 2);
          const docWords = docName.split(/\s+/).filter(w => w.length > 2);
          let score = 0;
          fileWords.forEach(fw => {
            docWords.forEach(dw => {
              if (dw.includes(fw) || fw.includes(dw)) score += 1;
              if (dw === fw) score += 2;
            });
          });
          const secWords = sec.name.toLowerCase().split(/\s+/);
          fileWords.forEach(fw => {
            secWords.forEach(sw => {
              if (sw.includes(fw) || fw.includes(sw)) score += 0.5;
            });
          });

          if (score > bestScore) {
            bestScore = score;
            best = { secId: sec.id, secName: sec.name, sfIdx: si, sfName: sf.name, docIdx: di, docName: doc.name, docId: docId(sec, si, di), score };
          }
        });
      });
    });

    return best && bestScore >= 1 ? { ...best, confidence: Math.min(100, Math.round(bestScore * 20)) } : null;
  }

  let pendingBatch = [];
  let pendingContacts = [];
  let addContactsChecked = true;

  async function handleBatchFiles(fileList) {
    const files = Array.from(fileList);
    const preview = document.getElementById('drBatchPreview');

    // Initialize pendingBatch with files (no matches yet)
    pendingBatch = files.map(f => ({ file: f, match: null, selected: true }));
    pendingContacts = [];

    // Show loading state
    if (preview) {
      preview.innerHTML = `
        <div class="mt-4" style="text-align:center;padding:2rem;">
          <div class="font-semibold mb-2">Analyzing ${files.length} document${files.length > 1 ? 's' : ''} with AI...</div>
          <div class="text-sm text-muted">Extracting text and classifying documents</div>
          <div class="progress mt-4" style="max-width:300px;margin:0 auto;"><div class="progress-fill amber" style="width:30%;animation:pulse 1.5s infinite;"></div></div>
        </div>`;
    }

    // Extract text from PDFs client-side
    const fileData = [];
    for (const f of files) {
      let text = '';
      if ((f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) && typeof extractPdfText === 'function') {
        try {
          text = await extractPdfText(f);
        } catch (e) {
          console.warn('PDF text extraction failed for', f.name, e);
        }
      }
      fileData.push({ filename: f.name, text });
    }

    // Build template sections for the API
    const templateSections = TEMPLATE ? TEMPLATE.sections.map(sec => ({
      id: sec.id,
      name: sec.name,
      subfolders: sec.subfolders.map(sf => ({
        name: sf.name,
        documents: sf.documents.map(d => ({ name: d.name }))
      }))
    })) : [];

    // Try AI classification
    let aiSuccess = false;
    try {
      const res = await fetch('/api/classify-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileData, templateSections })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.classifications && Array.isArray(data.classifications)) {
          // Map AI classifications back to pendingBatch
          pendingBatch = files.map((f, i) => {
            const cls = data.classifications.find(c => c.filename === f.name) || data.classifications[i];
            if (cls && cls.confidence >= 30 && cls.matchedDocName !== 'Uncategorized') {
              // Ensure section ID is zero-padded to match template format (e.g., "4" → "04")
              const secId = String(cls.matchedSection).padStart(2, '0');
              // Validate AI-returned indexes against the template so we never save
              // under an orphan docId that no row will ever render
              const sec = TEMPLATE && TEMPLATE.sections.find(s => s.id === secId);
              const sfIdx = Number(cls.matchedSubfolderIndex);
              const dIdx = Number(cls.matchedDocIndex);
              const sf = sec && sec.subfolders[sfIdx];
              const docEntry = sf && sf.documents[dIdx];
              if (docEntry) {
                return {
                  file: f,
                  match: {
                    secId: secId,
                    secName: sec.name,
                    sfIdx: sfIdx,
                    docIdx: dIdx,
                    docName: docEntry.name,
                    docId: `${secId}.${sfIdx}.${dIdx}`,
                    confidence: cls.confidence,
                    reasoning: cls.reasoning
                  },
                  selected: true
                };
              }
              // AI indexes didn't resolve — fall back to fuzzy filename match
              const fuzzy = matchFileToDoc(f.name);
              if (fuzzy) return { file: f, match: fuzzy, selected: true };
            }
            return { file: f, match: null, selected: false };
          });

          // Collect all contacts
          pendingContacts = [];
          data.classifications.forEach(cls => {
            if (cls.contacts && cls.contacts.length > 0) {
              cls.contacts.forEach(c => {
                // Deduplicate by name
                if (c.name && !pendingContacts.find(pc => pc.name.toLowerCase() === c.name.toLowerCase())) {
                  pendingContacts.push(c);
                }
              });
            }
          });

          aiSuccess = true;
        }
      }
    } catch (e) {
      console.warn('AI classification failed, falling back to fuzzy match:', e);
    }

    // Fallback to fuzzy matching if AI failed
    if (!aiSuccess) {
      pendingBatch = files.map(f => ({
        file: f,
        match: matchFileToDoc(f.name),
        selected: true
      }));
      if (typeof showToast === 'function') showToast('AI classification unavailable, using filename matching', 'warning');
    }

    renderBatchPreview();
  }

  function renderBatchPreview() {
    const preview = document.getElementById('drBatchPreview');
    if (!preview || pendingBatch.length === 0) { if (preview) preview.innerHTML = ''; return; }

    let html = `
      <div class="mt-4">
        <div class="flex justify-between items-center mb-4">
          <div class="font-semibold">${pendingBatch.length} files matched</div>
          <div class="flex gap-3">
            <button class="btn btn-ghost btn-sm" onclick="HGCDataRoom.cancelBatch()">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="HGCDataRoom.confirmBatch()">Upload ${pendingBatch.filter(b=>b.selected).length} Files</button>
          </div>
        </div>
        <table class="data-table">
          <thead><tr>
            <th style="width:30px;"></th>
            <th>File</th>
            <th>AI Category</th>
            <th>Section</th>
            <th>Confidence</th>
            <th>Reasoning</th>
          </tr></thead>
          <tbody>`;

    pendingBatch.forEach((b, i) => {
      const m = b.match;
      html += `<tr>
        <td><input type="checkbox" ${b.selected ? 'checked' : ''} onchange="HGCDataRoom.toggleBatchItem(${i}, this.checked)"></td>
        <td class="text-sm">${esc(b.file.name)}</td>`;
      if (m) {
        const confColor = m.confidence >= 70 ? 'badge-success' : m.confidence >= 40 ? 'badge-warning' : 'badge-danger';
        html += `
          <td class="text-sm">${esc(m.docName)}</td>
          <td class="text-xs text-muted">${esc(m.secName)}</td>
          <td><span class="badge ${confColor}">${m.confidence}%</span></td>
          <td class="text-xs text-muted">${esc(m.reasoning || '')}</td>`;
      } else {
        html += `
          <td class="text-sm text-muted" colspan="2"><em>No match found \u2014 will skip</em></td>
          <td><span class="badge badge-neutral">\u2014</span></td>
          <td></td>`;
        b.selected = false;
      }
      html += `</tr>`;
    });

    html += `</tbody></table>`;

    // Contacts section
    if (pendingContacts.length > 0) {
      html += `
        <div class="mt-6 mb-2">
          <div class="flex items-center gap-3 mb-3">
            <div class="font-semibold">Contacts Found (${pendingContacts.length})</div>
          </div>
          <table class="data-table">
            <thead><tr>
              <th style="width:30px;"></th>
              <th>Name</th>
              <th>Role</th>
              <th>Company</th>
              <th>Email</th>
              <th>Phone</th>
            </tr></thead>
            <tbody>`;
      pendingContacts.forEach((c, ci) => {
        const checked = c._addToContacts !== false;
        html += `<tr>
          <td><input type="checkbox" ${checked ? 'checked' : ''} onchange="HGCDataRoom.toggleContactItem(${ci}, this.checked)" style="width:14px;height:14px;cursor:pointer;"></td>
          <td class="text-sm font-semibold">${esc(c.name || '')}</td>
          <td class="text-sm">${esc(c.role || '')}</td>
          <td class="text-sm">${esc(c.company || '')}</td>
          <td class="text-sm">${esc(c.email || '')}</td>
          <td class="text-sm">${esc(c.phone || '')}</td>
        </tr>`;
      });
      html += `</tbody></table>
        </div>`;
    }

    html += `</div>`;
    preview.innerHTML = html;
  }

  async function confirmBatch() {
    const deal = deals.find(d => d.id === currentDealId);
    if (!deal) return;
    if (!deal.dataRoom) deal.dataRoom = {};

    const toUpload = pendingBatch.filter(b => b.selected && b.match);
    const preview = document.getElementById('drBatchPreview');

    for (let i = 0; i < toUpload.length; i++) {
      const { file, match } = toUpload[i];
      if (preview) {
        const status = preview.querySelector('.font-semibold');
        if (status) status.textContent = `Uploading ${i + 1} of ${toUpload.length}...`;
      }

      try {
        const res = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId: deal.id, docId: match.docId, filename: file.name, contentType: file.type || 'application/octet-stream' })
        });
        if (!res.ok) throw new Error('Failed to get upload URL');
        const { url, path } = await res.json();

        await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });

        deal.dataRoom[match.docId] = {
          status: 'received',
          file: { path, filename: file.name, size: file.size, uploadedAt: new Date().toISOString() },
          updatedAt: new Date().toISOString()
        };
        // Auto-expand the section that received this file so it's visible immediately
        const secIdx = TEMPLATE ? TEMPLATE.sections.findIndex(s => s.id === match.secId) : -1;
        if (secIdx >= 0) expandedSections.add(secIdx);
      } catch (err) {
        console.error('Batch upload error for', file.name, err);
      }
    }

    // Add extracted contacts where individual checkbox is checked
    let contactsAdded = 0;
    if (pendingContacts.length > 0 && typeof contacts !== 'undefined' && typeof nextContactId !== 'undefined') {
      pendingContacts.forEach(c => {
        // Skip if this contact's checkbox was unchecked
        if (c._addToContacts === false) return;
        // Deduplicate by name — skip if a contact with the same name already exists
        if (contacts.find(existing => existing.name && existing.name.toLowerCase() === c.name.toLowerCase())) return;
        contacts.push({
          id: nextContactId++,
          name: c.name || '',
          company: c.company || '',
          role: c.role || '',
          email: c.email || '',
          phone: c.phone || ''
        });
        contactsAdded++;
      });
    }

    pendingBatch = [];
    pendingContacts = [];
    if (typeof saveData === 'function') saveData();
    const contactMsg = contactsAdded > 0 ? ` + ${contactsAdded} contacts added` : '';
    if (typeof showToast === 'function') showToast(`${toUpload.length} files uploaded and categorized${contactMsg}`, 'success');
    render();
  }

  function cancelBatch() {
    pendingBatch = [];
    const preview = document.getElementById('drBatchPreview');
    if (preview) preview.innerHTML = '';
  }

  function toggleBatchItem(idx, checked) {
    if (pendingBatch[idx]) {
      pendingBatch[idx].selected = checked;
      renderBatchPreview();
    }
  }

  function toggleAddContacts(checked) {
    addContactsChecked = checked;
  }

  function toggleContactItem(idx, checked) {
    if (pendingContacts[idx]) {
      pendingContacts[idx]._addToContacts = checked;
    }
  }

  // Render data room into an arbitrary container (for deal detail modal)
  function renderInline(dealId, container) {
    if (!TEMPLATE) { container.innerHTML = '<div class="text-sm text-muted">Loading template...</div>'; return; }
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;
    if (!deal.dataRoom) deal.dataRoom = {};
    currentDealId = dealId;
    inlineTarget = container;
    currentDealId = dealId;

    const c = completeness(deal);
    const b = band(deal.capital);
    const bandNote = b === 'zero'
      ? '<div class="text-danger font-semibold text-sm">Set deal capital to see required documents</div>'
      : `<div class="font-bold">${BAND_LABEL[b]}</div>`;

    let html = `<div id="drControls" class="card mb-4"><div class="card-body flex gap-5 items-center" style="flex-wrap:wrap;">
      <div>${bandNote}</div>
      <div class="flex-1"></div>
      <div class="text-sm text-muted">${c.reqDone} / ${c.req} required</div>
      <div class="progress" style="width:120px;"><div class="progress-fill ${c.pct>=100?'green':c.pct>=50?'amber':'red'}" style="width:${c.pct}%"></div></div>
      <div class="font-bold">${c.pct}%</div>
    </div></div>`;

    // Batch upload zone
    html += `<div class="card mb-4"><div class="card-header"><div class="card-header-title">Batch Upload</div></div>
      <div class="card-body">
        <div class="upload-zone" id="drBatchZone"><div class="upload-zone-text"><strong>Drop multiple files here</strong> or click to select<br><span class="text-xs text-muted">Files will be auto-matched to document categories</span></div></div>
        <input type="file" id="drBatchInput" multiple style="display:none">
        <div id="drBatchPreview"></div>
      </div></div>`;

    // Sections — render ALL sections (out-of-scope dimmed) so uploaded files
    // always have a visible, clickable surface regardless of deal size band.
    html += '<div id="drBody">';
    TEMPLATE.sections.forEach((sec, secIdx) => {
      const scoped = inScope(deal, sec.id);
      const isOpen = expandedSections.has(secIdx);
      let secFiles = 0;
      sec.subfolders.forEach((sf, si) => sf.documents.forEach((doc, di) => {
        if (docState(deal, docId(sec, si, di)).file) secFiles++;
      }));
      const fileBadge = secFiles > 0 ? `<span class="badge badge-info">${secFiles} file${secFiles > 1 ? 's' : ''}</span>` : '';
      html += `<div class="dr-section ${isOpen ? 'open' : ''}" data-sec="${secIdx}" style="${scoped ? '' : 'opacity:0.7;'}">
        <div class="dr-section-header" data-act="toggle-section" data-sec="${secIdx}">
          <div class="dr-section-title"><span class="dr-section-toggle">&#9656;</span> ${sec.id}. ${esc(sec.name)}
            ${scoped ? '' : '<span class="text-xs text-muted font-semibold">(optional at this deal size)</span>'}
          </div>
          ${fileBadge}
        </div><div class="dr-section-body">`;
      sec.subfolders.forEach((sf, si) => {
        html += `<div class="text-xs font-semibold" style="padding:var(--sp-2) var(--sp-4) var(--sp-1) var(--sp-6);color:var(--gray-500);">${esc(sf.name)}</div>`;
        sf.documents.forEach((doc, di) => {
          const id = docId(sec, si, di);
          const req = isRequired(deal, sec, doc);
          const st = docState(deal, id);
          html += docRow(deal, id, doc, req, st);
        });
      });
      html += '</div></div>';
    });
    html += '</div>';

    container.innerHTML = html;
    ensureDelegation();

    // Wire batch upload
    const batchZone = document.getElementById('drBatchZone');
    const batchInput = document.getElementById('drBatchInput');
    if (batchZone && batchInput) {
      batchZone.onclick = () => batchInput.click();
      batchZone.ondragover = (e) => { e.preventDefault(); batchZone.classList.add('dragover'); };
      batchZone.ondragleave = () => batchZone.classList.remove('dragover');
      batchZone.ondrop = (e) => { e.preventDefault(); batchZone.classList.remove('dragover'); handleBatchFiles(e.dataTransfer.files); };
      batchInput.onchange = () => { handleBatchFiles(batchInput.files); batchInput.value = ''; };
    }
  }

  window.HGCDataRoom = { open, close, setStatus, toggleIntl, upload, download, removeFile, cardSummary, completeness, portfolioReadiness, cancelBatch, confirmBatch, toggleBatchItem, toggleAddContacts, toggleContactItem, renderInline };
  loadTemplate();
})();
