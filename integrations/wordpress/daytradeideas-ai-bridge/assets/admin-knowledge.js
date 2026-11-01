(function () {
  "use strict";
  const admin = window.DTIAIAdmin;

  function rows(items) {
    if (!items.length) return '<tr><td colspan="5">No knowledge chunks found.</td></tr>';
    return items.map((item) => `
      <tr data-chunk="${admin.esc(item.id)}">
        <td><strong>${admin.esc(item.source_id)}</strong>
          <small>${admin.esc(item.source_title)} · v${admin.esc(item.version)}</small></td>
        <td>${admin.esc(item.locator)}</td>
        <td>${admin.esc(item.authority_layer)}</td>
        <td><span class="dtiai-status">${admin.esc(item.approval_status)}</span></td>
        <td class="dtiai-preview">${admin.esc(item.content_preview)}</td>
        <td class="dtiai-row-actions">
          <button class="button button-small button-primary" data-approval="true"
            ${item.approval_status === "approved" ? "disabled" : ""}>Approve</button>
          <button class="button button-small" data-approval="false"
            ${item.approval_status === "rejected" ? "disabled" : ""}>Reject</button>
        </td>
      </tr>`).join("");
  }

  async function load(panel) {
    const status = panel.querySelector('[name="knowledge-status"]').value;
    const query = new URLSearchParams({ limit: "50" });
    if (status) query.set("status", status);
    try {
      const response = await admin.request(`/v1/admin/knowledge?${query}`);
      panel.querySelector("[data-knowledge-table]").innerHTML = rows(response.data || []);
    } catch (error) {
      admin.showError(panel, error);
    }
  }

  admin.onTab("knowledge", async (panel) => {
    panel.innerHTML = `
      <section class="dtiai-card">
        <div class="dtiai-card-head"><div><h2>Knowledge review</h2>
          <p>Only approved chunks are available to the mentor.</p></div>
          <select name="knowledge-status">
            <option value="">All statuses</option>
            <option value="validation_required">Validation required</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="superseded">Superseded</option>
          </select></div>
        <div class="dtiai-table-wrap"><table class="widefat striped"><thead><tr>
          <th>Source</th><th>Locator</th><th>Authority</th><th>Status</th>
          <th>Preview</th><th>Actions</th>
        </tr></thead><tbody data-knowledge-table></tbody></table></div>
      </section>`;
    panel.querySelector('[name="knowledge-status"]').addEventListener("change", () => load(panel));
    panel.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-approval]");
      const row = event.target.closest("[data-chunk]");
      if (!button || !row) return;
      button.disabled = true;
      try {
        await admin.request(`/v1/admin/knowledge/${row.dataset.chunk}/approval`, {
          method: "POST",
          data: { approved: button.dataset.approval === "true" },
        });
        admin.notify("Knowledge status updated.", "success");
        await load(panel);
      } catch (error) {
        admin.notify(error.message || "Knowledge update failed.", "error");
        button.disabled = false;
      }
    });
    await load(panel);
  });
})();
