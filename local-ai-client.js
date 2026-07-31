"use strict";

(() => {
  const GATEWAY_ORIGIN = "http://127.0.0.1:4173";

  function isServedByGateway() {
    return (location.hostname === "127.0.0.1" || location.hostname === "localhost") && location.port === "4173";
  }

  function gatewayUrl(path = "/api/local-ai") {
    const normalizedPath = String(path || "/api/local-ai").startsWith("/") ? String(path || "/api/local-ai") : `/${path}`;
    return `${isServedByGateway() ? "" : GATEWAY_ORIGIN}${normalizedPath}`;
  }

  function detectTargetAddressSpace() {
    if (isServedByGateway() || typeof Request !== "function") return "";
    for (const candidate of ["loopback", "local"]) {
      try {
        const request = new Request(`${GATEWAY_ORIGIN}/api/local-ai`, { targetAddressSpace: candidate });
        if ("targetAddressSpace" in request && request.targetAddressSpace === candidate) return candidate;
      } catch { /* Try the address-space name supported by this Chrome version. */ }
    }
    return "";
  }

  async function getSession(loginMessage = "Sign in through Database before using Local AI.") {
    if (!window.supabaseClient) throw new Error("Database login is unavailable on this page.");
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error || !data.session?.access_token) throw new Error(loginMessage);
    return data.session;
  }

  async function getSessionToken(loginMessage) {
    return (await getSession(loginMessage)).access_token;
  }

  async function fetchLocalAi(path = "/api/local-ai", options = {}) {
    const { token, loginMessage, headers: suppliedHeaders, ...fetchOptions } = options;
    const accessToken = token || await getSessionToken(loginMessage);
    const headers = new Headers(suppliedHeaders || {});
    headers.set("Authorization", `Bearer ${accessToken}`);
    if (fetchOptions.body != null && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const requestOptions = { ...fetchOptions, headers };
    const targetAddressSpace = detectTargetAddressSpace();
    if (targetAddressSpace) requestOptions.targetAddressSpace = targetAddressSpace;
    return fetch(gatewayUrl(path), requestOptions);
  }

  window.NSLocalAIClient = Object.freeze({
    gatewayOrigin: GATEWAY_ORIGIN,
    isServedByGateway,
    gatewayUrl,
    detectTargetAddressSpace,
    getSession,
    getSessionToken,
    fetch: fetchLocalAi
  });
})();
