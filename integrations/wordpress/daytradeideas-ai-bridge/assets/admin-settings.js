(function () {
  "use strict";
  const admin = window.DTIAIAdmin;

  function field(name, label, value, type, description) {
    const checked = type === "checkbox" && value ? "checked" : "";
    return `<tr><th scope="row"><label for="${name}">${admin.esc(label)}</label></th>
      <td><input id="${name}" name="${name}" type="${type}" value="${admin.esc(value)}"
        ${checked}>${description ? `<p class="description">${admin.esc(description)}</p>` : ""}</td></tr>`;
  }

  admin.onTab("settings", async (panel) => {
    try {
      const settings = await admin.request("/v1/admin/settings");
      panel.innerHTML = `
        <section class="dtiai-card">
          <h2>Runtime configuration</h2>
          <p class="description">Changes take effect immediately and are recorded in the admin audit log.</p>
          <form data-settings-form>
            <table class="form-table" role="presentation">
              ${field("monthlyBudgetUsd", "Monthly budget (USD)", settings.monthlyBudgetUsd, "number")}
              ${field("dailyMessagesPerSubscriber", "Daily messages per subscriber", settings.dailyMessagesPerSubscriber, "number")}
              ${field("dailyVoiceSecondsPerSubscriber", "Daily voice seconds", settings.dailyVoiceSecondsPerSubscriber, "number")}
              ${field("messageRetentionDays", "Message retention (days)", settings.messageRetentionDays, "number")}
              ${field("tradeAssessmentEnabled", "Trade assessment enabled", settings.tradeAssessmentEnabled, "checkbox")}
              ${field("memoryEnabled", "Persistent memory enabled", settings.memoryEnabled, "checkbox")}
            </table>
            <button class="button button-primary" type="submit">Save configuration</button>
          </form>
        </section>`;
      panel.querySelector("[data-settings-form]").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = {
          monthlyBudgetUsd: Number(form.elements.monthlyBudgetUsd.value),
          dailyMessagesPerSubscriber: Number(form.elements.dailyMessagesPerSubscriber.value),
          dailyVoiceSecondsPerSubscriber: Number(form.elements.dailyVoiceSecondsPerSubscriber.value),
          messageRetentionDays: Number(form.elements.messageRetentionDays.value),
          tradeAssessmentEnabled: form.elements.tradeAssessmentEnabled.checked,
          memoryEnabled: form.elements.memoryEnabled.checked,
        };
        const button = form.querySelector("button[type=submit]");
        button.disabled = true;
        try {
          await admin.request("/v1/admin/settings", { method: "PATCH", data: payload });
          admin.notify("Configuration saved.", "success");
        } catch (error) {
          admin.notify(error.message || "Could not save settings.", "error");
        } finally {
          button.disabled = false;
        }
      });
    } catch (error) {
      admin.showError(panel, error);
    }
  });
})();
