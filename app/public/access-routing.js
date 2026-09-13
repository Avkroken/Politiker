(() => {
  const adminHash = /^#admin(?:\/|$)/;
  const legacyAdminApiPrefix = "/api/admin/";
  const adminApiPrefix = "/admin/api/";
  const criticalAdminApiPrefix = "/admin/critical/api/";
  const isAdminPath = () => location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const nativeFetch = window.fetch.bind(window);

  function isCriticalAdminRequest(method, pathname) {
    const normalizedMethod = String(method || "GET").toUpperCase();
    if (
      normalizedMethod === "POST" &&
      /^\/api\/admin\/accounts\/[^/]+\/(?:reset-password|toggle-disabled)$/.test(pathname)
    ) return true;
    if (
      normalizedMethod === "DELETE" &&
      (
        /^\/api\/admin\/accounts\/[^/]+$/.test(pathname) ||
        /^\/api\/admin\/feedback(?:\/[^/]+)?$/.test(pathname)
      )
    ) return true;
    return false;
  }

  function protectedAdminPath(pathname, method) {
    const suffix = pathname.slice(legacyAdminApiPrefix.length);
    return `${isCriticalAdminRequest(method, pathname) ? criticalAdminApiPrefix : adminApiPrefix}${suffix}`;
  }

  window.fetch = (input, init) => {
    let url;
    try {
      url = new URL(input instanceof Request ? input.url : String(input), location.href);
    } catch {
      return nativeFetch(input, init);
    }

    if (url.origin !== location.origin || !url.pathname.startsWith(legacyAdminApiPrefix)) {
      return nativeFetch(input, init);
    }

    const method = init?.method || (input instanceof Request ? input.method : "GET");
    url.pathname = protectedAdminPath(url.pathname, method);
    const rewritten = input instanceof Request
      ? new Request(url.toString(), input)
      : url.toString();
    return nativeFetch(rewritten, init);
  };

  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(legacyAdminApiPrefix)) return;
    event.preventDefault();
    url.pathname = protectedAdminPath(url.pathname, "GET");
    location.href = url.toString();
  });

  function normalizeLocation() {
    if (adminHash.test(location.hash) && !isAdminPath()) {
      location.replace(`/admin${location.search}${location.hash}`);
      return;
    }

    if (isAdminPath() && (!location.hash || location.hash === "#")) {
      history.replaceState(null, "", `${location.pathname}${location.search}#admin/accounts`);
      return;
    }

    if (isAdminPath() && location.hash && !adminHash.test(location.hash)) {
      location.replace(`/${location.search}${location.hash}`);
    }
  }

  normalizeLocation();
  addEventListener("hashchange", normalizeLocation);
})();
