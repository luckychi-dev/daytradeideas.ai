(function () {
  "use strict";
  const admin = window.DTIAIAdmin;

  function rows(subscribers) {
    if (!subscribers.length) {
      return '<tr><td colspan="6">No subscribers found.</td></tr>';
    }
    return subscribers.map((item) => `
      <tr data-subscriber="${admin.esc(item.id)}">
        <td><strong>${admin.esc(item.displayName || "Unnamed")}</strong>
          <small>${admin.esc(item.interfaceKind)} · ${admin.esc(item.externalUserId)}</small></td>
        <td>${admin.esc(item.verifiedEmail || "Not verified")}</td>
        <td><span class="dtiai-status is-${admin.esc(item.status)}">${admin.esc(item.status)}</span></td>
        <td>${admin.esc(item.membershipStatus || "—")}</td>
        <td>${admin.esc(admin.date(item.lastVerifiedAt))}</td>
        <td class="dtiai-row-actions">
          <button class="button button-small" data-action="toggle">
            ${item.status === "suspended" ? "Reactivate" : "Suspend"}
          </button>
          <button class="button button-small" data-action="unlink">Unlink</button>
          <button class="button button-small button-link-delete" data-action="delete">Delete</button>
        </td>
      </tr>`).join("");
  }

  async function load(panel) {
    const form = panel.querySelector("[data-subscriber-filters]");
    const search = form ? form.querySelector('[name="search"]').value : "";
    const status = form ? form.querySelector('[name="status"]').value : "";
    const query = new URLSearchParams({ search, limit: "50" });
    if (status) query.set("status", status);
    try {
      const response = await admin.request(`/v1/admin/subscribers?${query}`);
      panel.querySelector("[data-subscriber-table]").innerHTML = rows(response.data || []);
    } catch (error) {
      admin.showError(panel, error);
    }
  }

  async function execute(panel, row, action) {
    const id = row.dataset.subscriber;
    const status = row.querySelector(".dtiai-status").textContent.trim();
    try {
      if (action === "toggle") {
        await admin.request(`/v1/admin/subscribers/${id}/status`, {
          method: "PATCH",
          data: { status: status === "suspended" ? "active" : "suspended" },
        });
      } else if (action === "unlink") {
        await admin.request(`/v1/admin/subscribers/${id}/unlink`, { method: "POST" });
      } else if (action === "delete") {
        if (!window.confirm("Delete this subscriber and all related history?")) return;
        await admin.request(`/v1/admin/subscribers/${id}`, {
          method: "DELETE",
          data: { confirm: true },
        });
      }
      admin.notify("Subscriber updated.", "success");
      await load(panel);
    } catch (error) {
      admin.notify(error.message || "Subscriber update failed.", "error");
    }
  }

  admin.onTab("subscribers", async (panel) => {
    panel.innerHTML = `
      <section class="dtiai-card">
        <form class="dtiai-filters" data-subscriber-filters>
          <input type="search" name="search" placeholder="Search email or user ID">
          <select name="status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
          <button class="button button-primary" type="submit">Search</button>
        </form>
        <div class="dtiai-table-wrap">
          <table class="widefat striped"><thead><tr>
            <th>Subscriber</th><th>Email</th><th>Status</th><th>Membership</th>
            <th>Last verified</th><th>Actions</th>
          </tr></thead><tbody data-subscriber-table></tbody></table>
        </div>
      </section>`;
    const form = panel.querySelector("[data-subscriber-filters]");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      load(panel);
    });
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      const row = event.target.closest("[data-subscriber]");
      if (button && row) execute(panel, row, button.dataset.action);
    });
    await load(panel);
  });
})();
