import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./pwa-install.js";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/brand.css";
import "./styles/avatar.css";
import "./styles/forms.css";
import "./styles/chat.css";
import "./styles/chat-content.css";
import "./styles/composer.css";
import "./styles/media.css";
import "./styles/call.css";
import "./styles/call-screen.css";
import "./styles/install.css";
import "./styles/install-guide.css";
import "./styles/responsive.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
