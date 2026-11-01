function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hidden(name: string, value: string | undefined): string {
  return value === undefined
    ? ""
    : `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;
}

export function renderAuthorizationPage(input: {
  clientName: string;
  email: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scope: string;
  state?: string | undefined;
  error?: string | undefined;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Authorize Jason Knowledge</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
      background: radial-gradient(circle at top, #e8f1ff, #f7f9fc 48%); color: #17212b; }
    main { width: min(100%, 430px); padding: 30px; border: 1px solid #dbe3ed;
      border-radius: 20px; background: #fff; box-shadow: 0 24px 70px #28405f1f; }
    .mark { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px;
      color: #fff; background: #1769e0; font-weight: 800; }
    h1 { margin: 16px 0 8px; font-size: 24px; letter-spacing: -.03em; }
    p { margin: 0 0 20px; color: #5d6b7d; line-height: 1.55; }
    strong { color: #17212b; }
    label { display: grid; gap: 7px; margin-top: 14px; font-size: 13px; font-weight: 700; }
    input { width: 100%; min-height: 46px; padding: 10px 12px; border: 1px solid #cbd6e4;
      border-radius: 10px; font: inherit; }
    button { width: 100%; min-height: 48px; margin-top: 20px; border: 0; border-radius: 11px;
      color: #fff; background: #1769e0; font: inherit; font-weight: 750; cursor: pointer; }
    .error { margin: 0 0 16px; padding: 10px 12px; border-radius: 9px;
      color: #8f271f; background: #fff0ee; font-size: 13px; }
    small { display: block; margin-top: 16px; color: #7a8797; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <div class="mark">JS</div>
    <h1>Connect Jason Knowledge</h1>
    <p><strong>${escapeHtml(input.clientName)}</strong> wants to read and manage the
      Day Trade Ideas knowledge library.</p>
    ${input.error ? `<div class="error">${escapeHtml(input.error)}</div>` : ""}
    <form method="post" action="/oauth/authorize">
      ${hidden("client_id", input.clientId)}
      ${hidden("redirect_uri", input.redirectUri)}
      ${hidden("code_challenge", input.codeChallenge)}
      ${hidden("code_challenge_method", "S256")}
      ${hidden("resource", input.resource)}
      ${hidden("scope", input.scope)}
      ${hidden("state", input.state)}
      <label>Admin email
        <input name="email" type="email" autocomplete="username" required
          value="${escapeHtml(input.email)}">
      </label>
      <label>Admin password
        <input name="password" type="password" autocomplete="current-password" required>
      </label>
      <button type="submit">Authorize access</button>
    </form>
    <small>Credentials are sent directly to api.ai.daytradeideas.co.uk over HTTPS.
      ChatGPT never receives your password.</small>
  </main>
</body>
</html>`;
}

export function renderOAuthErrorPage(message: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Authorization failed</title>
<style>body{font-family:system-ui,sans-serif;max-width:620px;margin:12vh auto;padding:24px;
color:#17212b}main{padding:28px;border:1px solid #e1c6c2;border-radius:16px;background:#fff7f6}
h1{font-size:24px}p{line-height:1.6;color:#5d6b7d}</style></head>
<body><main><h1>Authorization failed</h1><p>${escapeHtml(message)}</p></main></body></html>`;
}
