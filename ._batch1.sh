#!/usr/bin/env bash
set -euo pipefail
REF="public/surprise/characters/june-master.jpg"
OUT="public/surprise/flight/scenes"
PRE="Soft glossy Pixar-style 3D animated storybook scene, big expressive eyes, subsurface skin, warm cinematic soft light, wholesome and magical, te-ao-Maori warmth, no text, no logos. "
JUNE="The baby girl is June FROM THE REFERENCE IMAGE — keep her FACE, FACIAL FEATURES and HAIR IDENTICAL to the reference (short brown hair, big brown eyes, chubby rosy cheeks); do NOT change her face or hair; she wears a cosy blue outfit; joyful expression. "
FT="With her is a tiny round New Zealand fantail bird (piwakawaka): charcoal-brown head, cream-yellow chest, white eyebrow stripe, long black-and-white tail fanned like a hand, big glossy black eyes, cheerful. "

declare -A BODY
BODY[1A]="Scene: soft dawn light streaming into a cosy nursery bedroom; the fantail has just landed on the window sill with its tail fanned wide; baby June stands holding her wooden cot rail, reaching out with a delighted open-mouthed smile toward the little bird; gentle curtains, sunrise glow."
BODY[1B]="Scene: a sunny backyard orchard with apple, plum and pear trees (some fruit with little bite holes); June crouches on the green grass pointing with delight at a plump friendly caterpillar — bright green segmented body, rosy red rounded face, big happy eyes, tiny feet — munching a leaf; the fantail perches on a low branch; dappled morning light."
BODY[1C]="Scene: golden sunrise over the orchard; June happily offers a big red strawberry to the green caterpillar, who is curling into a small brown cocoon strapped to the fantail's back; the fantail spreads its wings to lift off into the warm sky; magical floating sparkles, tender joyful mood."

for ID in 1A 1B 1C; do
  for ORI in portrait wide; do
    if [ "$ORI" = "portrait" ]; then AR="Aspect ratio: 9:16 tall vertical portrait."; else AR="Aspect ratio: 16:9 widescreen landscape."; fi
    echo "=== $ID $ORI ==="
    bash ._gen.sh --ref "$REF" --output "$OUT/$ID-$ORI.jpg" \
      --prompt "${PRE}${JUNE}${FT}${BODY[$ID]} ${AR}" || echo "FAILED $ID $ORI"
  done
done
echo "BATCH1 DONE"
