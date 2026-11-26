export const DEFAULT_HANDLE = "alex.rivera";
export const HANDLE_RE = /^[a-z0-9._]{3,24}$/;

/**
 * Viewer identity on the client: read from the `sx_handle` cookie set by the
 * server when the username changes. Falls back to the seeded default handle.
 */
export function getViewerHandle(): string {
  if (typeof document === "undefined") return DEFAULT_HANDLE;
  try {
    const match = document.cookie.match(/(?:^|;\s*)sx_handle=([^;]*)/);
    const value = match ? decodeURIComponent(match[1]) : "";
    return HANDLE_RE.test(value) ? value : DEFAULT_HANDLE;
  } catch {
    return DEFAULT_HANDLE;
  }
}
