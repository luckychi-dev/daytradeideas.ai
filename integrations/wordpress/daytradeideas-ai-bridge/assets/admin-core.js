(function () {
  "use strict";

  const config = window.DTIAIAdminConfig || {};
  const loaders = new Map();
  const panels = Array.from(document.querySelectorAll("[data-panel]"));
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[character]));
  }

  async function request(path, options) {
    const settings = options || {};
    return wp.apiFetch({
      path: "/dtiai/v1/admin-proxy" + path,
      method: settings.method || "GET",
      data: settings.data,
      headers: { "X-WP-Nonce": config.nonce },
    });
  }

  function notify(message, type) {
    const node = document.getElementById("dtiai-admin-notice");
    if (!node) return;
    node.hidden = false;
    node.className = "dtiai-notice is-" + (type || "info");
    node.textContent = message;
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => {
      node.hidden = true;
    }, 5000);
  }

  function money(value) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "USD",
    }).format(Number(value || 0));
  }

  function date(value) {
    return value ? new Date(value).toLocaleString("en-GB") : "—";
  }

  function loading(panel) {
    panel.innerHTML = '<div class="dtiai-loading">Loading…</div>';
  }

  function showError(panel, error) {
    const message = error && error.message ? error.message : "Request failed.";
    if (/Backend URL|Admin API token/i.test(message)) {
      panel.innerHTML = `<section class="dtiai-setup">
        <span>Connection required</span><h2>Connect the backend</h2>
        <p>${esc(message)}</p>
        <a class="button button-primary" href="${esc(config.settingsUrl)}">
          Open connection settings
        </a>
        <small>Admin API credentials stay server-side and are never sent to this browser.</small>
      </section>`;
      return;
    }
    panel.innerHTML = `<div class="dtiai-error">${esc(message)}</div>`;
  }

  function activate(name) {
    tabs.forEach((tab) => {
      tab.classList.toggle("nav-tab-active", tab.dataset.tab === name);
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
    const panel = panels.find((item) => item.dataset.panel === name);
    if (!panel) return;
    loading(panel);
    const loader = loaders.get(name);
    if (loader) Promise.resolve(loader(panel)).catch(() => {
      panel.innerHTML = '<div class="dtiai-error">Could not load this section.</div>';
    });
  }

  function onTab(name, loader) {
    loaders.set(name, loader);
    const active = tabs.find((tab) => tab.classList.contains("nav-tab-active"));
    if (active && active.dataset.tab === name) {
      const panel = panels.find((item) => item.dataset.panel === name);
      if (panel) loader(panel);
    }
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => activate(tab.dataset.tab)));

  window.DTIAIAdmin = {
    request,
    notify,
    esc,
    money,
    date,
    loading,
    showError,
    onTab,
    activate,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => activate("overview"));
  } else {
    activate("overview");
  }
})();
