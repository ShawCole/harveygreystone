/* HGC & ARK — Investor / Lender CRM.
   Investor profiles + per-deal engagements (contacted→interested→passed→committed)
   + commitment tracking + simple deal↔investor matching by check size.
   Shares globals: investors, deals, nextInvestorId, saveData, parseCapital,
   formatCurrency, renderDeals. */
(function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const $ = (id) => document.getElementById(id);
  const TYPE_LABEL = { investor: 'Investor', lender: 'Lender', 'family-office': 'Family Office' };
  const TYPE_BADGE = { investor: 'badge-investor', lender: 'badge-lender', 'family-office': 'badge-family-office' };
  const STATUS_BADGE = { contacted: 'badge-neutral', interested: 'badge-info', passed: 'badge-danger', committed: 'badge-success' };
  const STATUS_LABEL = { contacted: 'Contacted', interested: 'Interested', passed: 'Passed', committed: 'Committed' };

  const list = () => (typeof investors !== 'undefined' && Array.isArray(investors)) ? investors : [];
  const dealName = (id) => { const d = deals.find((x) => x.id === id); return d ? d.name : '(deleted deal)'; };

  function dealSummary(deal) {
    let committed = 0, count = 0, interested = 0;
    list().forEach((inv) => (inv.engagements || []).forEach((e) => {
      if (e.dealId !== deal.id) return;
      count++;
      if (e.status === 'committed') committed += parseCapital(e.amount || '0');
      if (e.status === 'interested') interested++;
    }));
    if (count === 0) return '';
    const sought = deal.capital || 0;
    const pct = sought ? Math.min(100, Math.round((committed / sought) * 100)) : 0;
    return `<div class="card mt-4">
      <div class="card-body">
        <div class="flex justify-between text-sm mb-2"><span class="text-muted">Capital committed</span><span class="font-semibold">${formatCurrency(committed)}${sought ? ' / ' + formatCurrency(sought) + ' (' + pct + '%)' : ''}</span></div>
        <div class="flex justify-between text-sm"><span class="text-muted">Investors engaged</span><span class="font-semibold">${count}${interested ? ' \u00b7 ' + interested + ' interested' : ''}</span></div>
      </div>
    </div>`;
  }

  function matchingDeals(inv) {
    const lo = parseCapital(inv.checkMin || '0');
    const hi = parseCapital(inv.checkMax || '0') || Infinity;
    return deals.filter((d) => (d.capital || 0) > 0 && (d.capital >= lo) && (d.capital <= hi))
      .filter((d) => !(inv.engagements || []).some((e) => e.dealId === d.id));
  }

  function render() {
    const cont = $('view-investors');
    if (!cont) return;
    const existingSearch = cont.querySelector('#investorSearch');
    const q = (existingSearch?.value || '').toLowerCase();
    const existingFilter = cont.querySelector('#investorTypeFilter');
    const typeF = existingFilter?.value || 'all';
    const rows = list().filter((i) => (typeF === 'all' || i.type === typeF) &&
      (!q || (i.name || '').toLowerCase().includes(q) || (i.firm || '').toLowerCase().includes(q) || (i.sectors || []).join(' ').toLowerCase().includes(q)));

    // Portfolio summary
    let totalCommitted = 0, totalEng = 0;
    list().forEach((i) => (i.engagements || []).forEach((e) => { totalEng++; if (e.status === 'committed') totalCommitted += parseCapital(e.amount || '0'); }));

    let summaryHtml = '';
    if (list().length) {
      summaryHtml = `<div class="metrics-grid mb-6">
        <div class="metric-card"><div class="metric-label">Investors</div><div class="metric-value">${list().length}</div></div>
        <div class="metric-card"><div class="metric-label">Total Committed</div><div class="metric-value">${formatCurrency(totalCommitted)}</div></div>
        <div class="metric-card"><div class="metric-label">Deal Engagements</div><div class="metric-value">${totalEng}</div></div>
      </div>`;
    }

    let html = `
      <div class="toolbar">
        <div class="toolbar-left">
          <input type="text" class="search-input" id="investorSearch" placeholder="Search investors..." value="${esc(q)}" onkeyup="HGCInvestors.render()">
          <select id="investorTypeFilter" class="form-input btn-sm" style="width:auto;" onchange="HGCInvestors.render()">
            <option value="all" ${typeF==='all'?'selected':''}>All types</option>
            <option value="investor" ${typeF==='investor'?'selected':''}>Investors</option>
            <option value="lender" ${typeF==='lender'?'selected':''}>Lenders</option>
            <option value="family-office" ${typeF==='family-office'?'selected':''}>Family offices</option>
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="HGCInvestors.openEdit()">+ New Investor</button>
        </div>
      </div>
      ${summaryHtml}
    `;

    if (!rows.length) {
      html += '<div class="empty-state"><div class="empty-state-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div class="empty-state-title">No investors yet</div><div class="empty-state-text">Add your first investor or lender.</div></div>';
      cont.innerHTML = html;
      return;
    }

    html += '<div class="card"><table class="data-table"><thead><tr><th>Name</th><th>Firm</th><th>Type</th><th>Check Size</th><th>Engagements</th><th></th></tr></thead><tbody>';
    rows.forEach((inv) => {
      const checkSize = inv.checkMin && inv.checkMax ? `${esc(inv.checkMin)}\u2013${esc(inv.checkMax)}` : inv.checkMin ? `From ${esc(inv.checkMin)}` : inv.checkMax ? `Up to ${esc(inv.checkMax)}` : '\u2014';
      const engCount = (inv.engagements || []).length;
      const committedCount = (inv.engagements || []).filter(e => e.status === 'committed').length;
      html += `<tr style="cursor:pointer;" onclick="HGCInvestors.openEdit(${inv.id})">
        <td>
          <div class="font-semibold">${esc(inv.name)}</div>
          ${(inv.sectors || []).length ? `<div class="text-xs text-muted mt-2">${(inv.sectors || []).map(s => `<span class="badge badge-neutral" style="margin-right:4px;">${esc(s)}</span>`).join('')}</div>` : ''}
        </td>
        <td>${esc(inv.firm || '\u2014')}</td>
        <td><span class="badge ${TYPE_BADGE[inv.type] || 'badge-neutral'}">${TYPE_LABEL[inv.type] || inv.type}</span></td>
        <td>${checkSize}</td>
        <td>
          ${engCount > 0 ? `<span class="text-sm">${engCount} deal${engCount > 1 ? 's' : ''}</span>` : '<span class="text-xs text-muted">None</span>'}
          ${committedCount > 0 ? ` <span class="badge badge-success">${committedCount} committed</span>` : ''}
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();HGCInvestors.openEngagement(${inv.id})">+ Link Deal</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    cont.innerHTML = html;
  }

  // --- investor edit ---
  function openEdit(id) {
    const inv = id != null ? list().find((i) => i.id === id) : null;
    $('invModalTitle').textContent = inv ? 'Edit Investor' : 'New Investor';
    $('invId').value = inv ? inv.id : '';
    $('invName').value = inv ? inv.name || '' : '';
    $('invFirm').value = inv ? inv.firm || '' : '';
    $('invType').value = inv ? inv.type || 'investor' : 'investor';
    $('invEmail').value = inv ? inv.email || '' : '';
    $('invPhone').value = inv ? inv.phone || '' : '';
    $('invInstrument').value = inv ? inv.instrument || 'both' : 'both';
    $('invCheckMin').value = inv ? inv.checkMin || '' : '';
    $('invCheckMax').value = inv ? inv.checkMax || '' : '';
    $('invSectors').value = inv ? (inv.sectors || []).join(', ') : '';
    $('invGeos').value = inv ? (inv.geos || []).join(', ') : '';
    $('invNotes').value = inv ? inv.notes || '' : '';
    $('invDeleteBtn').style.display = inv ? 'inline-flex' : 'none';
    $('investorModal').classList.add('show');
  }
  function closeEdit() { $('investorModal').classList.remove('show'); }

  function save() {
    const name = $('invName').value.trim();
    if (!name) { if (typeof showToast === 'function') showToast('Enter a name', 'warning'); else alert('Enter a name'); return; }
    const idVal = $('invId').value;
    const splitList = (v) => {
      const items = v.split(',').map((s) => s.trim()).filter(Boolean);
      const seen = new Set();
      return items.filter((s) => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    };
    const data = {
      name, firm: $('invFirm').value.trim(), type: $('invType').value,
      email: $('invEmail').value.trim(), phone: $('invPhone').value.trim(),
      instrument: $('invInstrument').value, checkMin: $('invCheckMin').value.trim(), checkMax: $('invCheckMax').value.trim(),
      sectors: splitList($('invSectors').value), geos: splitList($('invGeos').value),
      notes: $('invNotes').value.trim(),
    };
    if (idVal) {
      const inv = list().find((i) => i.id === Number(idVal));
      Object.assign(inv, data);
    } else {
      investors.push({ id: nextInvestorId++, ...data, engagements: [], createdDate: new Date().toISOString() });
    }
    saveData(); closeEdit(); render();
    if (typeof showToast === 'function') showToast('Investor saved');
  }
  function remove() {
    const id = Number($('invId').value);
    if (!id || !confirm('Delete this investor?')) return;
    const i = investors.findIndex((x) => x.id === id);
    if (i >= 0) investors.splice(i, 1);
    saveData(); closeEdit(); render();
  }

  // --- engagement (investor <-> deal) ---
  function openEngagement(invId, idx) {
    const inv = list().find((i) => i.id === invId); if (!inv) return;
    $('engInvId').value = invId; $('engIdx').value = (idx != null ? idx : '');
    $('engInvName').textContent = inv.name;
    $('engDeal').innerHTML = deals.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
    const e = (idx != null) ? (inv.engagements || [])[idx] : null;
    $('engDeal').value = e ? e.dealId : (deals[0] ? deals[0].id : '');
    $('engStatus').value = e ? e.status : 'contacted';
    $('engAmount').value = e ? e.amount || '' : '';
    $('engNotes').value = e ? e.notes || '' : '';
    $('engagementModal').classList.add('show');
  }
  function closeEngagement() { $('engagementModal').classList.remove('show'); }
  function saveEngagement() {
    const inv = list().find((i) => i.id === Number($('engInvId').value)); if (!inv) return;
    if (!inv.engagements) inv.engagements = [];
    const amountRaw = $('engAmount').value.trim();
    if (amountRaw) {
      const parsed = parseCapital(amountRaw);
      if (!parsed || parsed <= 0) { if (typeof showToast === 'function') showToast('Engagement amount must be a positive number.', 'warning'); else alert('Engagement amount must be a positive number.'); return; }
    }
    const rec = { dealId: Number($('engDeal').value), status: $('engStatus').value, amount: amountRaw, notes: $('engNotes').value.trim(), updatedAt: new Date().toISOString() };
    const idx = $('engIdx').value;
    if (idx !== '') inv.engagements[Number(idx)] = rec; else inv.engagements.push(rec);
    saveData(); closeEngagement(); render();
    if (typeof renderDeals === 'function') renderDeals();
  }
  function removeEngagement() {
    const inv = list().find((i) => i.id === Number($('engInvId').value)); if (!inv) return;
    const idx = $('engIdx').value;
    if (idx !== '') { inv.engagements.splice(Number(idx), 1); saveData(); closeEngagement(); render(); if (typeof renderDeals === 'function') renderDeals(); }
    else closeEngagement();
  }

  window.HGCInvestors = { render, openEdit, closeEdit, save, remove, openEngagement, closeEngagement, saveEngagement, removeEngagement, dealSummary };
})();
