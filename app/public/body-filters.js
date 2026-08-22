(() => {
  const EXCLUDE_PREFIX = 'exclude-body:';
  const excludedBodies = new Set();
  let bodyRows = [];
  let lastFilterPayload = null;
  let loading = null;
  const originalFetch = window.fetch.bind(window);

  const pathOf = input => {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      return new URL(raw, location.href).pathname;
    } catch { return ''; }
  };

  async function loadBodies() {
    if (bodyRows.length) return bodyRows;
    if (loading) return loading;
    loading = originalFetch('/api/roles', { headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        bodyRows = (Array.isArray(rows) ? rows : []).filter(x => x && x.kind === 'body' && x.body && x.area_name);
        return bodyRows;
      })
      .catch(() => []);
    return loading;
  }

  window.fetch = async (input, init = {}) => {
    const path = pathOf(input);
    const isFilterRequest = (path === '/api/recipients/count' || path === '/api/send') && String(init.method || 'GET').toUpperCase() === 'POST';
    if (!isFilterRequest || typeof init.body !== 'string') return originalFetch(input, init);

    try {
      const payload = JSON.parse(init.body);
      if (Array.isArray(payload.areaNames)) lastFilterPayload = structuredClone(payload);
      const normalRoles = Array.isArray(payload.includeRoles)
        ? payload.includeRoles.filter(x => typeof x === 'string' && !x.startsWith(EXCLUDE_PREFIX))
        : [];
      payload.includeRoles = [...normalRoles, ...[...excludedBodies].map(x => EXCLUDE_PREFIX + x)];
      return originalFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch {
      return originalFetch(input, init);
    }
  };

  function selectedAreaNames() {
    return new Set(Array.isArray(lastFilterPayload?.areaNames) ? lastFilterPayload.areaNames : []);
  }

  function relevantBodies() {
    const areas = selectedAreaNames();
    if (!areas.size) return [];
    const merged = new Map();
    for (const row of bodyRows) {
      if (!areas.has(row.area_name)) continue;
      const key = String(row.body).trim();
      if (!key) continue;
      const existing = merged.get(key) || { body: key, count: 0, areas: new Set() };
      existing.count += Number(row.count || 0);
      existing.areas.add(row.area_name);
      merged.set(key, existing);
    }
    return [...merged.values()].sort((a, b) => a.body.localeCompare(b.body, 'sv-SE'));
  }

  async function refreshCount() {
    if (!lastFilterPayload) return;
    try {
      const r = await window.fetch('/api/recipients/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lastFilterPayload),
      });
      const d = await r.json();
      const el = document.querySelector('#recipient-count');
      if (el && d && d.count != null) el.textContent = `${d.count} mottagare valda`;
    } catch {}
  }

  function drawBodyFilter() {
    const advanced = document.querySelector('#send-step details.disclosure > .stack');
    if (!advanced || document.querySelector('#body-filter-disclosure')) return;

    const rows = relevantBodies();
    if (!rows.length) return;

    const details = document.createElement('details');
    details.id = 'body-filter-disclosure';
    details.className = 'disclosure';
    details.innerHTML = '<summary>Uteslut nämnd/organ</summary><div class="filter-options" id="body-filter-list"></div><p class="hint">Alla politiker är med som standard. Markera bara sådant du vill utesluta.</p>';

    const partyDetails = [...advanced.querySelectorAll(':scope > details.disclosure')].find(x => x.textContent.includes('Uteslut parti') || x.textContent.includes('Befattning'));
    if (partyDetails) advanced.insertBefore(details, partyDetails);
    else advanced.append(details);

    const list = details.querySelector('#body-filter-list');
    for (const row of rows) {
      const label = document.createElement('label');
      label.className = 'filter-option';
      const checked = excludedBodies.has(row.body) ? ' checked' : '';
      const areaHint = row.areas.size > 1 ? ` · ${row.areas.size} kommuner/regioner` : '';
      label.innerHTML = `<input type="checkbox"${checked}><span>${escapeHtml(row.body)} <span class="hint">(${row.count}${areaHint})</span></span>`;
      label.querySelector('input').addEventListener('change', async e => {
        if (e.target.checked) excludedBodies.add(row.body); else excludedBodies.delete(row.body);
        await refreshCount();
      });
      list.append(label);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  let timer;
  function scheduleDraw() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await loadBodies();
      const existing = document.querySelector('#body-filter-disclosure');
      if (existing) existing.remove();
      drawBodyFilter();
    }, 60);
  }

  const observer = new MutationObserver(scheduleDraw);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  loadBodies().then(scheduleDraw);
})();
