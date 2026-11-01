import { useEffect, useRef, useState } from "react";
import { PhoneIcon, TelegramIcon } from "../icons.js";
import { telegramLaunchLink } from "../telegram-link.js";
import { MentorAvatar } from "./MentorAvatar.js";

interface TopBarProps {
  telegramBotUrl: string;
  canLogout: boolean;
  canCall: boolean;
  showTelegram: boolean;
  onLogout(): void;
  onStartCall(): void;
}

export function TopBar({
  telegramBotUrl,
  canLogout,
  canCall,
  showTelegram,
  onLogout,
  onStartCall,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const telegramLink = telegramLaunchLink(telegramBotUrl, {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <header className="topbar">
      <div className="brand">
        <div className="profile-control" ref={profileRef}>
          <button
            className="profile-button"
            type="button"
            aria-label="Account menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <MentorAvatar />
          </button>
          {menuOpen ? (
            <div className="profile-menu">
              <span>{canLogout ? "Account connected" : "Not verified"}</span>
              {canLogout ? (
                <button type="button" onClick={onLogout}>Log out</button>
              ) : null}
            </div>
          ) : null}
        </div>
        <a className="brand-copy" href="/" aria-label="Jason Sen AI Mentor home">
          <strong>Jason Sen AI Mentor</strong>
          <span>Day Trade Ideas</span>
        </a>
      </div>
      <div className="top-actions">
        {canCall ? (
          <button
            className="call-button"
            type="button"
            aria-label="Start voice call"
            onClick={onStartCall}
          >
            <PhoneIcon />
            <span>Voice call</span>
          </button>
        ) : null}
        {showTelegram ? (
          <a
            className="telegram-button"
            href={telegramLink.href}
            target={telegramLink.target}
            rel="noreferrer"
            aria-label="Open Jason AI in Telegram and link your account"
          >
            <TelegramIcon />
            <span>Use in Telegram</span>
          </a>
        ) : null}
      </div>
    </header>
  );
}
