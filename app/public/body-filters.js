(() => {
  const POLICY_PREFIX = 'policy-area:';
  const MEDIA_PREFIX = 'media-category:';
  const selectedPolicyAreas = new Set();
  const selectedMediaCategories = new Set();
  const mediaAreaNames = new Set();
  let lastFilterPayload = null;
  const originalFetch = window.fetch.bind(window);

  const POLICY_AREAS = [
    ['ledning', 'Kommun-/regionstyrelse'],
    ['social-omsorg', 'Social & omsorg'],
    ['utbildning', 'Skola & utbildning'],
    ['halso-sjukvard', 'Hälso- & sjukvård'],
    ['samhallsbyggnad', 'Samhällsbyggnad'],
    ['miljo', 'Miljö'],
    ['teknik-infrastruktur', 'Teknik & infrastruktur'],
    ['kultur-fritid', 'Kultur & fritid'],
    ['arbetsmarknad-naringsliv', 'Arbetsmarknad & näringsliv'],
    ['regional-utveckling', 'Regional utveckling'],
    ['raddning-samhallsskydd', 'Räddning & samhällsskydd'],
  ];

  const MEDIA_CATEGORIES = [
    ['politik', 'Politik'],
    ['opinion-debatt', 'Opinion & debatt'],
    ['nyhetsredaktion', 'Nyhetsredaktion'],
  ];

  const pathOf = input => {
    try { return new URL(typeof input === 'string' ? input : input?.url, location.href).pathname; }
    catch { return ''; }
  };

  window.fetch = async (input, init = {}) => {
    const path = pathOf(input);
    if (path === '/api/areas' && String(init.method || 'GET').toUpperCase() === 'GET') {
      const response = await originalFetch(input, init);
      try {
        const payload = await response.clone().json();
        const rows = Array.isArray(payload) ? payload : payload?.areas;
        if (Array.isArray(rows)) {
          mediaAreaNames.clear();
          for (const row of rows) if (row?.area_type === 'media' && row?.area_name) mediaAreaNames.add(row.area_name);
        }
      } catch {}
      return response;
    }

    const isFilterRequest = (path === '/api/recipients/count' || path === '/api/send') && String(init.method || 'GET').toUpperCase() === 'POST';
    if (!isFilterRequest || typeof init.body !== 'string') return originalFetch(input, init);
    try {
      const payload = JSON.parse(init.body);
      if (Array.isArray(payload.areaNames)) {
        lastFilterPayload = structuredClone(payload);
        scheduleDraw();
      }
      const normalRoles = Array.isArray(payload.includeRoles)
        ? payload.includeRoles.filter(x => typeof x === 'string' && !x.startsWith(POLICY_PREFIX) && !x.startsWith(MEDIA_PREFIX) && !x.startsWith('exclude-body:'))
        : [];
      payload.includeRoles = [
        ...normalRoles,
        ...[...selectedPolicyAreas].map(x => POLICY_PREFIX + x),
        ...[...selectedMediaCategories].map(x => MEDIA_PREFIX + x),
      ];
      return originalFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch { return originalFetch(input, init); }
  };

  async function refreshCount() {
    if (!lastFilterPayload) return;
    try {
      const r = await window.fetch('/api/recipients/count', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lastFilterPayload),
      });
      const d = await r.json();
      const el = document.querySelector('#recipient-count');
      if (el && d?.count != null) el.textContent = `${d.count} mottagare valda`;
    } catch {}
  }

  function makeFilter(id, summary, hint, rows, selected) {
    const details = document.createElement('details');
    details.id = id;
    details.className = 'disclosure';
    details.innerHTML = `<summary>${summary}</summary><div class="filter-options"></div><p class="hint">${hint}</p>`;
    const list = details.querySelector('.filter-options');
    for (const [key, labelText] of rows) {
      const label = document.createElement('label');
      label.className = 'filter-option';
      label.innerHTML = `<input type="checkbox"${selected.has(key) ? ' checked' : ''}><span>${labelText}</span>`;
      label.querySelector('input').addEventListener('change', async e => {
        if (e.target.checked) selected.add(key); else selected.delete(key);
        await refreshCount();
      });
      list.append(label);
    }
    return details;
  }

  function drawFilters() {
    const advanced = document.querySelector('#send-step details.disclosure > .stack');
    if (!advanced) return;
    document.querySelector('#body-filter-disclosure')?.remove();
    document.querySelector('#policy-area-filter-disclosure')?.remove();
    document.querySelector('#media-category-filter-disclosure')?.remove();
    if (!lastFilterPayload?.areaNames?.length) return;

    const selectedNames = new Set(lastFilterPayload.areaNames);
    const hasMedia = [...mediaAreaNames].some(name => selectedNames.has(name));

    if (hasMedia) {
      advanced.prepend(makeFilter(
        'media-category-filter-disclosure',
        'Begränsa media efter redaktionell inriktning',
        'Valfritt. Utan val följer alla valda mediekontakter med. Med ett val begränsas bara Media-grenen till den inriktningen. Generella tips- och redaktionsadresser ingår bara när Media väljs utan underkategori.',
        MEDIA_CATEGORIES,
        selectedMediaCategories,
      ));
    } else {
      selectedMediaCategories.clear();
    }

    advanced.prepend(makeFilter(
      'policy-area-filter-disclosure',
      'Begränsa kommuner/regioner efter ansvarsområde',
      'Valfritt. Utan val ingår alla politiker i valda kommuner och regioner. Riksdag, regering, EU, media och andra valda mottagargrupper påverkas inte.',
      POLICY_AREAS,
      selectedPolicyAreas,
    ));
  }

  let timer;
  function scheduleDraw() {
    clearTimeout(timer);
    timer = setTimeout(drawFilters, 60);
  }
  new MutationObserver(() => {
    if (!document.querySelector('#policy-area-filter-disclosure')) scheduleDraw();
  }).observe(document.documentElement, { childList: true, subtree: true });
  scheduleDraw();
})();
