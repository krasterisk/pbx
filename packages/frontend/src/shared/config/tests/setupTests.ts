import '@testing-library/jest-dom';

/**
 * Node/undici `fetch` rejects relative URLs. RTK Query builds `/api/...` paths.
 * Rewrite them to an absolute origin before the real fetch runs (stubs still win).
 */
const nativeFetch = globalThis.fetch.bind(globalThis);

function toAbsolute(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === 'string' && input.startsWith('/')) {
    return `http://127.0.0.1${input}`;
  }
  if (input instanceof Request && input.url.startsWith('/')) {
    return new Request(`http://127.0.0.1${input.url}`, input);
  }
  return input;
}

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  nativeFetch(toAbsolute(input) as RequestInfo, init)) as typeof fetch;
