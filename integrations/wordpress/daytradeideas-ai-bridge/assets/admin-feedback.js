(function () {
  "use strict";
  const admin = window.DTIAIAdmin;

  function rows(items) {
    if (!items.length) return '<tr><td colspan="5">No feedback yet.</td></tr>';
    return items.map((item) => `
      <tr data-feedback="${admin.esc(item.id)}">
        <td><strong>${admin.esc(item.category || "General")}</strong>
          <small>${admin.esc(admin.date(item.created_at))}</small></td>
        <td>${admin.esc(item.message)}</td>
        <td><span class="dtiai-status">${admin.esc(item.status)}</span></td>
        <td>${admin.esc(item.admin_note || "—")}</td>
        <td class="dtiai-row-actions">
          <button class="button button-small" data-feedback-status="reviewing">Reviewing</button>
          <button class="button button-small button-primary" data-feedback-status="resolved">Resolve</button>
          <button class="button button-small" data-feedback-status="new">Reopen</button>
        </td>
      </tr>`).join("");
  }

  async function load(panel) {
    try {
      const response = await admin.request("/v1/admin/feedback?limit=50");
      panel.querySelector("[data-feedback-table]").innerHTML = rows(response.data || []);
    } catch (error) {
      admin.showError(panel, error);
    }
  }

  admin.onTab("feedback", async (panel) => {
    panel.innerHTML = `
      <section class="dtiai-card">
        <div class="dtiai-card-head"><div><h2>Subscriber feedback</h2>
          <p>Review reports and mark them resolved after handling.</p></div></div>
        <div class="dtiai-table-wrap"><table class="widefat striped"><thead><tr>
          <th>Submitted</th><th>Message</th><th>Status</th><th>Admin note</th><th>Actions</th>
        </tr></thead><tbody data-feedback-table></tbody></table></div>
      </section>`;
    panel.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-feedback-status]");
      const row = event.target.closest("[data-feedback]");
      if (!button || !row) return;
      const note = window.prompt("Optional admin note", "") || null;
      button.disabled = true;
      try {
        await admin.request(`/v1/admin/feedback/${row.dataset.feedback}`, {
          method: "PATCH",
          data: { status: button.dataset.feedbackStatus, note },
        });
        admin.notify("Feedback updated.", "success");
        await load(panel);
      } catch (error) {
        admin.notify(error.message || "Feedback update failed.", "error");
        button.disabled = false;
      }
    });
    await load(panel);
  });
})();
