import type { PreparedImage, RecordedAudio } from "../media.js";
import { CloseIcon } from "../icons.js";

export function ImageAttachment({
  image,
  onRemove,
}: {
  image: PreparedImage;
  onRemove(): void;
}) {
  return (
    <div className="attachment-preview">
      <img src={image.dataUrl} alt="Chart ready to send" />
      <button type="button" aria-label="Remove attached image" onClick={onRemove}>
        <CloseIcon />
      </button>
    </div>
  );
}

export function VoiceAttachment({
  voice,
  previewUrl,
  disabled,
  onRemove,
}: {
  voice: RecordedAudio;
  previewUrl: string;
  disabled: boolean;
  onRemove(): void;
}) {
  if (!previewUrl) return null;
  return (
    <div className="voice-attachment">
      <div>
        <strong>Voice note ready</strong>
        <small>{voice.durationSeconds}s · tap Send when ready</small>
      </div>
      <audio
        controls
        playsInline
        preload="metadata"
        aria-label="Recorded voice note ready to send"
        src={previewUrl}
      />
      <button
        type="button"
        aria-label="Remove recorded voice note"
        disabled={disabled}
        onClick={onRemove}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
