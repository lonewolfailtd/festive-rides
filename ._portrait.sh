#!/usr/bin/env bash
set -uo pipefail
IN="public/surprise/flight/scenes"
OUT="public/surprise/flight/video/clips"
SUF="Faces and character designs stay exactly as in the image, calm gentle storybook motion, no camera shake, no morphing."
declare -A M
M[cover]="Gentle dreamy storybook motion, slow subtle push-in. The fantail's wings beat softly; the baby girl's hair ruffles gently in the breeze as she smiles; tail feathers sway; golden sparkles drift upward; clouds drift slowly; sea shimmers."
M[1A]="Gentle slow push-in toward the window. The fantail flutters its fanned tail and hops slightly on the sill; the baby girl blinks and reaches toward the bird with a happy wiggle; curtains sway softly; dust motes drift in the dawn sunbeam."
M[1B]="Slow gentle push-in. The green caterpillar munches the leaf with tiny chewing motions; the baby girl points and giggles, bouncing slightly; the fantail tilts its head; leaves flutter in dappled light."
M[1C]="Gentle orbit drift. The baby girl holds out the strawberry; the caterpillar wiggles happily; the fantail flaps its wings hovering; sunrise sparkles drift; soft warm glow."
M[2A]="Camera glides forward following the flight. The fantail's wings beat steadily carrying the baby girl, her hair ruffling in the wind; the turquoise lagoon shimmers below; clouds drift slowly."
M[2B]="Slow push-in toward the boat. The sparkly blue fish swims a gentle loop under the clear water, scales glinting; the baby girl waves down at it; light ripples dance."
M[2C]="Gentle push-in. The glittering rainbow scale drifts sparkling into the baby girl's open hands; the blue fish bobs at the surface, fins waving; water glitters; sparkles drift."
M[3A]="Camera glides forward over the waves. The fantail flies steadily carrying the baby girl holding the glass jar; dolphins arc gently in the sparkling sea; the green island grows closer."
M[3B]="Slow upward tilt along the trail. The group walks happily up the jungle path; the gecko scampers; the crab carries the jar; the tern flutters; ferns sway gently."
M[3C]="Gentle push-in then slight rise. The cocoon bursts softly and the emerald-teal butterfly unfurls its koru wings fluttering upward; the baby girl claps in delight; golden sparkles drift over the sea."
M[4A]="Slow settle-down motion. The group lands softly on the muddy track; the butterfly flutters down last; the baby girl steadies with a happy bounce; jar water sloshes; grass sways."
M[4B]="Gentle push-in. The little calf wriggles in the mud, ears flicking, worried then hopeful; the five dogs trot forward eagerly, tails wagging; the baby girl watches; the fantail flutters."
M[4C]="Lively smooth motion. Everyone leans back pulling the rope and the SINGLE calf rises up out of the mud (exactly one calf, no new animals); mud droplets splatter playfully; tails wag; the baby girl laughs."
M[5A]="Slow gentle push-in. The fluffy kiwi blinks warmly from the ferns; the baby girl steps forward with a delighted bounce; the fantail flutters to her shoulder; red pohutukawa blossoms sway."
M[5B]="Gentle push-in toward the stream. The little blue fish leaps from the tipped jar with a soft splash and wiggles happily; ripples sparkle; tails wag; the butterfly flutters."
M[5C]="Very slow tender push-in. The whole group cuddles closer around the baby girl; the candle flame flickers warmly; tails wag slowly; golden sunset light shimmers; sparkles drift upward."
for ID in 3B 3C 4A 4B 4C 5A 5B 5C; do
  src="$IN/$ID-portrait.jpg"
  if genvid --image "$src" --prompt "${M[$ID]} $SUF" --aspect 9:16 --duration 6 --out "$OUT/$ID-portrait.mp4" >/dev/null 2>&1; then
    echo "ok   $ID-portrait"
  else
    echo "FAIL $ID-portrait"
  fi
done
echo "PORTRAIT BATCH DONE"
