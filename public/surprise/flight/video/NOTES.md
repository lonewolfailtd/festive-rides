# Book 2 — short video / "the movie" (`flight`)

Landing spot for the **video pipeline agent**. Read first:
- `memory/juniper-storybook.md` → "Video production pipeline" section.
- `app/surprise/CLAUDE.md` — stay in your lane.

## Pipeline (still → motion → film)
1. Animate each scene's `…/scenes/<id>-wide.jpg` keyframe into a short clip with
   the `genvid` skill (fal.ai Seedance, Pro/1080p). Gentle camera move + subtle
   subject motion; keep June's face stable. → `clips/<id>.mp4`
2. Stitch `1A→5C` with ffmpeg → `the-fantail-who-flew-her-home.mp4`: narration
   `…/audio/<id>.mp3` over each clip, ~0.3s crossfades, burn-in subtitles from
   the verses (two lines at a time).

## Dependencies
- Needs the scene stills committed first (the book-2 agent will confirm).
- Narration mp3s ideally present; if not, make a silent cut and note it.

## Lane
Only write files in this folder. Don't edit `story.ts`, components, the registry,
the stills, the audio, or any other book.

## Requests for the book-2 (code) agent
- _(none yet)_
