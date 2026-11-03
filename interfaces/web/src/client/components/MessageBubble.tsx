import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../types.js";
import { MentorAvatar } from "./MentorAvatar.js";

interface MessageBubbleProps {
  message: ChatMessage;
  showVerification?: boolean;
  onVerify?: () => void;
}

export function MessageBubble({
  message,
  showVerification = false,
  onVerify,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const money = (price: number, currency: string) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(price);
  const cadence = (period: string, interval: number) =>
    interval > 1 ? `${interval} ${period}s` : period;
  return (
    <article className={`message ${isUser ? "message-user" : "message-assistant"}`}>
      {!isUser ? (
        <MentorAvatar size="message" />
      ) : null}
      <div className="message-body">
        <span className="message-author">{isUser ? "You" : "Jason Sen AI Mentor"}</span>
        {message.imageUrl ? (
          <img
            className="message-image"
            src={message.imageUrl}
            alt="Uploaded trading chart"
          />
        ) : null}
        <div className="message-text">
          <ReactMarkdown>{message.text}</ReactMarkdown>
        </div>
        {message.plans?.length ? (
          <div className="plan-links" aria-label="Available membership plans">
            {message.plans.map((plan) => (
              <a
                key={plan.productId}
                href={plan.purchaseUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <strong>{plan.name}</strong>
                  <small>
                    {money(plan.price, plan.currency)} / {cadence(plan.billingPeriod, plan.billingInterval)}
                  </small>
                </span>
                <b>View plan ↗</b>
              </a>
            ))}
          </div>
        ) : null}
        {showVerification ? (
          <div className="verify-prompt">
            <span>Already subscribed? Verify your subscription to continue.</span>
            <button type="button" onClick={onVerify}>Verify subscription</button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
