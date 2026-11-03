interface SessionConflictProps {
  busy: boolean;
  onUseHere(): void;
}

export function SessionConflict({ busy, onUseHere }: SessionConflictProps) {
  return (
    <section className="session-conflict" aria-live="polite">
      <strong>This account is active in another session</strong>
      <p>
        Only one session can use this account at a time. Continuing will sign out
        the other session and use this account here instead.
      </p>
      <button
        className="primary-button"
        type="button"
        onClick={onUseHere}
        disabled={busy}
      >
        {busy ? "Switching session…" : "Use Here Instead"}
      </button>
    </section>
  );
}
