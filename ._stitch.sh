#!/usr/bin/env bash
# Stitch the 15 scene clips (1A→5C) into one film with 0.3s crossfades.
set -euo pipefail
DIR="public/surprise/flight/video/clips"
OUT="public/surprise/flight/video/the-fantail-who-flew-her-home-silent.mp4"
IDS=(1A 1B 1C 2A 2B 2C 3A 3B 3C 4A 4B 4C 5A 5B 5C)
FADE=0.3

INPUTS=(); DUR=()
for id in "${IDS[@]}"; do
  INPUTS+=(-i "$DIR/$id.mp4")
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$DIR/$id.mp4")
  DUR+=("$d")
done

# Build xfade chain: normalize each input to 24fps/1920x1088 first.
FILTER=""
for i in "${!IDS[@]}"; do
  FILTER+="[$i:v]fps=24,scale=1920:1088,format=yuv420p,settb=AVTB[v$i];"
done
prev="v0"; offset=0
for i in $(seq 1 $((${#IDS[@]}-1))); do
  offset=$(python3 -c "print(round($offset + ${DUR[$((i-1))]} - $FADE, 4))" 2>/dev/null || awk "BEGIN{printf \"%.4f\", $offset + ${DUR[$((i-1))]} - $FADE}")
  out="x$i"
  FILTER+="[$prev][v$i]xfade=transition=fade:duration=$FADE:offset=$offset[$out];"
  prev="$out"
done
FILTER="${FILTER%;}"

ffmpeg -y -v error "${INPUTS[@]}" -filter_complex "$FILTER" -map "[$prev]" \
  -c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p -movflags +faststart "$OUT"
echo "STITCHED: $OUT"
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$OUT"
