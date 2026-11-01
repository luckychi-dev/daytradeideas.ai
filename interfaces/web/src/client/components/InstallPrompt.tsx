import { useEffect, useState } from "react";
import { CloseIcon, PlusIcon, ShareIcon } from "../icons.js";
import {
  isStandaloneApp,
  mobileInstallPlatform,
  showInstallPrompt,
  subscribeInstall,
} from "../pwa-install.js";

export function InstallPrompt() {
  const [platform] = useState(mobileInstallPlatform);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  useEffect(() => {
    return subscribeInstall((canInstall) => {
      setNativeAvailable(canInstall);
      if (canInstall) setHidden(false);
    });
  }, []);

  async function install() {
    try {
      if (await showInstallPrompt()) {
        setHidden(true);
        return;
      }
    } catch {
      // The manual guide remains available if the browser rejects its prompt.
    }
    setInstructionsOpen(true);
  }

  if (!platform || hidden || isStandaloneApp()) return null;
  return (
    <>
      <aside className="install-prompt" aria-label="Install Jason AI">
        <img src="/icons/icon-192.png" alt="" />
        <div>
          <strong>Install Jason AI</strong>
          <span>Add it to your home screen</span>
        </div>
        <button className="install-action" type="button" onClick={() => void install()}>
          <PlusIcon /> Install
        </button>
        <button
          className="install-dismiss"
          type="button"
          aria-label="Not now"
          onClick={() => setHidden(true)}
        >
          <CloseIcon />
        </button>
      </aside>
      {instructionsOpen ? (
        <div
          className="install-guide-backdrop"
          role="presentation"
          onMouseDown={() => setInstructionsOpen(false)}
        >
          <section
            className="install-guide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-guide-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="install-guide-close"
              type="button"
              aria-label="Close installation instructions"
              onClick={() => setInstructionsOpen(false)}
            >
              <CloseIcon />
            </button>
            <img src="/icons/icon-192.png" alt="" />
            <p>INSTALL JASON AI</p>
            <h2 id="install-guide-title">
              {platform === "ios" ? "Add to your iPhone" : "Add to your Android home screen"}
            </h2>
            {platform === "ios" ? (
              <ol>
                <li><span><ShareIcon /></span>Tap the <strong>Share</strong> button in Safari.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong>.</li>
              </ol>
            ) : (
              <ol>
                <li>Tap the browser menu <strong>⋮</strong>.</li>
                <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Confirm the installation.</li>
              </ol>
            )}
            <button
              className="install-guide-done"
              type="button"
              onClick={() => setInstructionsOpen(false)}
            >
              Got it
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
