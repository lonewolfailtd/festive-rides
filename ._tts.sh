#!/usr/bin/env bash
# ElevenLabs TTS with word timestamps. Usage: ._tts.sh <id> <<< "text"
set -euo pipefail
ID="$1"
OUT="public/surprise/flight/audio"
VOICE="pcKdPWtbF6bM9o7NHjCI"
KEY="$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('ELEVENLABS_API_KEY','User')" | tr -d '\r\n')"
[ -n "$KEY" ] || { echo "no key" >&2; exit 1; }
mkdir -p "$OUT"
TEXT="$(cat)"
REQ="$(mktemp)"; RESP="$(mktemp)"
trap 'rm -f "$REQ" "$RESP"' EXIT
jq -n --arg t "$TEXT" '{
  text: $t,
  model_id: "eleven_multilingual_v2",
  voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true }
}' > "$REQ"
curl -fsS "https://api.elevenlabs.io/v1/text-to-speech/$VOICE/with-timestamps?output_format=mp3_44100_128" \
  -H "xi-api-key: $KEY" -H "Content-Type: application/json" --data-binary @"$REQ" > "$RESP"
jq -r '.audio_base64' "$RESP" | base64 -di > "$OUT/$ID.mp3"
jq '{alignment: .alignment}' "$RESP" > "$OUT/$ID.json"
echo "saved $OUT/$ID.mp3 ($(( $(wc -c < "$OUT/$ID.mp3")/1024 )) KB) + $ID.json"
