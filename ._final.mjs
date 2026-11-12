// Final narrated film: retime each scene clip to its narration, add voice,
// build a global SRT from ElevenLabs alignments, concat, burn subtitles.
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const IDS = ['1A','1B','1C','2A','2B','2C','3A','3B','3C','4A','4B','4C','5A','5B','5C'];
// Subtitle text (macrons kept) — pairs [lines 1-2, lines 3-4] per frame.
const VERSE = {'1A':[["Tap, tap, tap! The sun peeks through,","a little bird has come for you!"],["“Happy birthday, June, my dear!","Your friends are waiting, far from here!”"]],'1B':[["Munch, munch, munch! What’s that sound?","A caterpillar, green and round!"],["One apple, two plums, three pears more,","“I’m still hungry! More, more, more!”"]],'1C':[["June shares her juicy strawberry, yum!","“Thank you, friend! Yum, yum, yum!”"],["He spins himself a sleepy bed,","and off they fly, straight ahead!"]],'2A':[["Fly, fly, over the blue,","the sea below, the sky so new!"],["Down they swoop to a warm little bay,","Hawaii! What a place to play!"]],'2B':[["Splish, splash! Who swims alone?","A sparkly fish with no friends of her own."],["June waves and calls: “Come play with me!”","The fish lights up, so happy, whee!"]],'2C':[["“Here’s my sparkle, just for you,","a birthday gift, all shiny and new!”"],["They scoop her up in a jar of sea,","“Now we’re friends! Come home with me!”"]],'3A':[["Fly, fly, friends side by side,","over the waves where dolphins glide!"],["A green, green island, tall and steep,","“Let’s climb the mountain! Up we creep!”"]],'3B':[["Up, up, up the mountain track,","new friends following at the back!"],["A gecko, a crab, a bird so white,","holding hands and holding tight!"]],'3C':[["POP! The sleepy bed bursts wide,","a butterfly comes out to glide!"],["And from the top, what do they see?","“NEW ZEALAND! Across the sea!”"]],'4A':[["Fly, fly, nearly there!","Green, green hills and salty air."],["Down they land on a muddy track,","“Welcome home! Welcome back!”"]],'4B':[["Stuck, stuck, stuck in the goo,","a little calf! What to do?"],["Here come doggies, one, two, three,","four and five, a family!"]],'4C':[["Tug, tug, TUG! One, two, three!","Pulling together, a family!"],["POP! goes the calf! SPLAT! goes the mud!","Muddy kisses, splud, splud, splud!"]],'5A':[["Fly, fly, one last mile,","down a driveway, single file!"],["Under a tree with flowers red,","a little kiwi pops up her head!"]],'5B':[["“Welcome home! Welcome, dear!","All your family’s gathered here!”"],["SPLASH! The fish swims in the stream,","home at last, just like a dream!"]],'5C':[["They plant a little birthday tree,","to grow up tall, just like she!"],["One small candle, shining bright,","“We love you, June! Goodnight!”"]]};

const A = 'public/surprise/flight/audio';
const C = 'public/surprise/flight/video/clips';
const SEG = 'public/surprise/flight/video/.segments';
mkdirSync(SEG, { recursive: true });

const ff = (args) => execFileSync('ffmpeg', ['-y','-v','error',...args], {stdio:['ignore','inherit','inherit']});
const probe = (f) => parseFloat(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',f]).toString());

const LEAD = 0.5, TAIL = 0.7, SRC = 6.0417;
let offset = 0; let srt = ''; let cue = 1;
const fmt = (t) => { const h=String(Math.floor(t/3600)).padStart(2,'0'), m=String(Math.floor(t%3600/60)).padStart(2,'0'), s=String(Math.floor(t%60)).padStart(2,'0'), ms=String(Math.round(t%1*1000)).padStart(3,'0'); return `${h}:${m}:${s},${ms}`; };
const concatList = [];

for (const id of IDS) {
  const d = probe(`${A}/${id}.mp3`);
  const L = LEAD + d + TAIL;
  const speed = L / SRC;
  // Retimed video + narration (delayed by LEAD), soft fades at both ends.
  ff(['-i',`${C}/${id}.mp4`,'-i',`${A}/${id}.mp3`,
    '-filter_complex',
    `[0:v]setpts=${speed.toFixed(5)}*PTS,fps=24,scale=1920:1088,format=yuv420p,fade=t=in:st=0:d=0.25,fade=t=out:st=${(L-0.25).toFixed(3)}:d=0.25[v];`+
    `[1:a]adelay=${Math.round(LEAD*1000)}|${Math.round(LEAD*1000)},apad[a]`,
    '-map','[v]','-map','[a]','-t',L.toFixed(3),
    '-c:v','libx264','-preset','medium','-crf','20','-c:a','aac','-b:a','160k','-ar','44100',
    `${SEG}/${id}.mp4`]);
  concatList.push(`file '.segments/${id}.mp4'`);

  // Subtitle split: start time of the first char of line 3 in the alignment.
  const al = JSON.parse(readFileSync(`${A}/${id}.json`)).alignment;
  const chars = al.characters; const starts = al.character_start_times_seconds; const ends = al.character_end_times_seconds;
  const text = chars.join('');
  const lines = text.split('\n');
  const splitIdx = lines[0].length + 1 + lines[1].length + 1; // first char of line 3
  const tSplit = starts[Math.min(splitIdx, starts.length-1)];
  const tEnd = ends[ends.length-1];
  const [pairA, pairB] = VERSE[id];
  srt += `${cue++}\n${fmt(offset+LEAD)} --> ${fmt(offset+LEAD+tSplit-0.05)}\n${pairA[0]}\n${pairA[1]}\n\n`;
  srt += `${cue++}\n${fmt(offset+LEAD+tSplit)} --> ${fmt(offset+LEAD+tEnd+0.4)}\n${pairB[0]}\n${pairB[1]}\n\n`;
  offset += L;
  console.log(`${id}: narration ${d.toFixed(2)}s -> segment ${L.toFixed(2)}s (slow ${speed.toFixed(2)}x)`);
}

writeFileSync(`public/surprise/flight/video/film.srt`, srt);
writeFileSync(`public/surprise/flight/video/concat.txt`, concatList.join('\n'));
console.log(`total ${offset.toFixed(1)}s — concatenating + burning subtitles…`);

ff(['-f','concat','-safe','0','-i','public/surprise/flight/video/concat.txt',
  '-vf',"subtitles=public/surprise/flight/video/film.srt:force_style='FontName=Verdana,FontSize=15,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H66000000,Outline=2,Shadow=1,MarginV=36'",
  '-c:v','libx264','-preset','medium','-crf','21','-c:a','copy','-movflags','+faststart',
  'public/surprise/flight/video/the-fantail-who-flew-her-home.mp4']);
console.log('FINAL FILM DONE');
