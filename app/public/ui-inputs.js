// Small browser-level input and clipboard helpers. These do not fetch data or
// re-render application views.
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhanceExistingNumericInputs(), { once: true });
  } else {
    enhanceExistingNumericInputs();
  }

  document.addEventListener('focusin', (event) => enhanceNumericInput(event.target));
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#api-create')) watchApiResultOnce();
  });
})();
