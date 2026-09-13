const ADMIN_API_PREFIX = "/admin/api/";
const CRITICAL_ADMIN_API_PREFIX = "/admin/critical/api/";
const LEGACY_ADMIN_API_PREFIX = "/api/admin/";

export type AccessRoute =
  | { type: "pass"; pathname: string }
  | { type: "rewrite"; pathname: string }
  | { type: "redirect"; pathname: string };

function isCriticalAdminRequest(method: string, legacyPathname: string): boolean {
  const normalizedMethod = method.toUpperCase();

  if (
    normalizedMethod === "POST" &&
    /^\/api\/admin\/accounts\/[^/]+\/(?:reset-password|toggle-disabled)$/.test(legacyPathname)
  ) {
    return true;
  }

  if (
    normalizedMethod === "DELETE" &&
    (
      /^\/api\/admin\/accounts\/[^/]+$/.test(legacyPathname) ||
      /^\/api\/admin\/feedback(?:\/[^/]+)?$/.test(legacyPathname)
    )
  ) {
    return true;
  }

  return false;
}

function legacyAdminPath(pathname: string, prefix: string): string {
  return `${LEGACY_ADMIN_API_PREFIX}${pathname.slice(prefix.length)}`;
}

function protectedAdminPath(legacyPathname: string, method: string): string {
  const prefix = isCriticalAdminRequest(method, legacyPathname)
    ? CRITICAL_ADMIN_API_PREFIX
    : ADMIN_API_PREFIX;
  return `${prefix}${legacyPathname.slice(LEGACY_ADMIN_API_PREFIX.length)}`;
}

export function accessRoute(pathname: string, method = "GET"): AccessRoute {
  if (pathname.startsWith(CRITICAL_ADMIN_API_PREFIX)) {
    const legacyPathname = legacyAdminPath(pathname, CRITICAL_ADMIN_API_PREFIX);
    if (!isCriticalAdminRequest(method, legacyPathname)) {
      return {
        type: "redirect",
        pathname: `${ADMIN_API_PREFIX}${pathname.slice(CRITICAL_ADMIN_API_PREFIX.length)}`,
      };
    }
    return { type: "rewrite", pathname: legacyPathname };
  }

  if (pathname.startsWith(ADMIN_API_PREFIX)) {
    const legacyPathname = legacyAdminPath(pathname, ADMIN_API_PREFIX);
    if (isCriticalAdminRequest(method, legacyPathname)) {
      return {
        type: "redirect",
        pathname: `${CRITICAL_ADMIN_API_PREFIX}${pathname.slice(ADMIN_API_PREFIX.length)}`,
      };
    }
    return { type: "rewrite", pathname: legacyPathname };
  }

  if (pathname.startsWith(LEGACY_ADMIN_API_PREFIX)) {
    return {
      type: "redirect",
      pathname: protectedAdminPath(pathname, method),
    };
  }

  return { type: "pass", pathname };
}

export function requestWithPath(request: Request, pathname: string): Request {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}
