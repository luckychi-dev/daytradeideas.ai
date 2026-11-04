import { useEffect, useRef, useState } from "react";
import { startRecording, type ActiveRecorder, type RecordedAudio } from "./media.js";

export function useVoiceDraft(
  onSendVoice: (audio: RecordedAudio) => Promise<void>,
) {
  const [recorder, setRecorder] = useState<ActiveRecorder | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [voice, setVoice] = useState<RecordedAudio | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef<ActiveRecorder | null>(null);

  useEffect(() => {
    if (!recorder) return;
    const timer = window.setInterval(() => {
      setRecordedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recorder]);

  useEffect(() => {
    if (!voice) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(voice.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [voice]);

  useEffect(() => () => recorderRef.current?.cancel(), []);

  async function toggleRecording() {
    setError("");
    if (recorderRef.current) {
      await recorderRef.current.stop();
      return;
    }
    try {
      const active = await startRecording({ maxMs: 120_000 });
      recorderRef.current = active;
      setRecorder(active);
      setRecordedSeconds(0);
      void active.done.then((audio) => {
        recorderRef.current = null;
        setRecorder(null);
        if (audio) setVoice(audio);
      });
    } catch {
      setError("Microphone access was blocked. Allow it in your browser and try again.");
    }
  }

  async function stopRecording() {
    await recorderRef.current?.stop();
  }

  async function send(): Promise<boolean> {
    if (!voice || sending) return false;
    setSending(true);
    setError("");
    try {
      await onSendVoice(voice);
      setVoice(null);
      return true;
    } catch {
      setError("The voice note was not sent. It is still ready to retry.");
      return false;
    } finally {
      setSending(false);
    }
  }

  function remove() {
    if (!sending) setVoice(null);
  }

  return {
    recorder,
    recordedSeconds,
    voice,
    previewUrl,
    sending,
    error,
    toggleRecording,
    stopRecording,
    send,
    remove,
  };
}
