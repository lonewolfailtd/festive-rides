#!/usr/bin/env bash
set -uo pipefail
REF="public/surprise/characters/june-master.jpg"
OUT="public/surprise/flight/scenes"
PRE="Soft glossy Pixar-style 3D animated storybook scene, big expressive eyes, subsurface skin, warm cinematic soft light, wholesome and magical, te-ao-Maori warmth, no text, no logos. "
JUNE="The baby girl is June FROM THE REFERENCE IMAGE — keep her FACE, FACIAL FEATURES and HAIR IDENTICAL to the reference (short brown hair, big brown eyes, chubby rosy cheeks); do NOT change her face or hair; she wears a cosy blue outfit; joyful expression. "
FT="A tiny round New Zealand fantail bird (piwakawaka) is with her: charcoal-brown head, cream-yellow chest, white eyebrow stripe, long black-and-white tail fanned like a hand, big glossy black eyes, cheerful. "
COCOON="On the fantail's back is a small soft SILKY BROWN COCOON, a teardrop chrysalis wrapped in fine fuzzy silk — it is NOT a snail shell, NOT a spiral, NOT a hard shell. "

declare -A BODY
BODY[2A]="Scene: a sweeping aerial view at golden light, June riding happily on the fantail's back as they swoop down from the sky toward a turquoise Hawaiian lagoon ringed with palm trees and white sand. ${COCOON}Wind in the feathers, sense of joyful flight, sparkles."
BODY[2B]="Scene: a sunny turquoise lagoon; just beneath the clear surface swims a lonely beautiful ocean-blue fish with soft violet flowing fins, pearly iridescent scales, one oversized glittering rainbow scale and long gentle lashes; above the water June leans from the fantail waving warmly down at the fish; coral and dappled light."
BODY[2C]="Scene: in the warm lagoon shallows, the ocean-blue fish (violet flowing fins, pearly scales, one oversized glittering rainbow scale, long lashes) gives its brightest rainbow scale, which drifts glowing up into June's open hands; beside them a round clear glass jar of seawater with a cork lid and rope handle ready to carry the fish; tender, magical, sparkles."
BODY[3A]="Scene: friends flying side by side over the open ocean toward a tall, steep, jungly green island rising from the sea; dolphins leap in the waves below; June rides the fantail, ${COCOON}and carries a round clear glass jar of seawater with a cork lid and rope handle holding the little rainbow fish; bright adventurous mood."
BODY[3B]="Scene: a lush jungle mountain trail climbing upward; June and the fantail lead a happy line of new friends holding on together — a small bright-green gecko with turquoise spots, an orange-red coconut crab with one oversized claw carrying the glass jar of seawater, and a white tern seabird with a black eye-mask; ${COCOON}dappled green light, sense of teamwork."
BODY[3C]="Scene: at the windy mountain summit, the small silky brown cocoon bursts open in mid-air and a friendly butterfly with large emerald-and-teal wings patterned with koru swirls and big happy eyes flutters out; June and the fantail watch in delight; far across the sparkling sea on the horizon lies the green coastline of Aotearoa New Zealand; triumphant, magical, golden light."
BODY[4A]="Scene: green rolling Northland hills and salty coastline; June and her group of animal friends come in to land on a muddy farm track — the fantail, the emerald-and-teal koru butterfly fluttering nearby, the glass jar with the rainbow fish, and the little gecko, coconut crab and white tern gathered close behind her; warm welcoming light."
BODY[4B]="Scene: a muddy rural Northland road; a small cheerful cartoon yellow excavator digger (tracks, bucket arm, friendly headlight eyes, mud freckles) is sunk and stuck in thick brown mud; trotting up to help comes a parade of five dogs — a small wiry scruffy black terrier leading, a huge gentle brown mastiff, a white dalmatian with black spots, a shaggy grey sheepdog like a walking mop, and a low long dachshund with a round tummy; June and the fantail look on; lively and fun."
BODY[4C]="Scene: joyful muddy teamwork — June, the fantail, the five dogs (scruffy black terrier, brown mastiff, spotted dalmatian, mop-like grey sheepdog, low dachshund) and friends all pulling together on a rope as the little yellow digger POPS free of the mud; mud splattering playfully on noses and tails; big happy laughing energy, splats and sparkles."
BODY[5A]="Scene: golden hour down a long grassy farm driveway at Tomarata; a pohutukawa tree in bright red bloom; a round fluffy brown kiwi bird with shaggy streaked feathers, a long pale beak, warm gentle eyes and a small fern leaf tucked behind her head pops her head up from the green ferns to greet June and her arriving group of animal friends; soft warm light."
BODY[5B]="Scene: warm homecoming by a clear farm stream; the kiwi (fluffy brown, long pale beak, fern leaf behind her head) gently welcomes June; the little rainbow fish is released from its glass jar with a happy SPLASH into the stream; June's whole crew — fantail, koru butterfly, gecko, coconut crab, white tern and the five dogs — gathered lovingly close around her; golden, tender."
BODY[5C]="Scene: a tender golden-hour finale at the Tomarata farm; June and her whole whanau of animal friends (fantail, koru butterfly, rainbow fish, gecko, crab, tern, five dogs, the kiwi) together planting a tiny pohutukawa sapling with a red ribbon bow in fresh soil; nearby a small birthday cake with one glowing candle; everyone cuddled close in a warm group hug; soft magical sunset light, deeply heartwarming."

IDS=(2A 2B 2C 3A 3B 3C 4A 4B 4C 5A 5B 5C)
MAX=3
for ID in "${IDS[@]}"; do
  for ORI in portrait wide; do
    if [ "$ORI" = "portrait" ]; then AR="Aspect ratio: 9:16 tall vertical portrait."; else AR="Aspect ratio: 16:9 widescreen landscape."; fi
    (
      if bash ._gen.sh --ref "$REF" --output "$OUT/$ID-$ORI.jpg" --prompt "${PRE}${JUNE}${FT}${BODY[$ID]} ${AR}" >/dev/null 2>&1; then
        echo "ok   $ID-$ORI"
      else
        echo "FAIL $ID-$ORI"
      fi
    ) &
    while [ "$(jobs -r | wc -l)" -ge "$MAX" ]; do wait -n; done
  done
done
wait
echo "BATCH2 COMPLETE"
