export interface PreparedImage {
  base64: string;
  dataUrl: string;
  mimeType: "image/jpeg" | "image/png";
  name: string;
}

export interface RecordedAudio {
  base64: string;
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
}

export interface ActiveRecorder {
  done: Promise<RecordedAudio | null>;
  stop(): Promise<RecordedAudio | null>;
  cancel(): void;
}

export interface RecordingOptions {
  autoStopSilence?: boolean;
  maxMs?: number;
  noSpeechMs?: number;
  silenceMs?: number;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function dataUrlBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    throw new Error("Please choose a PNG or JPEG chart image.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("That image is too large. Please choose one under 15 MB.");
  }
  if (!("createImageBitmap" in window)) {
    throw new Error("This browser cannot prepare that image. Please try a smaller chart.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const base64 = dataUrlBase64(dataUrl);
  if (Math.ceil(base64.length * 0.75) > 6 * 1024 * 1024) {
    throw new Error("That image is still too large after resizing.");
  }
  return { base64, dataUrl, mimeType: "image/jpeg", name: file.name };
}

function recorderMimeType(): string {
  const choices = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return choices.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function normalizedMimeType(value: string): string {
  return value.split(";")[0] || "audio/webm";
}

export async function startRecording(
  options: RecordingOptions = {},
): Promise<ActiveRecorder> {
  if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
    throw new Error("Voice recording is not supported in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chosenType = recorderMimeType();
  const recorder = new MediaRecorder(
    stream,
    chosenType ? { mimeType: chosenType } : undefined,
  );
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  let cancelled = false;
  let settled = false;
  let silenceStarted = 0;
  let sawSpeech = false;
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  audioContext.createMediaStreamSource(stream).connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  let resolveDone: (audio: RecordedAudio | null) => void = () => undefined;
  const done = new Promise<RecordedAudio | null>((resolve) => {
    resolveDone = resolve;
  });
  const finish = async () => {
    if (settled) return;
    settled = true;
    clearInterval(monitor);
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close().catch(() => undefined);
    if (cancelled) return resolveDone(null);
    const type = normalizedMimeType(recorder.mimeType || chosenType);
    const blob = new Blob(chunks, { type });
    if (blob.size < 500) return resolveDone(null);
    resolveDone({
      blob,
      base64: await blobToBase64(blob),
      durationSeconds: Math.max(1, Math.ceil((Date.now() - startedAt) / 1000)),
      mimeType: type,
    });
  };
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.onstop = () => void finish();
  recorder.start(250);
  const monitor = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= (options.maxMs ?? 120_000)) {
      if (recorder.state === "recording") recorder.stop();
      return;
    }
    if (!options.autoStopSilence) return;
    analyser.getByteTimeDomainData(samples);
    const power = samples.reduce((sum, value) => {
      const normalized = (value - 128) / 128;
      return sum + normalized * normalized;
    }, 0) / samples.length;
    const speaking = Math.sqrt(power) > 0.035;
    if (speaking) {
      sawSpeech = true;
      silenceStarted = 0;
    } else if (sawSpeech && !silenceStarted) {
      silenceStarted = Date.now();
    } else if (sawSpeech && Date.now() - silenceStarted > (options.silenceMs ?? 1100)) {
      if (recorder.state === "recording") recorder.stop();
    } else if (!sawSpeech && elapsed > (options.noSpeechMs ?? 12_000)) {
      cancelled = true;
      if (recorder.state === "recording") recorder.stop();
    }
  }, 100);
  return {
    done,
    stop: async () => {
      if (recorder.state === "recording") recorder.stop();
      return done;
    },
    cancel: () => {
      cancelled = true;
      if (recorder.state === "recording") recorder.stop();
    },
  };
}

function plainSpeechText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#>`]/g, "")
    .replace(/\n{2,}/g, ". ");
}

export function speak(text: string): Promise<void> {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(plainSpeechText(text));
  const voices = window.speechSynthesis.getVoices();
  utterance.voice =
    voices.find((voice) => voice.lang === "en-GB") ??
    voices.find((voice) => voice.lang.startsWith("en")) ??
    voices[0] ??
    null;
  utterance.rate = 1.02;
  utterance.pitch = 0.96;
  return new Promise((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
