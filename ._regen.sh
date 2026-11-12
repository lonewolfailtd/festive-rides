#!/usr/bin/env bash
set -uo pipefail
OUT="public/surprise/flight/scenes"
J="public/surprise/characters/june-master.jpg"
FISH="public/surprise/flight/characters/fish-master.jpg"
DOGS="public/surprise/flight/characters/dogs-master.jpg"
CALF="public/surprise/flight/characters/calf-master.jpg"
BFLY="public/surprise/flight/characters/butterfly-master.jpg"
PRE="Soft glossy Pixar-style 3D animated storybook scene, big expressive eyes, subsurface skin, warm cinematic soft light, wholesome and magical, te-ao-Maori warmth, no text, no logos. "
JUNE="The baby girl is June from the FIRST reference image — keep her FACE, FEATURES and HAIR IDENTICAL (short brown hair, big brown eyes, rosy cheeks), blue outfit, joyful. "
FT="A tiny New Zealand fantail (piwakawaka): charcoal-brown head, cream-yellow chest, white eyebrow stripe, long black-and-white fanned tail, glossy black eyes. "
NOTE="Match each animal character to its reference image exactly. "

gen(){ local id="$1" ori="$2" body="$3"; shift 3; local rflags=(); for r in "$@"; do rflags+=(--ref "$r"); done
  local ar; if [ "$ori" = portrait ]; then ar="Aspect ratio: 9:16 tall vertical portrait."; else ar="Aspect ratio: 16:9 widescreen landscape."; fi
  if bash ._gen.sh --output "$OUT/$id-$ori.jpg" "${rflags[@]}" --prompt "${PRE}${JUNE}${FT}${NOTE}${body} ${ar}" >/dev/null 2>&1; then echo "ok $id-$ori"; else echo "FAIL $id-$ori"; fi; }

B2B="Scene: a sunny turquoise lagoon; just under the clear surface swims a lonely beautiful Rainbow Fish (soft light-blue body, flowing fins, scattered SHIMMERING IRIDESCENT SILVER rainbow scales, orange lips) matching the fish reference; above the water June leans from a little boat waving warmly down at the fish; the fantail beside her; coral, dappled light."
B2C="Scene: warm lagoon shallows; the Rainbow Fish (light-blue, flowing fins, shimmering silver rainbow scales, orange lips) gives its brightest glittering scale, glowing as it drifts up into June's open hands; a round clear glass jar of seawater with a cork lid and rope handle beside them; fantail nearby; tender, sparkles."
B4A="Scene: green rolling Northland hills and a muddy farm track; June and her air crew touch down — the fantail, the emerald-and-teal koru-winged butterfly (match reference), a round glass jar of seawater holding the little Rainbow Fish, a small green gecko with turquoise spots, an orange-red coconut crab, and a white tern with a black eye-mask gathered close behind her; warm welcoming light."
B4B="Scene: a muddy Northland paddock; a cute wobbly baby calf with a soft brown-and-white coat (match the calf reference) is stuck up to its tummy in thick brown mud, looking worried and going 'moo'; trotting up to help comes the pack of FIVE dogs (match the dogs reference: small scruffy black terrier leader, huge brown mastiff, white dalmatian with spots, shaggy grey mop-like sheepdog, low long dachshund); June and the fantail look on; lively and fun."
B4C="Scene: joyful muddy teamwork — June, the fantail and the FIVE dogs (match the dogs reference) all pulling together on a rope as the cute brown-and-white baby calf (match the calf reference) POPS free of the mud; mud splattering playfully on noses and tails; big happy laughing energy, splats and sparkles."
B5B="Scene: warm homecoming by a clear farm stream; the little Rainbow Fish (match the fish reference) is released from its glass jar with a happy SPLASH into the stream; a round fluffy brown kiwi (long pale beak, plain head, no fern) gently welcomes June; her crew gathered close — fantail, emerald-teal koru butterfly (match reference), green gecko, orange coconut crab, white tern and the five dogs (match the dogs reference); golden, tender."
B5C="Scene: tender golden-hour finale at the farm; June and her whole whanau — fantail, emerald-teal koru butterfly (match reference), green gecko, coconut crab, white tern, the five dogs (match the dogs reference), and a fluffy brown kiwi (plain head, no fern) — together planting a tiny pohutukawa sapling with a red ribbon bow in fresh soil; a small birthday cake with one glowing candle nearby; everyone cuddled close in a warm group hug; soft magical sunset."

for ORI in portrait wide; do
  gen 2B "$ORI" "$B2B" "$J" "$FISH"
  gen 2C "$ORI" "$B2C" "$J" "$FISH"
  gen 4A "$ORI" "$B4A" "$J" "$BFLY"
  gen 4B "$ORI" "$B4B" "$J" "$CALF" "$DOGS"
  gen 4C "$ORI" "$B4C" "$J" "$CALF" "$DOGS"
  gen 5B "$ORI" "$B5B" "$J" "$FISH" "$DOGS" "$BFLY"
  gen 5C "$ORI" "$B5C" "$J" "$DOGS" "$BFLY"
done
echo "REGEN COMPLETE"
