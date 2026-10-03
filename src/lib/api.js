export class ApiError extends Error {
  constructor(message, details = {}) { super(message); Object.assign(this, details); }
}

export async function apiRequest(path, { method = 'GET', body, timeout = 75000, signal, demoFallback, ...options } = {}) {
  const base = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');
  const deadline = AbortSignal.timeout(timeout);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  try {
    let response;
    try {
      response = await fetch(`${base}/api${path}`, {
        ...options, method, headers: { 'content-type': 'application/json', ...options.headers },
        body: body === undefined ? undefined : JSON.stringify(body), signal: combined
      });
    } catch (error) {
      if (combined.aborted) throw combined.reason;
      throw new ApiError('API unreachable. Start npm run dev or use the offline sandbox.', { unavailable: true, cause: error });
    }
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch {
      throw new ApiError('The API is unavailable or returned an invalid response.', { unavailable: response.status >= 500 || response.ok, status: response.status });
    }
    if (!response.ok) throw new ApiError(data.error || `Request failed (${response.status}).`, { status: response.status, provider: data.provider, code: data.code });
    return data;
  } catch (error) {
    if (combined.aborted) {
      if (combined.reason?.name === 'TimeoutError') throw new ApiError('The request timed out. Refresh before retrying a save.', { timeout: true });
      throw combined.reason;
    }
    if (error.unavailable && demoFallback) return demoFallback(error);
    throw error;
  }
}

// The coordinator explicitly selects a workspace. Failed writes are never replayed
// into the sandbox, since the server might already have committed them.
export function createApiClient(sandbox) {
  return (path, options) => sandbox ? sandbox.request(path, options) : apiRequest(path, options);
}

export function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadManifest({ manifest, filename = 'impactlens-evidence-manifest.json' }) {
  downloadJson(manifest, filename);
}
