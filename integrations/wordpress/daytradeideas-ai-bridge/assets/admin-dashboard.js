(function () {
  "use strict";
  const admin = window.DTIAIAdmin;

  function metric(label, value, tone) {
    return `<article class="dtiai-metric ${tone || ""}">
      <span>${admin.esc(label)}</span><strong>${admin.esc(value)}</strong>
    </article>`;
  }

  function statusOk(value) {
    return value ? "Configured" : "Missing";
  }

  function creditMetric(balance) {
    if (!balance || !balance.configured || typeof balance.availableUsd !== "number") {
      return metric("xAI credits", "Not connected");
    }
    return metric(
      "xAI credits",
      admin.money(balance.availableUsd),
      balance.availableUsd <= 5 ? "warn" : "accent",
    );
  }

  async function billingSummary() {
    try {
      return await admin.request("/v1/admin/xai-balance");
    } catch {
      return { configured: false, availableUsd: null };
    }
  }

  function render(panel, overview, integration, analysis, answers, usage, billing) {
    const statuses = (analysis.byAssessmentStatus || [])
      .map((item) => `${item.status}: ${item.count}`).join(" · ") || "No assessments";
    const rules = (analysis.failedRules || [])
      .slice(0, 5).map((item) => `${item.ruleId} (${item.count})`).join(" · ") || "None";
    const recentAnswers = (answers.data || []).slice(0, 5).map((item) => `
      <tr><td>${admin.esc(item.request_id)}</td><td>${admin.esc(item.model)}</td>
      <td>${admin.esc(admin.money(item.estimated_cost_usd))}</td>
      <td>${admin.esc(admin.date(item.created_at))}</td></tr>`).join("");
    const recentUsage = (usage.data || []).slice(0, 5).map((item) => `
      <tr><td>${admin.esc(item.usage_type)}</td><td>${admin.esc(item.model)}</td>
      <td>${admin.esc(admin.money(item.estimated_cost_usd))}</td>
      <td>${admin.esc(admin.date(item.created_at))}</td></tr>`).join("");

    panel.innerHTML = `
      <div class="dtiai-metrics">
        ${metric("Active subscribers", overview.activeSubscribers)}
        ${metric("Pending", overview.pendingSubscribers)}
        ${metric("Messages today", overview.messagesToday)}
        ${metric("Today’s cost", admin.money(overview.todayCostUsd), "accent")}
        ${metric("Month cost", admin.money(overview.monthCostUsd))}
        ${creditMetric(billing)}
        ${metric("Answers · 24h", overview.answers24h)}
        ${metric("Validation chunks", overview.validationChunks)}
        ${metric("New feedback", overview.newFeedback, overview.newFeedback ? "warn" : "")}
      </div>
      <div class="dtiai-grid-2">
        <section class="dtiai-card"><h2>Integration status</h2>
          <dl class="dtiai-key-values">
            <dt>DeepSeek</dt><dd>${admin.esc(statusOk(integration.deepseekConfigured))}</dd>
            <dt>xAI voice</dt><dd>${admin.esc(statusOk(integration.xaiVoiceConfigured))}</dd>
            <dt>xAI management</dt><dd>${admin.esc(statusOk(integration.xaiManagementConfigured))}</dd>
            <dt>WordPress bridge</dt><dd>${admin.esc(statusOk(integration.wordpressBridgeConfigured))}</dd>
            <dt>Model</dt><dd>${admin.esc(integration.deepseekModel)}</dd>
          </dl>
        </section>
        <section class="dtiai-card"><h2>Analysis · ${admin.esc(analysis.periodDays)} days</h2>
          <dl class="dtiai-key-values">
            <dt>Assessments</dt><dd>${admin.esc(analysis.assessedAnswers)}</dd>
            <dt>Status</dt><dd>${admin.esc(statuses)}</dd>
            <dt>Failed rules</dt><dd>${admin.esc(rules)}</dd>
            <dt>Average latency</dt><dd>${admin.esc(analysis.averageLatencyMs)}ms</dd>
          </dl>
        </section>
      </div>
      <section class="dtiai-card"><div class="dtiai-card-head"><h2>Operations</h2></div>
        <div class="dtiai-actions">
          <button class="button" data-operation="reconcile">Reconcile subscriptions</button>
          <button class="button" data-operation="retention">Run retention</button>
        </div>
      </section>
      <div class="dtiai-grid-2">
        <section class="dtiai-card"><h2>Recent answers</h2>
          <table class="widefat striped"><thead><tr><th>Request</th><th>Model</th>
          <th>Cost</th><th>Time</th></tr></thead><tbody>${recentAnswers}</tbody></table>
        </section>
        <section class="dtiai-card"><h2>Recent usage</h2>
          <table class="widefat striped"><thead><tr><th>Type</th><th>Model</th>
          <th>Cost</th><th>Time</th></tr></thead><tbody>${recentUsage}</tbody></table>
        </section>
      </div>`;

    panel.querySelectorAll("[data-operation]").forEach((button) => {
      button.addEventListener("click", async () => {
        const operation = button.dataset.operation;
        const path = operation === "reconcile"
          ? "/v1/admin/subscriptions/reconcile"
          : "/v1/admin/retention/run";
        button.disabled = true;
        try {
          await admin.request(path, { method: "POST" });
          admin.notify("Operation completed.", "success");
        } catch (error) {
          admin.notify(error.message || "Operation failed.", "error");
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  admin.onTab("overview", async (panel) => {
    try {
      const [overview, integration, analysis, answers, usage, billing] = await Promise.all([
        admin.request("/v1/admin/overview"),
        admin.request("/v1/admin/integration-status"),
        admin.request("/v1/admin/analysis?days=30"),
        admin.request("/v1/admin/answers?limit=5"),
        admin.request("/v1/admin/usage?limit=5"),
        billingSummary(),
      ]);
      render(panel, overview, integration, analysis, answers, usage, billing);
    } catch (error) {
      admin.showError(panel, error);
    }
  });
})();
