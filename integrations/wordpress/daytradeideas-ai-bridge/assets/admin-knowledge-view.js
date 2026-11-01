(function () {
  "use strict";
  const admin = window.DTIAIAdmin;

  function options(selected) {
    return ["A", "B", "C", "D", "E", "F"].map((layer) =>
      `<option value="${layer}" ${layer === selected ? "selected" : ""}>Layer ${layer}</option>`
    ).join("");
  }

  function rows(items) {
    if (!items.length) {
      return '<tr><td colspan="7">No knowledge documents found.</td></tr>';
    }
    return items.map((item) => `
      <tr data-document="${admin.esc(item.id)}">
        <td><strong>${admin.esc(item.title)}</strong>
          <small>${admin.esc(item.sourceFile || "Managed knowledge")}</small></td>
        <td>${admin.esc(item.version)}</td>
        <td>${admin.esc(item.moduleCode)}</td>
        <td>${admin.esc(item.authorityLayer)}</td>
        <td>${admin.esc(item.chunkCount)}</td>
        <td>${admin.esc(admin.date(item.updatedAt))}</td>
        <td class="dtiai-row-actions">
          <button class="button button-small" data-edit>Edit</button>
          <button class="button button-small" data-delete>Delete</button>
        </td>
      </tr>`).join("");
  }

  function formMarkup() {
    return `
      <section class="dtiai-card">
        <div class="dtiai-card-head dtiai-knowledge-head">
          <div><h2>Knowledge library</h2>
            <p>Add and improve what Jason can use without changing code.</p></div>
          <button class="button button-primary" data-create>Add knowledge</button>
        </div>
        <form class="dtiai-knowledge-form" data-knowledge-form hidden>
          <div class="dtiai-knowledge-form-head">
            <h3 data-form-title>Add knowledge</h3>
            <button type="button" class="button-link" data-cancel>Close</button>
          </div>
          <div class="dtiai-form-grid">
            <label><span>Title</span><input name="title" required maxlength="240"></label>
            <label><span>Version</span><input name="version" required maxlength="40"></label>
            <label><span>Module code</span><input name="moduleCode" required maxlength="40"></label>
            <label><span>Authority</span><select name="authorityLayer"></select></label>
            <label><span>Author / speaker</span><input name="authorOrSpeaker" required maxlength="160"></label>
            <label><span>Content type</span><input name="contentType" required maxlength="80"></label>
            <label class="dtiai-field-wide"><span>Topic tags</span>
              <input name="topicTags" placeholder="risk, psychology, execution"></label>
            <label class="dtiai-field-wide"><span>Replace from document</span>
              <input name="file" type="file" accept=".docx,.xlsx,.txt,.md,.markdown">
              <small>Optional. DOCX, XLSX, TXT or Markdown up to 5 MB.</small></label>
            <label class="dtiai-field-wide"><span>Knowledge text</span>
              <textarea name="content" rows="12"
                placeholder="Paste or review the exact knowledge the mentor should use."></textarea></label>
          </div>
          <div class="dtiai-form-actions">
            <button type="button" class="button" data-cancel>Cancel</button>
            <button type="submit" class="button button-primary" data-save>Add to mentor</button>
          </div>
        </form>
        <div class="dtiai-table-wrap"><table class="widefat striped"><thead><tr>
          <th>Document</th><th>Version</th><th>Module</th><th>Authority</th>
          <th>Chunks</th><th>Updated</th><th>Actions</th>
        </tr></thead><tbody data-document-table></tbody></table></div>
      </section>`;
  }

  window.DTIAIAdminKnowledgeView = { options, rows, formMarkup };
})();
