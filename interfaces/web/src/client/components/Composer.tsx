import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  prepareImage,
  type PreparedImage,
  type RecordedAudio,
} from "../media.js";
import { ImageIcon, MicIcon, SendIcon, StopIcon } from "../icons.js";
import { ImageAttachment, VoiceAttachment } from "./ComposerAttachments.js";
import { useVoiceDraft } from "../useVoiceDraft.js";

interface ComposerProps {
  canUseMedia: boolean;
  disabled: boolean;
  onSendImage(image: PreparedImage, text: string): Promise<void>;
  onSendText(text: string): Promise<void>;
  onSendVoice(audio: RecordedAudio): Promise<void>;
  onAuthenticationRequired(): void;
}

export function Composer({
  canUseMedia,
  disabled,
  onSendImage,
  onSendText,
  onSendVoice,
  onAuthenticationRequired,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceDraft = useVoiceDraft(onSendVoice);
  const {
    recorder,
    recordedSeconds,
    voice,
    previewUrl,
    sending: voiceBusy,
    error: voiceError,
  } = voiceDraft;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || voiceBusy || imageBusy) return;
    if (voice) {
      await voiceDraft.send();
      return;
    }
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

  const busy = disabled || voiceBusy || imageBusy || Boolean(recorder);
  return (
    <form className="composer" onSubmit={submit}>
      {image ? (
        <ImageAttachment image={image} onRemove={() => setImage(null)} />
      ) : null}
      {voice ? (
        <VoiceAttachment
          voice={voice}
          previewUrl={previewUrl}
          disabled={voiceBusy}
          onRemove={voiceDraft.remove}
        />
      ) : null}
      <div className="composer-input">
        <label className="sr-only" htmlFor="mentor-message">Message the AI mentor</label>
        <textarea
          id="mentor-message"
          rows={1}
          maxLength={8000}
          placeholder={
            voice
              ? "Voice note ready — send or remove it to type."
              : image
                ? "Ask about this chart…"
                : "Ask about plans or a trading question…"
          }
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy || Boolean(voice)}
        />
        <div className="composer-actions">
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg"
            aria-label="Choose chart image"
            disabled={!canUseMedia}
            onChange={(event) => void chooseImage(event.target.files?.[0])}
          />
          <button
            className="composer-tool"
            type="button"
            aria-label={canUseMedia ? "Attach a chart image" : "Verify subscription to attach a chart"}
            title={canUseMedia ? "Attach a chart" : "Verify subscription to attach a chart"}
            disabled={canUseMedia && (busy || Boolean(recorder) || Boolean(voice))}
            onClick={() => {
              if (canUseMedia) fileRef.current?.click();
              else onAuthenticationRequired();
            }}
          >
            <ImageIcon />
          </button>
          <button
            className={`composer-tool ${recorder ? "is-recording" : ""}`}
            type="button"
            aria-label={
              canUseMedia
                ? recorder ? "Stop recording" : "Record voice note"
                : "Verify subscription to record a voice note"
            }
            title={canUseMedia ? recorder ? "Stop recording" : "Voice note" : "Verify to record"}
            disabled={
              canUseMedia &&
              (disabled || imageBusy || voiceBusy || Boolean(image) || Boolean(voice))
            }
            onClick={() => {
              if (canUseMedia) void voiceDraft.toggleRecording();
              else onAuthenticationRequired();
            }}
          >
            {recorder ? <StopIcon /> : <MicIcon />}
          </button>
          <button
            className="composer-send"
            type="submit"
            aria-label="Send message"
            disabled={busy || (!text.trim() && !image && !voice)}
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
          <button type="button" onClick={() => void voiceDraft.stopRecording()}>Stop</button>
        </div>
      ) : null}
      {voiceError ? <p className="composer-error" role="alert">{voiceError}</p> : null}
      {localError ? <p className="composer-error" role="alert">{localError}</p> : null}
    </form>
  );
}
