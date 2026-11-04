# Voice input

## Current scope

Telegram voice notes are accepted through Telegram's **Send Voice** button. The
web interface accepts browser recordings next to the send control. Both adapters
enforce a six-minute and 6 MB limit and upload audio through the authenticated
service API.

The backend transcribes the recording with xAI
`grok-voice-transcribe-2.0`, stores only the resulting transcript in
conversation history, and sends that transcript through the same mentor
pipeline as typed text. When Chatterbox output is enabled, Telegram returns the
answer as a Jason Sen voice note and the web shows the transcript beside an
audio player. If voice output is unavailable, the transcript and answer fall
back to text.

Telegram subscribers can also ask for spoken delivery in a normal text message,
for example "send me a voice message" or "reply by voice." Ordinary trading
questions remain text unless the subscriber explicitly requests audio.

Audio files are not persisted by the application.

Live xAI transcription has been verified through the web adapter with generated
English trading audio. The provider accepts Telegram Ogg/Opus recordings and
browser WebM, MP4 and WAV containers. The Telegram webhook-level test remains
pending public HTTPS deployment.

## Configuration

```env
VOICE_TRANSCRIPTION_PROVIDER=xai
XAI_API_KEY=
XAI_BASE_URL=https://api.x.ai/v1
XAI_TRANSCRIBE_MODEL=grok-voice-transcribe-2.0

# Optional fallback provider
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

If the selected provider's API key is absent, text chat continues to work and
voice notes return a configuration message.

At the time this comparison was made:

- xAI Grok speech-to-text: `$0.10/hour`
- OpenAI `gpt-4o-mini-transcribe`: `$0.003/minute`
- ElevenLabs Scribe v2: `$0.22/hour`

xAI is the cheapest for the current Telegram voice-note workload.

## Voice output

Jason replies use the private Chatterbox Studio clone `Jason Sen 01` through a
`SpeechProvider` adapter. See `docs/VOICE_OUTPUT.md` for authentication,
provider limits, and deployment configuration.

## Browser calls

The full-duplex browser call control remains unavailable. Voice-note replies are
the supported speech-output path while Chatterbox is CPU-hosted and while
latency and concurrency are still being evaluated.

## Next limits

- Run the Telegram `.oga` delivery path end to end after public webhook deployment.
- Evaluate transcription quality on real subscriber recordings and Day Trade
  Ideas terminology.
- Evaluate Chatterbox latency and concurrency before enabling full-duplex calls.

Per-subscriber daily voice limits, duration-based cost accounting, and the usage
ledger are implemented.
