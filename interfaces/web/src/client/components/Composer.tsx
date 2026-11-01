import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  prepareImage,
  startRecording,
  type ActiveRecorder,
  type PreparedImage,
  type RecordedAudio,
} from "../media.js";
import { CloseIcon, ImageIcon, MicIcon, SendIcon, StopIcon } from "../icons.js";

interface ComposerProps {
  canUseMedia: boolean;
  disabled: boolean;
  onSendImage(image: PreparedImage, text: string): Promise<void>;
  onSendText(text: string): Promise<void>;
  onSendVoice(audio: RecordedAudio): Promise<void>;
}

export function Composer({
  canUseMedia,
  disabled,
  onSendImage,
  onSendText,
  onSendVoice,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [recorder, setRecorder] = useState<ActiveRecorder | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const recorderRef = useRef<ActiveRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!recorder) return;
    const timer = window.setInterval(() => {
      setRecordedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recorder]);

  useEffect(() => () => recorderRef.current?.cancel(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || voiceBusy || imageBusy) return;
    const question = text.trim();
    if (image) {
      const selected = image;
      setText("");
      setImage(null);
      await onSendImage(selected, question);
      return;
    }
    if (!question) return;
    setText("");
    await onSendText(question);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function chooseImage(file: File | undefined) {
    if (!file) return;
    setImageBusy(true);
    setLocalError("");
    try {
      setImage(await prepareImage(file));
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "That image could not be read.");
    } finally {
      setImageBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function toggleRecording() {
    setLocalError("");
    if (recorderRef.current) {
      await recorderRef.current.stop();
      return;
    }
    try {
      const active = await startRecording({ maxMs: 120_000 });
      recorderRef.current = active;
      setRecorder(active);
      setRecordedSeconds(0);
      void active.done.then(async (audio) => {
        recorderRef.current = null;
        setRecorder(null);
        if (!audio) return;
        setVoiceBusy(true);
        try {
          await onSendVoice(audio);
        } finally {
          setVoiceBusy(false);
        }
      });
    } catch {
      setLocalError("Microphone access was blocked. Allow it in your browser and try again.");
    }
  }

  const busy = disabled || voiceBusy || imageBusy;
  return (
    <form className="composer" onSubmit={submit}>
      {image ? (
        <div className="attachment-preview">
          <img src={image.dataUrl} alt="Chart ready to send" />
          <button
            type="button"
            aria-label="Remove attached image"
            onClick={() => setImage(null)}
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}
      <div className="composer-input">
        <label className="sr-only" htmlFor="mentor-message">Message the AI mentor</label>
        <textarea
          id="mentor-message"
          rows={1}
          maxLength={8000}
          placeholder={image ? "Ask about this chart…" : "Ask about plans or a trading question…"}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
        />
        <div className="composer-actions">
          {canUseMedia ? (
            <>
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg"
                aria-label="Choose chart image"
                onChange={(event) => void chooseImage(event.target.files?.[0])}
              />
              <button
                className="composer-tool"
                type="button"
                aria-label="Attach a chart image"
                title="Attach a chart"
                disabled={busy || Boolean(recorder)}
                onClick={() => fileRef.current?.click()}
              >
                <ImageIcon />
              </button>
              <button
                className={`composer-tool ${recorder ? "is-recording" : ""}`}
                type="button"
                aria-label={recorder ? "Stop and send voice note" : "Record voice note"}
                title={recorder ? "Stop recording" : "Voice note"}
                disabled={disabled || imageBusy || voiceBusy}
                onClick={() => void toggleRecording()}
              >
                {recorder ? <StopIcon /> : <MicIcon />}
              </button>
            </>
          ) : null}
          <button
            className="composer-send"
            type="submit"
            aria-label="Send message"
            disabled={busy || (!text.trim() && !image)}
          >
            <SendIcon />
          </button>
        </div>
      </div>
      {recorder ? (
        <div className="recording-status" role="status">
          <span />
          Recording {Math.floor(recordedSeconds / 60)}:
          {String(recordedSeconds % 60).padStart(2, "0")}
          <button type="button" onClick={() => void recorder.stop()}>Send</button>
        </div>
      ) : null}
      {localError ? <p className="composer-error" role="alert">{localError}</p> : null}
    </form>
  );
}
