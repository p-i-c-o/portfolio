(() => {
  const unavailableMessage = 'Accounts and comments are temporarily unavailable. Please try again later.';

  function unavailable() {
    const error = new Error(unavailableMessage);
    error.serviceUnavailable = true;
    return error;
  }

  async function request(url, options = {}, validate = () => true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      let response;
      let result;
      try {
        response = await fetch(url, {
          ...options,
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json', ...options.headers }
        });
        if (response.status >= 500 || !response.headers.get('content-type')?.includes('application/json')) {
          throw unavailable();
        }
        result = await response.json();
      } catch {
        throw unavailable();
      }
      if (!result || typeof result !== 'object' || Array.isArray(result) || !Object.keys(result).length) throw unavailable();
      if (!response.ok) {
        // Only show deliberate client-facing JSON errors, never HTML or parser errors.
        if (typeof result.error !== 'string' || !result.error.trim()) throw unavailable();
        throw new Error(result.error);
      }
      if ('error' in result || !validate(result)) throw unavailable();
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  window.CommentAPI = { request, unavailable, unavailableMessage };
})();
