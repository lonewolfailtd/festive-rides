# Renders ambient Pro clips for every story scene (both orientations).
# Motion prompts are gentle/ambient so the video model only adds life —
# it cannot change the locked characters in the stills.
$ErrorActionPreference = "Continue"
Set-Location C:\Users\Hodgs\festive-rides
New-Item -ItemType Directory -Force public\surprise\video | Out-Null

$jobs = @(
  @{ n="02-born";      p="The newborn baby's chest rises and falls gently as she sleeps, the blanket moves softly with her breathing, moonlight through the window shimmers subtly, tiny dust motes drift in the moonbeam. Camera locked off, very subtle." },
  @{ n="03-facetime";  p="The family wave happily at the laptop, the baby on the screen waves back and wiggles, the screen glows softly, warm lamplight flickers gently. Subtle natural motion, camera locked off." },
  @{ n="04-daycare";   p="The baby giggles and bounces gently while sitting, reaching for the blocks, a soft toy wobbles, sunlight through the window shifts softly. Subtle joyful motion, camera locked off." },
  @{ n="05-flight";    p="Clouds stream slowly past the airplane window, the baby snuggles and wiggles slightly in her mother's arms, soft cabin light, the parents smile and blink naturally. Camera locked off, gentle." },
  @{ n="06-v2-lounge"; p="The family laugh and sway gently with joy, the baby in the centre wiggles her arms happily, warm golden light flickers softly, natural subtle movement of everyone. Camera locked off." },
  @{ n="07-christmas"; p="Wrapping paper flutters and a ribbon drifts, the baby tears the paper and giggles, the adults laugh gently, leaves of the pohutukawa sway softly in the summer breeze. Camera locked off." },
  @{ n="07-bath";      p="Water ripples and sparkles in the sink, the baby splashes with her hands sending small droplets up, the three little toy fish bob and wiggle on the water, bubbles drift. Joyful gentle motion, camera locked off." },
  @{ n="08-v3-tomarata"; p="Grass sways gently in the golden breeze, the baby crawls forward slightly on the rug, the man comically chews with full cheeks, the others laugh naturally, tea steam rises from the cup. Camera locked off." },
  @{ n="09-beach";     p="Small waves roll in and foam around the baby's feet making her giggle and kick gently, the family laugh naturally, pohutukawa branches sway softly, sunlight sparkles on the sea. Camera locked off." },
  @{ n="10-v2-airport"; p="The family hold their warm group hug swaying gently, the grandmother kisses the baby's head, soft morning light, the plane waits outside the window. Tender subtle motion, camera locked off." }
)

foreach ($j in $jobs) {
  foreach ($o in @(@{suf="portrait"; asp="9:16"}, @{suf="wide"; asp="16:9"})) {
    $img = "C:\Users\Hodgs\festive-rides\public\surprise\scenes\$($j.n)-$($o.suf).jpg"
    $out = "public\surprise\video\$($j.n)-$($o.suf).mp4"
    if (Test-Path $out) { Write-Output "SKIP $out (exists)"; continue }
    if (-not (Test-Path $img)) { Write-Output "MISSING STILL $img"; continue }
    Write-Output "=== RENDER $($j.n) $($o.suf) ==="
    genvid --image $img --prompt $j.p --aspect $o.asp --duration 6 --out $out
  }
}
Write-Output "=== ALL SCENE CLIPS DONE ==="
Get-ChildItem public\surprise\video | Select-Object Name, Length
