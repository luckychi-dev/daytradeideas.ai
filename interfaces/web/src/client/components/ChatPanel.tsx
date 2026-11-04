import { useEffect, useRef, useState } from "react";
import { sendImage, sendMessage, sendVoice, WebApiError } from "../api.js";
import type { PreparedImage, RecordedAudio } from "../media.js";
import type { ChatMessage } from "../types.js";
import { Composer } from "./Composer.js";
import { MentorAvatar } from "./MentorAvatar.js";
import { MessageBubble } from "./MessageBubble.js";

interface ChatPanelProps {
  verificationRequired: boolean;
  canUseMedia: boolean;
  initialMessages?: ChatMessage[];
  onAuthenticationRequired(): void;
}

function chatError(error: unknown): string {
  if (!(error instanceof WebApiError)) return "I couldn’t connect right now. Please try again.";
  if (error.code === "daily_message_limit_reached") return "You’ve reached today’s message limit.";
  if (error.code === "monthly_budget_reached") return "The mentor has reached its service budget.";
  if (error.code === "request_in_progress") return "The previous answer is still being prepared.";
  if (error.code === "subscriber_not_allowed") return "Your subscription needs to be verified again.";
  if (error.code === "vision_unavailable") return "Chart reading is not configured yet.";
  if (error.code === "image_too_large") return "That image is too large. Please choose a smaller one.";
  if (error.code === "voice_transcription_unavailable") return "Voice notes are not configured yet.";
  if (error.code === "voice_too_large") return "That voice note is too long or too large.";
  return "I couldn’t complete that answer safely. Please try again.";
}

export function ChatPanel({
  verificationRequired,
  canUseMedia,
  initialMessages = [],
  onAuthenticationRequired,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const audioUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => () => {
    audioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function handleError(caught: unknown) {
    if (caught instanceof WebApiError && caught.code === "subscriber_not_allowed") {
      onAuthenticationRequired();
    }
    setError(chatError(caught));
  }

  function appendReply(request: string, response: {
    text: string;
    sources: ChatMessage["sources"];
    plans?: ChatMessage["plans"];
  }) {
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${request}`,
        role: "assistant",
        text: response.text,
        sources: response.sources ?? [],
        ...(response.plans ? { plans: response.plans } : {}),
      },
    ]);
  }

  async function submitText(question: string) {
    if (sending) return;
    const request = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: `user-${request}`, role: "user", text: question },
    ]);
    setSending(true);
    setError("");
    try {
      appendReply(request, await sendMessage(question));
    } catch (caught) {
      handleError(caught);
    } finally {
      setSending(false);
    }
  }

  async function submitImage(image: PreparedImage, text: string) {
    if (sending) return;
    const request = crypto.randomUUID();
    const question = text || "Review this trading chart.";
    setMessages((current) => [
      ...current,
      {
        id: `user-${request}`,
        role: "user",
        text: question,
        imageUrl: image.dataUrl,
      },
    ]);
    setSending(true);
    setError("");
    try {
      appendReply(request, await sendImage(image, question));
    } catch (caught) {
      handleError(caught);
    } finally {
      setSending(false);
    }
  }

  async function processVoice(audio: RecordedAudio) {
    const request = crypto.randomUUID();
    setSending(true);
    setError("");
    try {
      const response = await sendVoice(audio);
      const audioUrl = URL.createObjectURL(audio.blob);
      audioUrlsRef.current.push(audioUrl);
      setMessages((current) => [
        ...current,
        {
          id: `user-${request}`,
          role: "user",
          text: response.transcript,
          audioUrl,
        },
        {
          id: `assistant-${request}`,
          role: "assistant",
          text: response.text,
          sources: response.sources,
          ...(response.voiceNote
            ? {
                audioUrl:
                  `data:${response.voiceNote.mimeType};base64,${response.voiceNote.audioBase64}`,
              }
            : {}),
        },
      ]);
      return response;
    } catch (caught) {
      handleError(caught);
      throw caught;
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-panel">
      <div className={`message-list ${messages.length === 0 ? "message-list-empty" : ""}`} aria-live="polite">
        {messages.length === 0 ? (
          <section className="empty-state">
            <MentorAvatar size="large" />
            <h1>Jason Sen AI Mentor</h1>
            <p>
              I can answer membership questions, explain the available plans and help
              with joining or account access. Trading mentorship requires an active
              subscription.
            </p>
          </section>
        ) : messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            showVerification={verificationRequired && message.role === "assistant"}
            onVerify={onAuthenticationRequired}
          />
        ))}
        {sending ? (
          <div className="thinking" aria-label="AI mentor is thinking">
            <span /><span /><span />
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? <p className="chat-error" role="alert">{error}</p> : null}
      <Composer
        canUseMedia={canUseMedia}
        disabled={sending}
        onSendText={submitText}
        onSendImage={submitImage}
        onSendVoice={async (audio) => { await processVoice(audio); }}
      />
      <p className="composer-note">Educational guidance only. No trade execution.</p>
    </div>
  );
}
