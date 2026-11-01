import { useEffect, useRef, useState } from "react";
import { WebApiError } from "../api.js";
import { speak, startRecording, type ActiveRecorder, type RecordedAudio } from "../media.js";
import { MicIcon, PhoneIcon } from "../icons.js";
import type { ChatSource } from "../types.js";
import { MentorAvatar } from "./MentorAvatar.js";

interface VoiceCallPanelProps {
  active: boolean;
  onClose(): void;
  onTurn(audio: RecordedAudio): Promise<{
    text: string;
    transcript: string;
    sources: ChatSource[];
  }>;
}

type CallState = "starting" | "listening" | "thinking" | "speaking" | "ready" | "error";

const statusCopy: Record<CallState, string> = {
  starting: "Connecting your microphone…",
  listening: "Listening…",
  thinking: "Jason is reviewing your question…",
  speaking: "Jason is speaking…",
  ready: "Tap below when you are ready to speak.",
  error: "The voice call could not continue.",
};

function callError(caught: unknown): string {
  if (!(caught instanceof WebApiError)) return "Please end the call and try again.";
  if (caught.code === "daily_voice_limit_reached") return "You have reached today's voice limit.";
  if (caught.code === "voice_transcription_unavailable") return "Voice calls are not configured yet.";
  if (caught.code === "subscriber_not_allowed") return "Please verify your subscription to continue.";
  if (caught.code === "monthly_budget_reached") return "The mentor has reached its service budget.";
  return "Please end the call and try again.";
}

function callDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function VoiceCallPanel({ active, onClose, onTurn }: VoiceCallPanelProps) {
  const [state, setState] = useState<CallState>("starting");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<ActiveRecorder | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const generation = ++generationRef.current;
    void beginTurn(generation);
    return () => {
      generationRef.current += 1;
      recorderRef.current?.cancel();
      window.speechSynthesis?.cancel();
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  async function beginTurn(generation = generationRef.current) {
    if (!active || generation !== generationRef.current) return;
    setState("starting");
    setError("");
    try {
      const recorder = await startRecording({
        autoStopSilence: true,
        maxMs: 20_000,
        noSpeechMs: 12_000,
        silenceMs: 1100,
      });
      if (!active || generation !== generationRef.current) {
        recorder.cancel();
        return;
      }
      recorderRef.current = recorder;
      setState("listening");
      const audio = await recorder.done;
      recorderRef.current = null;
      if (!active || generation !== generationRef.current) return;
      if (!audio) {
        setState("ready");
        return;
      }
      setState("thinking");
      const response = await onTurn(audio);
      if (!active || generation !== generationRef.current) return;
      setState("speaking");
      await speak(response.text);
      if (!active || generation !== generationRef.current) return;
      void beginTurn(generation);
    } catch (caught) {
      if (!active || generation !== generationRef.current) return;
      setState("error");
      setError(callError(caught));
    }
  }

  function endCall() {
    generationRef.current += 1;
    recorderRef.current?.cancel();
    window.speechSynthesis?.cancel();
    onClose();
  }

  if (!active) return null;
  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label="Voice call">
      <section className={`call-card call-state-${state}`}>
        <header className="call-topbar">
          <span className="call-live"><i /> In call</span>
          <span className="call-timer">{callDuration(elapsed)}</span>
        </header>
        <div className="call-body">
          <div className={`call-avatar ${state === "speaking" || state === "listening" ? "is-live" : ""}`}>
            <MentorAvatar size="large" />
            <span className="call-signal"><i /><i /><i /></span>
          </div>
          <p className="call-kicker">JASON SEN AI MENTOR</p>
          <h2>Jason Sen</h2>
          <p className="call-status" aria-live="polite">{statusCopy[state]}</p>
          {error ? <p className="call-error" role="alert">{error}</p> : null}
          <div className="call-wave" aria-hidden="true">
            {Array.from({ length: 24 }, (_, index) => <i key={index} />)}
          </div>
        </div>
        <footer className="call-controls">
          {state === "ready" || state === "error" ? (
            <button className="call-retry" type="button" onClick={() => void beginTurn()}>
              <MicIcon /> <span>Start speaking</span>
            </button>
          ) : null}
          <button className="call-end" type="button" onClick={endCall}>
            <PhoneIcon size={28} />
            <span>End call</span>
          </button>
          <p className="call-note">Audio is not stored · Educational guidance only</p>
        </footer>
      </section>
    </div>
  );
}
