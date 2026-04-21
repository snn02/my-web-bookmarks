const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term'
]);

export function normalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());

  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = '';

  for (const param of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(param.toLowerCase())) {
      parsed.searchParams.delete(param);
    }
  }

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}

export function domainFromUrl(rawUrl: string): string {
  return new URL(rawUrl).hostname.toLowerCase();
}
