const ADMIN_API_PREFIX = "/admin/api/";
const LEGACY_ADMIN_API_PREFIX = "/api/admin/";

export type AccessRoute =
  | { type: "pass"; pathname: string }
  | { type: "rewrite"; pathname: string }
  | { type: "redirect"; pathname: string };

export function accessRoute(pathname: string): AccessRoute {
  if (pathname.startsWith(ADMIN_API_PREFIX)) {
    return {
      type: "rewrite",
      pathname: `${LEGACY_ADMIN_API_PREFIX}${pathname.slice(ADMIN_API_PREFIX.length)}`,
    };
  }

  if (pathname.startsWith(LEGACY_ADMIN_API_PREFIX)) {
    return {
      type: "redirect",
      pathname: `${ADMIN_API_PREFIX}${pathname.slice(LEGACY_ADMIN_API_PREFIX.length)}`,
    };
  }

  return { type: "pass", pathname };
}

export function requestWithPath(request: Request, pathname: string): Request {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}
