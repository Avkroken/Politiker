(() => {
  function prepareTotpInput() {
    const row = document.getElementById('totp-row');
    if (!row || row.hidden) return;
    const input = row.querySelector('input[name="totpCode"]');
    if (!input || input.dataset.iosTotpReady === '1') return;

    input.dataset.iosTotpReady = '1';
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'one-time-code';
    input.pattern = '[0-9]*';
    input.maxLength = 6;
    input.setAttribute('enterkeyhint', 'go');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');

    // Safari/iOS behöver ibland att det dynamiskt visade one-time-code-fältet
    // får fokus först efter att layouten har hunnit uppdateras. Ett omedelbart
    // focus() i samma tick kan ge tangentbord men ingen kodrekommendation.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!row.hidden && document.activeElement !== input) input.focus({ preventScroll: true });
      });
    });

    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 6);
    });
  }

  const observer = new MutationObserver(prepareTotpInput);
  const start = () => {
    prepareTotpInput();
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
