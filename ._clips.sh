#!/usr/bin/env bash
set -uo pipefail
IN="public/surprise/flight/scenes"
OUT="public/surprise/flight/video/clips"
mkdir -p "$OUT"
SUF="Faces and character designs stay exactly as in the image, calm gentle storybook motion, no camera shake, no morphing."

declare -A M
M[1B]="Slow gentle push-in. The green caterpillar munches the leaf with tiny chewing motions; the baby girl points and giggles, bouncing slightly; the fantail on the branch tilts its head; leaves flutter in dappled light."
M[1C]="Gentle orbit drift left. The baby girl holds out the strawberry; the caterpillar wiggles happily on the log; the fantail above flaps its wings in place hovering; sunrise sparkles drift; soft warm glow pulses."
M[2A]="Camera glides forward following the flight. The fantail's wings beat steadily as it soars with the baby girl on its back, her hair and clothes ruffling in the wind; the turquoise lagoon below shimmers; clouds drift past slowly."
M[2B]="Slow push-in toward the boat. The sparkly blue fish swims a gentle loop under the clear water, scales glinting; the baby girl waves down at it; the fantail hops on the boat edge; light ripples dance across the water."
M[2C]="Gentle push-in. The glittering rainbow scale drifts and sparkles as it floats up into the baby girl's open hands; the blue fish bobs at the surface, fins waving softly; water glitters; the fantail watches; magical sparkles drift."
M[3A]="Camera glides forward over the waves. The fantail flies steadily carrying the baby girl, who holds the glass jar; dolphins arc gently in and out of the sparkling sea below; the green island grows slowly closer; clouds drift."
M[3B]="Slow upward tilt following the trail. The little group walks happily up the jungle path; the gecko scampers a step; the crab carries the jar carefully sideways; the white tern flutters its wings; ferns and palm leaves sway gently."
M[3C]="Gentle push-in then slight rise. The cocoon bursts in a soft puff and the emerald-teal butterfly unfurls its koru wings and flutters upward; the baby girl claps in delight; the fantail hops; golden sparkles drift over the distant sea."
M[4A]="Slow settle-down motion. The group lands softly on the muddy track; the butterfly flutters down last; the baby girl steadies herself with a happy bounce; the jar water sloshes gently; grass sways in the coastal breeze."
M[4B]="Gentle push-in. The little calf wriggles in the mud, ears flicking, looking worried then hopeful; the five dogs trot forward eagerly, tails wagging; the baby girl watches with concern; the fantail flutters above."
M[4C]="Lively but smooth motion. Everyone leans back pulling the rope together; the calf pops free of the mud with a soft lurch; mud droplets splatter playfully; tails wag wildly; the baby girl laughs; sparkles burst."
M[5A]="Slow gentle push-in. The fluffy kiwi pops her head up from the ferns and blinks warmly; the baby girl steps forward with a delighted bounce; the fantail flutters to her shoulder; the red pohutukawa blossoms sway softly."
M[5B]="Gentle push-in toward the stream. The little blue fish leaps from the tipped jar with a soft splash into the stream and wiggles happily; water ripples sparkle; the kiwi nods warmly; the dogs' tails wag; the butterfly flutters."
M[5C]="Very slow tender push-in. The whole group cuddles closer around the baby girl; the candle flame flickers warmly; the butterfly settles on the sapling; tails wag slowly; golden sunset light shimmers; sparkles drift upward."

for ID in 1B 1C 2A 2B 2C 3A 3B 3C 4A 4B 4C 5A 5B 5C; do
  echo "=== $ID ==="
  genvid --image "$IN/$ID-wide.jpg" \
    --prompt "${M[$ID]} $SUF" \
    --aspect 16:9 --duration 6 \
    --out "$OUT/$ID.mp4" 2>&1 | tail -1
done
echo "CLIPS COMPLETE"
