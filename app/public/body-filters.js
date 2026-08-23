(() => {
  const POLICY_PREFIX = 'policy-area:';
  const selectedPolicyAreas = new Set();
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

  const pathOf = input => {
    try { return new URL(typeof input === 'string' ? input : input?.url, location.href).pathname; }
    catch { return ''; }
  };

  window.fetch = async (input, init = {}) => {
    const path = pathOf(input);
    const isFilterRequest = (path === '/api/recipients/count' || path === '/api/send') && String(init.method || 'GET').toUpperCase() === 'POST';
    if (!isFilterRequest || typeof init.body !== 'string') return originalFetch(input, init);
    try {
      const payload = JSON.parse(init.body);
      if (Array.isArray(payload.areaNames)) {
        lastFilterPayload = structuredClone(payload);
        scheduleDraw();
      }
      const normalRoles = Array.isArray(payload.includeRoles)
        ? payload.includeRoles.filter(x => typeof x === 'string' && !x.startsWith(POLICY_PREFIX) && !x.startsWith('exclude-body:'))
        : [];
      payload.includeRoles = [...normalRoles, ...[...selectedPolicyAreas].map(x => POLICY_PREFIX + x)];
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

  function drawPolicyFilter() {
    const advanced = document.querySelector('#send-step details.disclosure > .stack');
    if (!advanced) return;
    document.querySelector('#body-filter-disclosure')?.remove();
    document.querySelector('#policy-area-filter-disclosure')?.remove();
    if (!lastFilterPayload?.areaNames?.length) return;

    const details = document.createElement('details');
    details.id = 'policy-area-filter-disclosure';
    details.className = 'disclosure';
    details.innerHTML = '<summary>Begränsa kommuner/regioner efter ansvarsområde</summary><div class="filter-options" id="policy-area-filter-list"></div><p class="hint">Valfritt. Utan val ingår alla politiker i valda kommuner och regioner. Riksdag, regering, EU och andra valda mottagargrupper påverkas inte.</p>';
    advanced.prepend(details);
    const list = details.querySelector('#policy-area-filter-list');
    for (const [key, labelText] of POLICY_AREAS) {
      const label = document.createElement('label');
      label.className = 'filter-option';
      label.innerHTML = `<input type="checkbox"${selectedPolicyAreas.has(key) ? ' checked' : ''}><span>${labelText}</span>`;
      label.querySelector('input').addEventListener('change', async e => {
        if (e.target.checked) selectedPolicyAreas.add(key); else selectedPolicyAreas.delete(key);
        await refreshCount();
      });
      list.append(label);
    }
  }

  let timer;
  function scheduleDraw() {
    clearTimeout(timer);
    timer = setTimeout(drawPolicyFilter, 60);
  }
  new MutationObserver(() => {
    if (!document.querySelector('#policy-area-filter-disclosure')) scheduleDraw();
  }).observe(document.documentElement, { childList: true, subtree: true });
  scheduleDraw();
})();
