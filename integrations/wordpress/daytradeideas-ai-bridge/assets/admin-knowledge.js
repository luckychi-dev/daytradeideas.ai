(function () {
  "use strict";
  const admin = window.DTIAIAdmin;
  const view = window.DTIAIAdminKnowledgeView;

  function value(form, name) {
    return String(new FormData(form).get(name) || "").trim();
  }

  function fileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.readAsDataURL(file);
    });
  }

  async function load(panel) {
    try {
      const response = await admin.request("/v1/admin/knowledge/documents");
      panel.querySelector("[data-document-table]").innerHTML = view.rows(response.data || []);
    } catch (error) {
      admin.showError(panel, error);
    }
  }

  function showForm(panel, document) {
    const form = panel.querySelector("[data-knowledge-form]");
    form.reset();
    form.dataset.id = document?.id || "";
    form.hidden = false;
    form.querySelector("[name=authorityLayer]").innerHTML = view.options(
      document?.authorityLayer || "B",
    );
    form.elements.title.value = document?.title || "";
    form.elements.version.value = document?.version || "1.0";
    form.elements.moduleCode.value = document?.moduleCode || "CUSTOM";
    form.elements.authorOrSpeaker.value = document?.authorOrSpeaker ||
      "Jason Sen / Day Trade Ideas";
    form.elements.contentType.value = document?.contentType || "teaching";
    form.elements.topicTags.value = (document?.topicTags || []).join(", ");
    form.elements.content.value = document?.content || "";
    form.querySelector("[data-form-title]").textContent =
      document ? "Edit knowledge" : "Add knowledge";
    form.querySelector("[data-save]").textContent =
      document ? "Save changes" : "Add to mentor";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeForm(panel) {
    const form = panel.querySelector("[data-knowledge-form]");
    form.hidden = true;
    form.dataset.id = "";
    form.reset();
  }

  async function save(panel, event) {
    event.preventDefault();
    const form = event.currentTarget;
    const saveButton = form.querySelector("[data-save]");
    const file = form.querySelector("[name=file]").files?.[0] || null;
    const content = value(form, "content");
    if (!file && !content) {
      admin.notify("Add a file or paste knowledge text.", "error");
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      admin.notify("The document must be 5 MB or smaller.", "error");
      return;
    }
    const payload = {
      title: value(form, "title"),
      version: value(form, "version"),
      moduleCode: value(form, "moduleCode"),
      authorOrSpeaker: value(form, "authorOrSpeaker"),
      authorityLayer: value(form, "authorityLayer"),
      contentType: value(form, "contentType"),
      topicTags: value(form, "topicTags").split(",").map((tag) => tag.trim()).filter(Boolean),
    };
    if (content) payload.content = content;
    if (file) {
      payload.file = {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64: await fileBase64(file),
      };
    }
    const id = form.dataset.id;
    saveButton.disabled = true;
    try {
      await admin.request(
        `/v1/admin/knowledge/documents${id ? "/" + id : ""}`,
        { method: id ? "PATCH" : "POST", data: payload },
      );
      admin.notify(id ? "Knowledge updated." : "Knowledge added.", "success");
      closeForm(panel);
      await load(panel);
    } catch (error) {
      admin.notify(error.message || "Could not save knowledge.", "error");
    } finally {
      saveButton.disabled = false;
    }
  }

  async function edit(panel, id) {
    try {
      showForm(panel, await admin.request(`/v1/admin/knowledge/documents/${id}`));
    } catch (error) {
      admin.notify(error.message || "Could not load knowledge.", "error");
    }
  }

  async function remove(panel, id) {
    if (!window.confirm("Delete this knowledge document and all of its search chunks?")) {
      return;
    }
    try {
      await admin.request(`/v1/admin/knowledge/documents/${id}`, {
        method: "DELETE",
        data: { confirm: true },
      });
      admin.notify("Knowledge deleted.", "success");
      await load(panel);
    } catch (error) {
      admin.notify(error.message || "Could not delete knowledge.", "error");
    }
  }

  admin.onTab("knowledge", async (panel) => {
    panel.innerHTML = view.formMarkup();
    panel.onsubmit = (event) => void save(panel, event);
    panel.onclick = (event) => {
      const row = event.target.closest("[data-document]");
      if (event.target.closest("[data-create]")) {
        showForm(panel, null);
      } else if (event.target.closest("[data-cancel]")) {
        closeForm(panel);
      } else if (row && event.target.closest("[data-edit]")) {
        void edit(panel, row.dataset.document);
      } else if (row && event.target.closest("[data-delete]")) {
        void remove(panel, row.dataset.document);
      }
    };
    panel.querySelector("[name=file]").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const title = panel.querySelector("[name=title]");
      if (!title.value) title.value = file.name.replace(/\.[^.]+$/, "");
    });
    await load(panel);
  });
})();
