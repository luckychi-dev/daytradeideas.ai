import { useEffect, useRef, useState } from "react";
import { getSession, logout, WebApiError } from "./api.js";
import { AuthPanel } from "./components/AuthPanel.js";
import { ChatPanel } from "./components/ChatPanel.js";
import { InstallPrompt } from "./components/InstallPrompt.js";
import { TopBar } from "./components/TopBar.js";
import type { ChatMessage, SessionData, VerifyResult } from "./types.js";

export function App() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadedRef = useRef(false);
  const isActive = session?.state === "active";
  const [authOpen, setAuthOpen] = useState(false);
  const [chatSeed, setChatSeed] = useState<ChatMessage[]>([]);
  const [chatVersion, setChatVersion] = useState(0);
  const [callOpen, setCallOpen] = useState(false);

  async function loadSession() {
    setLoading(true);
    setError("");
    try {
      setSession(await getSession());
    } catch (caught) {
      setError(caught instanceof WebApiError
        ? "The mentor is temporarily unavailable."
        : "I couldn’t connect to the mentor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void loadSession();
  }, []);

  useEffect(() => {
    if (!isActive) setCallOpen(false);
  }, [isActive]);

  async function handleLogout() {
    try {
      await logout();
      window.location.assign("/");
    } catch {
      setError("Logout failed. Please try again.");
    }
  }

  function handleVerified(result: VerifyResult) {
    if (result.active) {
      setSession((current) => current ? { ...current, state: "active" } : current);
      setChatSeed([]);
      setChatVersion((value) => value + 1);
    } else {
      const support = result.support;
      setSession((current) => current ? { ...current, state: "inactive" } : current);
      setChatSeed([{
        id: `verified-${Date.now()}`,
        role: "assistant",
        text: support?.text ??
          "Your email is verified, but no active subscription was found. Choose a plan below.",
        sources: support?.sources ?? [],
        plans: support?.plans ?? [],
      }]);
      setChatVersion((value) => value + 1);
    }
    setAuthOpen(false);
  }

  if (loading) {
    return (
      <div className="boot-screen">
        <span className="brand-mark" aria-hidden="true"><span /></span>
        <p>Opening your mentor…</p>
      </div>
    );
  }

  return (
    <div className="site-shell">
      <TopBar
        telegramBotUrl={session?.telegramBotUrl ?? "https://t.me/jasonsenaibot"}
        canLogout={Boolean(session && session.state !== "verification_required")}
        canCall={isActive}
        showTelegram={!isActive}
        onLogout={() => void handleLogout()}
        onStartCall={() => setCallOpen(true)}
      />
      <main className="chat-shell" aria-label="Jason Sen AI Mentor">
        {error ? (
          <div className="connection-error">
            <h1>{error}</h1>
            <button className="primary-button" type="button" onClick={() => void loadSession()}>
              Try again
            </button>
          </div>
        ) : session ? (
          <ChatPanel
            key={chatVersion}
            verificationRequired={
              session.state === "verification_required" || session.state === "awaiting_otp"
            }
            canUseMedia={isActive}
            callOpen={callOpen}
            initialMessages={chatSeed}
            onAuthenticationRequired={() => setAuthOpen(true)}
            onCallClose={() => setCallOpen(false)}
          />
        ) : null}
      </main>
      {session && authOpen && !isActive ? (
        <AuthPanel
          state={session.state}
          onClose={() => setAuthOpen(false)}
          onVerified={handleVerified}
        />
      ) : null}
      <InstallPrompt />
    </div>
  );
}
