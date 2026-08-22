// Normalize the historical /admin document path and protect deep hash routes
// during the first SPA boot. v2.js normalizes its base route with replaceState;
// without this guard a refresh on e.g. #letters/<id> loses the selected item.
(() => {
  if (location.pathname === '/admin') {
    const hash = location.hash || '#admin/accounts';
    history.replaceState(null, '', `/${location.search}${hash}`);
  }

  const deepHash = location.hash;
  const isDeepRoute = /^#(?:letters\/[^/]+|admin\/(?:accounts|sends)\/[^/]+)$/.test(deepHash);
  if (!isDeepRoute) return;

  const nativeReplaceState = history.replaceState.bind(history);
  let protectNextNormalization = true;

  history.replaceState = function (state, title, url) {
    if (protectNextNormalization && typeof url === 'string') {
      const target = new URL(url, location.href);
      const baseHash = target.hash;
      if (baseHash && deepHash.startsWith(`${baseHash}/`)) {
        protectNextNormalization = false;
        history.replaceState = nativeReplaceState;
        return nativeReplaceState(state, title, `${target.pathname}${target.search}${deepHash}`);
      }
    }
    return nativeReplaceState(state, title, url);
  };

  // Do not leave History patched if boot never performs the normalization.
  setTimeout(() => {
    if (history.replaceState !== nativeReplaceState) history.replaceState = nativeReplaceState;
  }, 5000);
})();
