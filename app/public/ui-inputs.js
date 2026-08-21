// Small browser-specific UX enhancements that belong at the shell level rather
// than in each individual dynamically-rendered form.
(() => {
  const providerLabels = {
    google: 'Google',
    github: 'GitHub',
    microsoft: 'Microsoft',
  };

  function enhanceNumericInputs(root = document) {
    root.querySelectorAll('input[type="number"]').forEach((input) => {
      // All current number fields in Politikerkontakt are whole numbers
      // (ports, day counts and send limits). iOS gives type=number a keyboard
      // with punctuation and currency keys, so use a digit-only text input.
      input.type = 'text';
      input.inputMode = 'numeric';
      input.pattern = '[0-9]*';
      input.autocomplete = 'off';
    });
  }

  function enhanceOAuthLabels(root = document) {
    const list = root.querySelector('#oauth-list');
    if (!list) return;
    list.querySelectorAll('.credential-card strong').forEach((el) => {
      const key = el.textContent.trim().toLowerCase();
      if (providerLabels[key]) el.textContent = providerLabels[key];
    });
  }

  function enhance(root = document) {
    enhanceNumericInputs(root);
    enhanceOAuthLabels(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhance());
  } else {
    enhance();
  }

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) enhance(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
