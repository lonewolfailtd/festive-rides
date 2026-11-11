#!/usr/bin/env bash
# Nano Banana Pro generator with 0+ LOCAL reference images.
# Big base64 refs stay out of argv (read from files via jq); body sent from file.
# Usage: ._gen.sh --output out.jpg --prompt "..." [--ref img1] [--ref img2] ...
set -euo pipefail
PROMPT=""; OUTPUT=""; MODEL_ID="google/gemini-3-pro-image-preview"; REFS=()
while [[ $# -gt 0 ]]; do case "$1" in
  --prompt) PROMPT="$2"; shift 2;;
  --output) OUTPUT="$2"; shift 2;;
  --ref)    REFS+=("$2"); shift 2;;
  *) echo "unknown arg: $1" >&2; exit 2;;
esac; done
: "${OPENROUTER_API_KEY:?set OPENROUTER_API_KEY}"
mkdir -p "$(dirname "$OUTPUT")"
CONTENT="$(mktemp)"; URI="$(mktemp)"; REQ="$(mktemp)"
trap 'rm -f "$CONTENT" "$URI" "$REQ"' EXIT
jq -n --arg p "$PROMPT" '[{type:"text",text:$p}]' > "$CONTENT"
for r in "${REFS[@]:-}"; do
  [[ -z "$r" ]] && continue
  printf 'data:image/jpeg;base64,' > "$URI"; base64 -w0 "$r" >> "$URI"
  jq --rawfile u "$URI" '. + [{type:"image_url", image_url:{url:$u}}]' "$CONTENT" > "$CONTENT.n"
  mv "$CONTENT.n" "$CONTENT"
done
jq -n --arg m "$MODEL_ID" --slurpfile c "$CONTENT" \
  '{model:$m, modalities:["image","text"], messages:[{role:"user", content:$c[0]}]}' > "$REQ"
RESP="$(curl -fsS https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" -H "Content-Type: application/json" \
  -H "HTTP-Referer: https://anthropic.com/claude-code" --data-binary @"$REQ")"
IMG="$(jq -r '(.choices[0].message.images[]?|(.image_url.url//.url)),(.choices[0].message.content[]?|select(.type=="image_url")|.image_url.url)' <<<"$RESP" | head -1)"
if [[ -z "$IMG" || "$IMG" == null ]]; then echo "ERROR: no image" >&2; echo "$RESP" | jq -c '.choices[0].message // .error' | head -c 600 >&2; exit 1; fi
if [[ "$IMG" == data:* ]]; then echo "${IMG#*,}" | base64 -d > "$OUTPUT"; else curl -fsSL "$IMG" -o "$OUTPUT"; fi
echo "saved $OUTPUT ($(( $(wc -c < "$OUTPUT")/1024 )) KB)"
