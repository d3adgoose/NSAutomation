(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function ensureUi() {
    if (document.getElementById("nsGlobalAccount")) return;
    const page = window.location.pathname.split("/").pop() || "index.html";
    if (page === "database.html" || page === "parts-library.html") return;
    const account = document.createElement("div");
    account.id = "nsGlobalAccount";
    account.className = "header-actions database-header-actions ns-global-account";
    account.setAttribute("aria-live", "polite");
    account.innerHTML = `<div class="storage-usage-card ns-global-access-summary"><div class="storage-usage-label"><strong>Company Access</strong><span id="nsGlobalAccountLabel">Checking login...</span></div><div class="storage-usage-bar" aria-hidden="true"><span id="nsGlobalAccountBar"></span></div><p id="nsGlobalAccountStatus">Database, Parts Library, and Local AI</p></div><div class="database-account-actions ns-global-account-actions"><button id="nsGlobalLoginButton" class="login-btn" type="button">Login</button><button id="nsGlobalLogoutButton" class="secondary hidden" type="button">Logout</button></div>`;
    const header = document.querySelector("body > header");
    if (header) header.appendChild(account);
    else document.body.prepend(account);

    const modal = document.createElement("div");
    modal.id = "nsGlobalLoginModal";
    modal.className = "modal hidden ns-global-login-modal";
    modal.innerHTML = `<div class="modal-content ns-global-login-content" role="dialog" aria-modal="true" aria-labelledby="nsGlobalLoginTitle"><form id="nsGlobalLoginForm"><h2 id="nsGlobalLoginTitle">N/S Automation Login</h2><p>Use the same email and password as the Database and Parts Library.</p><label>Email<input id="nsGlobalLoginEmail" type="email" autocomplete="username" placeholder="name@company.com"></label><label>Password<input id="nsGlobalLoginPassword" type="password" autocomplete="current-password"></label><p id="nsGlobalLoginMessage" class="warranty-status" role="status" aria-live="polite"></p><div class="button-row"><button id="nsGlobalSubmitLogin" type="submit">Login</button><button id="nsGlobalCancelLogin" class="secondary" type="button">Cancel</button></div></form></div>`;
    document.body.appendChild(modal);

    document.getElementById("nsGlobalLoginButton").addEventListener("click", openLogin);
    document.getElementById("nsGlobalLogoutButton").addEventListener("click", logout);
    document.getElementById("nsGlobalLoginForm").addEventListener("submit", event => { event.preventDefault(); login(); });
    document.getElementById("nsGlobalCancelLogin").addEventListener("click", closeLogin);
    modal.addEventListener("click", event => { if (event.target === modal) closeLogin(); });
  }

  function openLogin() {
    document.getElementById("nsGlobalLoginModal")?.classList.remove("hidden");
    document.getElementById("nsGlobalLoginEmail")?.focus();
  }

  function closeLogin() { document.getElementById("nsGlobalLoginModal")?.classList.add("hidden"); }

  async function login() {
    const email = document.getElementById("nsGlobalLoginEmail").value.trim();
    const password = document.getElementById("nsGlobalLoginPassword").value;
    const message = document.getElementById("nsGlobalLoginMessage");
    if (!email || !password) { message.textContent = "Enter your email and password."; return; }
    message.textContent = "Logging in...";
    const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { message.textContent = error.message || "Login failed."; return; }
    document.getElementById("nsGlobalLoginPassword").value = "";
    closeLogin();
  }

  async function logout() {
    await window.supabaseClient?.auth.signOut();
    location.reload();
  }

  async function render(session) {
    const user = session?.user || null;
    const status = document.getElementById("nsGlobalAccountStatus");
    const label = document.getElementById("nsGlobalAccountLabel");
    const bar = document.getElementById("nsGlobalAccountBar");
    const loginButton = document.getElementById("nsGlobalLoginButton");
    const logoutButton = document.getElementById("nsGlobalLogoutButton");
    if (user) {
      label.textContent = "Signed in";
      status.textContent = "Shared company access is available throughout this website.";
      bar.style.width = "100%";
      loginButton.textContent = user.email || "Database user";
      loginButton.classList.add("account-email-pill");
      loginButton.classList.remove("hidden"); logoutButton.classList.remove("hidden");
    } else {
      label.textContent = "Login required";
      status.textContent = "Log in to access the shared company libraries and Local AI.";
      bar.style.width = "0%";
      loginButton.textContent = "Login";
      loginButton.classList.remove("account-email-pill");
      loginButton.classList.remove("hidden"); logoutButton.classList.add("hidden");
    }
    window.dispatchEvent(new CustomEvent("ns-auth-session-changed", { detail: { user } }));
  }

  async function initialize() {
    ensureUi();
    if (!document.getElementById("nsGlobalAccount")) return;
    if (!window.supabaseClient) {
      document.getElementById("nsGlobalAccountStatus").textContent = "Login unavailable";
      document.getElementById("nsGlobalLoginButton").disabled = true;
      return;
    }
    const { data } = await window.supabaseClient.auth.getSession();
    await render(data.session);
    window.supabaseClient.auth.onAuthStateChange((_event, session) => render(session));
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
