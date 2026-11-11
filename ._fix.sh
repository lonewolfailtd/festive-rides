#!/usr/bin/env bash
set -uo pipefail
REF="public/surprise/characters/june-master.jpg"
OUT="public/surprise/flight/scenes"
PRE="Soft glossy Pixar-style 3D animated storybook scene, big expressive eyes, subsurface skin, warm cinematic soft light, wholesome and magical, te-ao-Maori warmth, no text, no logos. "
JUNE="The baby girl is June FROM THE REFERENCE IMAGE — keep her FACE, FACIAL FEATURES and HAIR IDENTICAL to the reference (short brown hair, big brown eyes, chubby rosy cheeks); do NOT change her face or hair; she wears a cosy blue outfit; joyful expression. "
FT="A tiny round New Zealand fantail bird (piwakawaka) is with her: charcoal-brown head, cream-yellow chest, white eyebrow stripe, long black-and-white tail fanned like a hand, big glossy black eyes, cheerful. "

declare -A BODY
BODY[1B]="Scene: a sunny backyard orchard with apple, plum and pear trees (some fruit with little bite holes); June crouches on the green grass pointing with delight at a plump friendly caterpillar — bright green segmented body and a friendly GREEN rounded face with soft rosy cheeks (the face is GREEN, NOT red, no red head), big happy eyes, tiny feet — munching a leaf; the fantail perches on a low branch; dappled morning light."
BODY[5A]="Scene: golden hour down a long grassy farm driveway at Tomarata; a pohutukawa tree in bright red bloom; a round fluffy brown kiwi bird with shaggy streaked feathers, a long pale beak and warm gentle eyes — its head is PLAIN with NO leaf and NO fern on it — pops up from the green ferns to greet June and her arriving group of animal friends; soft warm light."
BODY[5B]="Scene: warm homecoming by a clear farm stream; the kiwi (round, fluffy brown, shaggy feathers, long pale beak, gentle eyes; PLAIN head with NO leaf and NO fern on it) gently welcomes June; the little rainbow fish (ocean-blue, violet fins, one rainbow scale) is released from its round glass jar with a happy SPLASH into the stream; June's crew — fantail, emerald-and-teal koru butterfly, small green gecko, orange-red coconut crab, white tern and the five dogs — gathered lovingly close around her; golden, tender."
BODY[5C]="Scene: a tender golden-hour finale at the Tomarata farm; June and her whole whanau of animal friends (fantail, emerald-and-teal koru butterfly, gecko, coconut crab, white tern, five dogs, and a round fluffy brown kiwi with a long pale beak whose head is PLAIN with NO leaf or fern on it) together planting a tiny pohutukawa sapling with a red ribbon bow in fresh soil; nearby a small birthday cake with one glowing candle; everyone cuddled close in a warm group hug; soft magical sunset light, deeply heartwarming."

for ID in 1B 5A 5B 5C; do
  for ORI in portrait wide; do
    if [ "$ORI" = "portrait" ]; then AR="Aspect ratio: 9:16 tall vertical portrait."; else AR="Aspect ratio: 16:9 widescreen landscape."; fi
    if bash ._gen.sh --ref "$REF" --output "$OUT/$ID-$ORI.jpg" --prompt "${PRE}${JUNE}${FT}${BODY[$ID]} ${AR}" >/dev/null 2>&1; then
      echo "ok   $ID-$ORI"; else echo "FAIL $ID-$ORI"; fi
  done
done
echo "FIX DONE"
