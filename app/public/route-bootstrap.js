// Normalize the historical /admin document path and protect admin deep routes
// during the first SPA boot.
(() => {
  if (location.pathname === '/admin') {
    const hash = location.hash || '#admin/accounts';
    history.replaceState(null, '', `/${location.search}${hash}`);
  }

  // The former public Letters section is retired. Old bookmarks return home.
  if (/^#letters(?:\/|$)/.test(location.hash)) {
    history.replaceState(null, '', `${location.pathname}${location.search}#home`);
    return;
  }

  const deepHash = location.hash;
  const isDeepRoute = /^#admin\/(?:accounts|sends)\/[^/]+$/.test(deepHash);
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
  setTimeout(() => {
    if (history.replaceState !== nativeReplaceState) history.replaceState = nativeReplaceState;
  }, 5000);
})();
