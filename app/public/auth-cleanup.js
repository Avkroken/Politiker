(() => {
  function removeObsoleteAuthUi() {
    document.querySelectorAll('a[href^="/api/oauth/github/"]').forEach(el => el.remove());
    document.querySelectorAll('a[href^="/api/oauth-link/"]').forEach(el => el.remove());

    document.querySelectorAll('.oauth-grid').forEach(grid => {
      if (!grid.querySelector('a')) grid.remove();
    });
  }

  const start = () => {
    removeObsoleteAuthUi();
    const observer = new MutationObserver(removeObsoleteAuthUi);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
