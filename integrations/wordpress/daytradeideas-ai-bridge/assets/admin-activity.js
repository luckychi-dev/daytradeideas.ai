(function () {
  "use strict";
  const admin = window.DTIAIAdmin;

  function short(value, length) {
    const text = String(value || "");
    return admin.esc(text.length > length ? text.slice(0, length) + "…" : text);
  }

  function table(headers, rows) {
    return `<div class="dtiai-table-wrap"><table class="widefat striped"><thead><tr>
      ${headers.map((header) => `<th>${admin.esc(header)}</th>`).join("")}
      </tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">No records.</td></tr>`}</tbody>
    </table></div>`;
  }

  admin.onTab("activity", async (panel) => {
    try {
      const [answers, usage, events, audit] = await Promise.all([
        admin.request("/v1/admin/answers?limit=25"),
        admin.request("/v1/admin/usage?limit=25"),
        admin.request("/v1/admin/subscription-events?limit=25"),
        admin.request("/v1/admin/audit?limit=25"),
      ]);
      const answerRows = (answers.data || []).map((item) => `<tr>
        <td>${short(item.question, 80)}</td><td>${short(item.answer, 110)}</td>
        <td>${admin.esc(item.model)}</td><td>${admin.esc(item.latency_ms)}ms</td>
        <td>${admin.esc(admin.date(item.created_at))}</td></tr>`).join("");
      const usageRows = (usage.data || []).map((item) => `<tr>
        <td>${admin.esc(item.usage_type)}</td><td>${admin.esc(item.provider)}</td>
        <td>${admin.esc(item.model)}</td><td>${admin.esc(item.input_tokens)}</td>
        <td>${admin.esc(item.output_tokens)}</td>
        <td>${admin.esc(admin.money(item.estimated_cost_usd))}</td>
        <td>${admin.esc(admin.date(item.created_at))}</td></tr>`).join("");
      const eventRows = (events.data || []).map((item) => `<tr>
        <td>${admin.esc(item.event_type)}</td><td>${admin.esc(item.wordpress_user_id)}</td>
        <td>${admin.esc(admin.date(item.occurred_at))}</td>
        <td>${admin.esc(admin.date(item.received_at))}</td></tr>`).join("");
      const auditRows = (audit.data || []).map((item) => `<tr>
        <td>${admin.esc(item.action)}</td><td>${admin.esc(item.actor)}</td>
        <td>${short(item.target_id, 45)}</td><td>${admin.esc(admin.date(item.created_at))}</td>
        </tr>`).join("");
      panel.innerHTML = `
        <section class="dtiai-card"><h2>Recent answers</h2>
          ${table(["Question", "Answer", "Model", "Latency", "Time"], answerRows)}</section>
        <section class="dtiai-card"><h2>Usage ledger</h2>
          ${table(["Type", "Provider", "Model", "Input", "Output", "Cost", "Time"], usageRows)}</section>
        <div class="dtiai-grid-2">
          <section class="dtiai-card"><h2>Subscription events</h2>
            ${table(["Event", "WordPress user", "Occurred", "Received"], eventRows)}</section>
          <section class="dtiai-card"><h2>Admin audit</h2>
            ${table(["Action", "Actor", "Target", "Time"], auditRows)}</section>
        </div>`;
    } catch (error) {
      admin.showError(panel, error);
    }
  });
})();
