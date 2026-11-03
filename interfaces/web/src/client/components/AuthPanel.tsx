import { useState, type FormEvent } from "react";
import {
  claimAccount,
  requestVerificationCode,
  verifyCode,
  WebApiError,
} from "../api.js";
import { ShieldIcon } from "../icons.js";
import type { AuthState, VerifyResult } from "../types.js";
import { SessionConflict } from "./SessionConflict.js";

interface AuthPanelProps {
  state: AuthState;
  onClose(): void;
  onVerified(result: VerifyResult): void;
}

function errorMessage(error: unknown): string {
  if (!(error instanceof WebApiError)) return "Something went wrong. Please try again.";
  if (error.code === "email_mismatch") return "This browser is already linked to another email.";
  if (error.code === "subscription_inactive") return "No active Day Trade Ideas membership was found.";
  if (error.code === "invalid_code") return "That code is invalid or expired.";
  if (error.code === "verification_rate_limited") {
    return "Too many verification attempts. Please wait a few minutes.";
  }
  if (error.code === "verification_unavailable") return "Verification is temporarily unavailable.";
  return "Something went wrong. Please try again.";
}

export function AuthPanel({ state, onClose, onVerified }: AuthPanelProps) {
  const [step, setStep] = useState<"email" | "otp">(
    state === "awaiting_otp" ? "otp" : "email",
  );
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accountInUse, setAccountInUse] = useState(false);

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestVerificationCode(email);
      setStep("otp");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await verifyCode(code);
      onVerified(result);
    } catch (caught) {
      if (caught instanceof WebApiError && caught.code === "account_in_use") {
        setAccountInUse(true);
        return;
      }
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function useHereInstead() {
    setBusy(true);
    setError("");
    try {
      onVerified(await claimAccount());
    } catch (caught) {
      setAccountInUse(false);
      setStep("email");
      setCode("");
      setError(caught instanceof WebApiError && caught.code === "takeover_unavailable"
        ? "This takeover request expired. Verify your email again."
        : errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="auth-icon"><ShieldIcon size={20} /></div>
        <h2 id="auth-title">
          {accountInUse
            ? "Account already in use"
            : step === "email" ? "Verify your account" : "Enter your code"}
        </h2>
        <p className="auth-lead">
          {accountInUse
            ? "Your email and code were verified, but this account is signed in elsewhere."
            : step === "email"
            ? "Enter the email on your Day Trade Ideas account."
            : `If this email is registered, a six-digit code is on its way to ${email || "your email"}.`}
        </p>

        {accountInUse ? (
          <SessionConflict busy={busy} onUseHere={() => void useHereInstead()} />
        ) : state === "inactive" && step === "email" ? (
          <p className="status-note">Your previous membership is inactive.</p>
        ) : null}

        {accountInUse ? null : step === "email" ? (
          <form onSubmit={submitEmail} className="auth-form">
            <label htmlFor="member-email">Email</label>
            <input
              id="member-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              autoFocus
              required
            />
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="auth-form">
            <label htmlFor="one-time-code">Verification code</label>
            <input
              id="one-time-code"
              className="code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              disabled={busy}
              autoFocus
              required
            />
            <button className="primary-button" type="submit" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : "Verify"}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
            >
              Use another email
            </button>
            <p className="delivery-note">
              No email after a minute? Check spam and confirm this is the email registered
              on your Day Trade Ideas account.
            </p>
          </form>
        )}

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <p className="privacy-note">Secure verification through your Day Trade Ideas account.</p>
      </section>
    </div>
  );
}
