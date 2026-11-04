# Voice output

Jason Sen voice notes use Chatterbox text-to-speech behind an adapter at
`backend/src/adapters/audio/chatterbox-speech.ts`. The domain exposes only a
`SpeechProvider` port, so Telegram, web, and future interfaces do not import
Chatterbox-specific code.

## Data flow

1. An active subscriber sends a voice note or explicitly asks for a spoken reply.
2. The interface transcribes voice input or runs the text question through the
   normal mentor pipeline, then receives the grounded text answer.
3. The interface calls the authenticated `/v1/internal/speech` service route.
4. The Chatterbox adapter authenticates, submits the answer to `POST /tts` with
   the configured Jason clone, and returns Ogg/Opus bytes.
5. Telegram sends the bytes with `sendVoice`; the web client displays an audio
   player on the assistant message.

If speech generation fails, both interfaces retain the text answer. A provider
failure must not discard or replace deterministic trading guidance.

## Configuration

The studio voice can be selected by its display name or API filename. The
current clone is displayed as `Jason Sen 01`; the adapter resolves its stored
filename automatically.

```dotenv
VOICE_OUTPUT_PROVIDER=chatterbox
CHATTERBOX_BASE_URL=https://voiceclone.altoret.com
CHATTERBOX_PASSCODE=
CHATTERBOX_VOICE_MODE=clone
CHATTERBOX_VOICE_ID="Jason Sen 01"
CHATTERBOX_TTS_TIMEOUT_MS=120000
CHATTERBOX_TTS_COST_PER_1K_CHARS=0
```

Set `CHATTERBOX_PASSCODE` in the backend deployment secret store. Never commit
the studio passcode or a copied session cookie. A private deployment can use
`CHATTERBOX_SESSION_COOKIE` instead if it rotates the cookie operationally.

The adapter logs in through the protected studio once and reuses the session.
It retries authentication once after a `401` or `403`, then reports
`voice_output_unavailable`. Audio bytes are returned to the interface and are
not written to application storage.

## Limits and cost

- Speech input is capped at 5,000 characters; longer answers fall back to text.
- Estimated output duration counts against the daily voice-seconds limit.
- `CHATTERBOX_TTS_COST_PER_1K_CHARS` defaults to `0` because the current
  Chatterbox server runs on local CPU. Infrastructure cost should still be
  reflected in the operating budget.
- Chatterbox Studio is currently CPU-based. Keep generated replies short and
  test concurrent load before enabling voice output for all subscribers.

## Verification

Unit tests cover authentication, Jason clone selection, binary audio parsing,
Telegram uploads, web response shaping, and text fallback. A live generated
voice note still requires the studio passcode in the deployment environment;
run one Telegram voice-message round trip after enabling the provider.
