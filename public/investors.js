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
  const STATUS_COLOR = { contacted: '#94a3b8', interested: '#0ea5e9', passed: '#ef4444', committed: '#10b981' };
  const STATUS_LABEL = { contacted: 'Contacted', interested: 'Interested', passed: 'Passed', committed: 'Committed' };

  const list = () => (typeof investors !== 'undefined' && Array.isArray(investors)) ? investors : [];
  const dealName = (id) => { const d = deals.find((x) => x.id === id); return d ? d.name : '(deleted deal)'; };

  // --- per-deal rollup (used on deal cards): committed $ + investor count ---
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
    return `<div class="deal-metrics" style="margin-top:0.75rem;">
      <div class="metric-row"><span class="metric-label">Capital committed:</span><span class="metric-value-small">${formatCurrency(committed)}${sought ? ' / ' + formatCurrency(sought) + ' (' + pct + '%)' : ''}</span></div>
      <div class="metric-row"><span class="metric-label">Investors engaged:</span><span class="metric-value-small">${count}${interested ? ' · ' + interested + ' interested' : ''}</span></div>
    </div>`;
  }

  function matchingDeals(inv) {
    const lo = parseCapital(inv.checkMin || '0');
    const hi = parseCapital(inv.checkMax || '0') || Infinity;
    return deals.filter((d) => (d.capital || 0) > 0 && (d.capital >= lo) && (d.capital <= hi))
      .filter((d) => !(inv.engagements || []).some((e) => e.dealId === d.id)); // not already engaged
  }

  function render() {
    const cont = $('investorsContainer');
    if (!cont) return;
    const q = ($('investorSearch')?.value || '').toLowerCase();
    const typeF = $('investorTypeFilter')?.value || 'all';
    const rows = list().filter((i) => (typeF === 'all' || i.type === typeF) &&
      (!q || (i.name || '').toLowerCase().includes(q) || (i.firm || '').toLowerCase().includes(q) || (i.sectors || []).join(' ').toLowerCase().includes(q)));

    // portfolio summary
    let totalCommitted = 0, totalEng = 0;
    list().forEach((i) => (i.engagements || []).forEach((e) => { totalEng++; if (e.status === 'committed') totalCommitted += parseCapital(e.amount || '0'); }));
    const sum = $('investorsSummary');
    if (sum) sum.innerHTML = list().length ? `<div style="display:flex;gap:2rem;flex-wrap:wrap;font-size:13px;color:var(--secondary);">
      <div><strong style="color:var(--primary);font-size:18px;">${list().length}</strong> investors</div>
      <div><strong style="color:var(--primary);font-size:18px;">${formatCurrency(totalCommitted)}</strong> total committed</div>
      <div><strong style="color:var(--primary);font-size:18px;">${totalEng}</strong> deal engagements</div></div>` : '';

    if (!rows.length) { cont.innerHTML = '<div class="empty-state"><div class="empty-icon">🏦</div><div>No investors yet. Add your first investor or lender.</div></div>'; return; }

    cont.innerHTML = rows.map((inv) => {
      const engs = (inv.engagements || []);
      const engHtml = engs.length ? engs.map((e, idx) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--lighter);border-radius:6px;margin-bottom:4px;font-size:12px;cursor:pointer;" onclick="HGCInvestors.openEngagement(${inv.id}, ${idx})">
          <span>${esc(dealName(e.dealId))}</span>
          <span><span style="color:${STATUS_COLOR[e.status] || '#94a3b8'};font-weight:700;">${STATUS_LABEL[e.status] || e.status}</span>${e.amount ? ' · ' + esc(e.amount) : ''}</span>
        </div>`).join('') : '<div style="font-size:12px;color:var(--secondary);">No deal engagements yet.</div>';
      const matches = matchingDeals(inv);
      const matchId = 'match-' + inv.id;
      let matchHtml = '';
      if (matches.length) {
        const visible = matches.slice(0, 5).map((d) => esc(d.name)).join(', ');
        if (matches.length <= 5) {
          matchHtml = `<div style="margin-top:8px;font-size:11px;color:var(--secondary);">💡 Fits check size: ${visible}</div>`;
        } else {
          const rest = matches.slice(5).map((d) => esc(d.name)).join(', ');
          matchHtml = `<div style="margin-top:8px;font-size:11px;color:var(--secondary);">💡 Fits check size: ${visible}<span id="${matchId}" style="display:none;">, ${rest}</span> <a href="#" onclick="event.preventDefault();var s=document.getElementById('${matchId}');var a=this;if(s.style.display==='none'){s.style.display='inline';a.textContent='Show less';}else{s.style.display='none';a.textContent='Show ${matches.length - 5} more';}" style="font-weight:600;">Show ${matches.length - 5} more</a></div>`;
        }
      }
      const checkSize = inv.checkMin && inv.checkMax ? `${esc(inv.checkMin)}–${esc(inv.checkMax)}` : inv.checkMin ? `From ${esc(inv.checkMin)}` : inv.checkMax ? `Up to ${esc(inv.checkMax)}` : '';
      const meta = [TYPE_LABEL[inv.type] || inv.type, inv.instrument && inv.instrument !== 'both' ? inv.instrument : '', checkSize].filter(Boolean).join(' · ');
      return `<div style="background:#fff;border-radius:12px;padding:1.25rem;box-shadow:var(--shadow-sm);border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div><div style="font-weight:700;font-size:15px;">${esc(inv.name)}</div>
            <div style="font-size:12px;color:var(--secondary);">${esc(inv.firm || '')}</div></div>
          <button class="doc-btn" onclick="HGCInvestors.openEdit(${inv.id})">Edit</button>
        </div>
        <div style="font-size:12px;color:var(--secondary);margin:6px 0;">${esc(meta)}</div>
        ${(inv.sectors || []).length ? `<div style="font-size:11px;color:var(--secondary);margin-bottom:8px;">${(inv.sectors || []).map((s) => `<span style="background:var(--lighter);padding:2px 8px;border-radius:10px;margin-right:4px;">${esc(s)}</span>`).join('')}</div>` : ''}
        <div style="font-size:11px;font-weight:700;color:var(--secondary);text-transform:uppercase;letter-spacing:.5px;margin:8px 0 6px;">Deal engagements</div>
        ${engHtml}
        <button class="add-doc-btn" style="margin-top:6px;" onclick="HGCInvestors.openEngagement(${inv.id})">+ Link to a deal</button>
        ${matchHtml}
      </div>`;
    }).join('');
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
    if (!name) { alert('⚠️ Enter a name'); return; }
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
      if (!parsed || parsed <= 0) { alert('Engagement amount must be a positive number.'); return; }
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
