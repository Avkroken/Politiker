// Small browser-level input, privacy and clipboard helpers. These do not fetch
// application data or replace whole application views.
(() => {
  function enhanceNumericInput(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== 'number') return;
    input.type = 'text';
    input.inputMode = 'numeric';
    input.pattern = '[0-9]*';
    input.autocomplete = 'off';
  }

  function enhanceExistingNumericInputs(root = document) {
    root.querySelectorAll('input[type="number"]').forEach(enhanceNumericInput);
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      const old = button.textContent;
      button.textContent = 'Kopierad';
      setTimeout(() => { button.textContent = old; }, 1400);
    } catch {
      const range = document.createRange();
      const code = button.parentElement?.querySelector('code');
      if (!code) return;
      range.selectNodeContents(code);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function attachApiCopy(result) {
    if (!result || result.querySelector('[data-api-copy]')) return false;
    const code = result.querySelector('code');
    if (!code || !code.textContent.trim()) return false;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.dataset.apiCopy = '1';
    button.textContent = 'Kopiera nyckel';
    button.addEventListener('click', () => copyText(code.textContent.trim(), button));
    result.append(button);
    return true;
  }

  function watchApiResultOnce() {
    const result = document.querySelector('#api-result');
    if (!result) return;
    if (attachApiCopy(result)) return;
    const observer = new MutationObserver(() => {
      if (attachApiCopy(result)) observer.disconnect();
    });
    observer.observe(result, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  function attachClearLetter() {
    const body = document.querySelector('#letter-body');
    if (!body || document.querySelector('[data-clear-letter]')) return;
    const field = body.closest('.field');
    if (!field) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost';
    button.dataset.clearLetter = '1';
    button.textContent = 'Rensa brev';
    button.setAttribute('aria-label', 'Rensa brevtext');
    button.addEventListener('click', () => {
      if (!body.value) return;
      body.value = '';
      sessionStorage.removeItem('draft:body');
      const preview = document.querySelector('#letter-html-preview');
      if (preview) { preview.innerHTML = ''; preview.hidden = true; }
      body.hidden = false;
      const previewButton = document.querySelector('#preview-html');
      if (previewButton) { previewButton.disabled = true; previewButton.textContent = 'Förhandsvisa brevet'; }
      const badge = document.querySelector('#format-badge');
      if (badge) badge.hidden = true;
      body.focus();
    });
    field.append(button);
  }

  function retentionCookieValue() {
    return document.cookie.match(/(?:^|;\s*)letter_retention_ms=([^;]+)/)?.[1] || '300000';
  }

  function attachRetentionChoice() {
    const credential = document.querySelector('#send-credential');
    if (!credential || document.querySelector('[data-letter-retention]')) return;
    const credentialField = credential.closest('.field');
    if (!credentialField?.parentElement) return;
    const field = document.createElement('label');
    field.className = 'field';
    field.dataset.letterRetention = '1';
    field.innerHTML = `<span>Hur länge ska brevtext och bilagor sparas efter slutfört utskick?</span>
      <select id="letter-retention">
        <option value="300000">Ta bort efter ca 5 minuter (standard)</option>
        <option value="86400000">Spara i 24 timmar</option>
        <option value="259200000">Spara i 3 dagar</option>
        <option value="604800000">Spara i 7 dagar</option>
      </select>
      <small class="hint">Själva utskicksstatistiken sparas separat. Privat brevtext och bilagor sparas aldrig längre än 7 dagar.</small>`;
    const select = field.querySelector('select');
    select.value = retentionCookieValue();
    select.addEventListener('change', () => {
      document.cookie = `letter_retention_ms=${select.value}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
    });
    credentialField.insertAdjacentElement('afterend', field);
  }

  function enhanceView() {
    enhanceExistingNumericInputs();
    attachClearLetter();
    attachRetentionChoice();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceView, { once: true });
  } else {
    enhanceView();
  }

  const root = document.querySelector('#root');
  if (root) {
    const observer = new MutationObserver(() => {
      attachClearLetter();
      attachRetentionChoice();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  document.addEventListener('focusin', (event) => enhanceNumericInput(event.target));
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#api-create')) watchApiResultOnce();
  });
})();
