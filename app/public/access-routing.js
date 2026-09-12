(() => {
  const adminHash = /^#admin(?:\/|$)/;
  const isAdminPath = () => location.pathname === "/admin" || location.pathname.startsWith("/admin/");

  function normalizeLocation() {
    if (adminHash.test(location.hash) && !isAdminPath()) {
      location.replace(`/admin${location.search}${location.hash}`);
      return true;
    }

    if (isAdminPath() && (!location.hash || location.hash === "#")) {
      history.replaceState(null, "", `/admin${location.search}#admin/accounts`);
      return false;
    }

    if (isAdminPath() && location.hash && !adminHash.test(location.hash)) {
      location.replace(`/${location.search}${location.hash}`);
      return true;
    }

    return false;
  }

  if (normalizeLocation()) return;
  addEventListener("hashchange", normalizeLocation);

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    let url;
    try {
      url = new URL(input instanceof Request ? input.url : String(input), location.href);
    } catch {
      return nativeFetch(input, init);
    }

    if (url.origin !== location.origin || !url.pathname.startsWith("/api/admin/")) {
      return nativeFetch(input, init);
    }

    url.pathname = `/admin/api/${url.pathname.slice("/api/admin/".length)}`;
    const rewritten = input instanceof Request
      ? new Request(url.toString(), input)
      : url.toString();
    return nativeFetch(rewritten, init);
  };

  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/admin/")) return;
    event.preventDefault();
    url.pathname = `/admin/api/${url.pathname.slice("/api/admin/".length)}`;
    location.href = url.toString();
  });
})();
