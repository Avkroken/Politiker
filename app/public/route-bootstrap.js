// Keep the SPA on one canonical document path. Older admin navigation used
// /admin as a document path; v2.js then treated that pathname as authoritative
// on boot, which could override the hash route after a refresh.
(() => {
  if (location.pathname !== '/admin') return;

  const hash = location.hash || '#admin/accounts';
  history.replaceState(null, '', `/${location.search}${hash}`);
})();
