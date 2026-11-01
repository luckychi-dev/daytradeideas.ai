# Voice input

## Current scope

Telegram voice notes are accepted through Telegram's **Send Voice** button. The
web interface accepts browser recordings next to the send control. Both adapters
enforce a six-minute and 6 MB limit and upload audio through the authenticated
service API.

The backend transcribes the recording with xAI
`grok-voice-transcribe-2.0`, stores only the resulting transcript in
conversation history, and sends that transcript through the same mentor
pipeline as typed text. The bot currently replies with text and shows the
transcript so the subscriber can verify what was heard.

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

## ElevenLabs

ElevenLabs will be used later for natural voice output and conversational
agents. Its Custom LLM feature can call our OpenAI-compatible backend endpoint,
so the mentor logic remains ours and the voice layer can be replaced.

ElevenLabs also offers OpenAI Realtime protocol compatibility. That is the
preferred route for a later web/mobile live-call interface, not for Telegram
voice messages.

For speech output, xAI lists text-to-speech at `$15 / 1M characters`
(`$0.015 / 1K`) while ElevenLabs lists multilingual TTS at `$0.08 / 1K`
characters and Flash/Turbo at `$0.04 / 1K`. ElevenLabs therefore costs more for
audio output, but its voice quality and OpenAI Realtime-compatible call path are
the reason to use it for the later conversational interface. Voice cost will be
metered separately from the xAI transcription cost.

## Browser calls

Active web subscribers have a hands-free call control. The browser records one
spoken turn, stops after detected silence, transcribes it through xAI, sends the
transcript through Jason's normal knowledge-backed mentor pipeline, and speaks
the answer using the browser voice before listening again. Audio is released
after each turn and is not persisted.

This is a chained voice workflow rather than a full-duplex WebRTC session.
ElevenLabs or a realtime speech model can replace the browser voice layer later
without changing the mentor, quota or knowledge boundaries.

## Next limits

- Run the Telegram `.oga` delivery path end to end after public webhook deployment.
- Evaluate transcription quality on real subscriber recordings and Day Trade
  Ideas terminology.
- Evaluate a premium low-latency voice-output provider for full-duplex calls.

Per-subscriber daily voice limits, duration-based cost accounting, and the usage
ledger are implemented.
