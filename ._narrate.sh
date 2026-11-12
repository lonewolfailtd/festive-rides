#!/usr/bin/env bash
# English-only narration per book-1 rules: spoken "Junie" for June, no Maori,
# no em dashes. Subtitles come from story.ts.
set -euo pipefail
run(){ local id="$1"; shift; bash ._tts.sh "$id" <<< "$1"; }

run 1A 'Tap, tap, tap! The sun peeks through,
a little bird has come for you!
"Happy birthday, Junie, my dear!
Your friends are waiting, far from here!"'

run 1B 'Munch, munch, munch! What'"'"'s that sound?
A caterpillar, green and round!
One apple, two plums, three pears more,
"I'"'"'m still hungry! More, more, more!"'

run 1C 'Junie shares her juicy strawberry, yum!
"Thank you, friend! Yum, yum, yum!"
He spins himself a sleepy bed,
and off they fly, straight ahead!'

run 2A 'Fly, fly, over the blue,
the sea below, the sky so new!
Down they swoop to a warm little bay,
Hawaii! What a place to play!'

run 2B 'Splish, splash! Who swims alone?
A sparkly fish with no friends of her own.
Junie waves and calls: "Come play with me!"
The fish lights up, so happy, whee!'

run 2C '"Here'"'"'s my sparkle, just for you,
a birthday gift, all shiny and new!"
They scoop her up in a jar of sea,
"Now we'"'"'re friends! Come home with me!"'

run 3A 'Fly, fly, friends side by side,
over the waves where dolphins glide!
A green, green island, tall and steep,
"Let'"'"'s climb the mountain! Up we creep!"'

run 3B 'Up, up, up the mountain track,
new friends following at the back!
A gecko, a crab, a bird so white,
holding hands and holding tight!'

run 3C 'POP! The sleepy bed bursts wide,
a butterfly comes out to glide!
And from the top, what do they see?
"New Zealand! Across the sea!"'

run 4A 'Fly, fly, nearly there!
Green, green hills and salty air.
Down they land on a muddy track,
"Welcome home! Welcome back!"'

run 4B 'Stuck, stuck, stuck in the goo,
a little calf! What to do?
Here come doggies, one, two, three,
four and five, a family!'

run 4C 'Tug, tug, TUG! One, two, three!
Pulling together, a family!
POP! goes the calf! SPLAT! goes the mud!
Muddy kisses, splud, splud, splud!'

run 5A 'Fly, fly, one last mile,
down a driveway, single file!
Under a tree with flowers red,
a little kiwi pops up her head!'

run 5B '"Welcome home! Welcome, dear!
All your family'"'"'s gathered here!"
SPLASH! The fish swims in the stream,
home at last, just like a dream!'

run 5C 'They plant a little birthday tree,
to grow up tall, just like she!
One small candle, shining bright,
"We love you, Junie! Goodnight!"'

echo "NARRATION COMPLETE"
