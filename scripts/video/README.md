# Tabby — 15-second focus walkthrough

A silent 1920×1080, 30 fps MP4 made for the hackathon landing page. It shows a relevant React tutorial, a distracting tab, and the existing **Back to work** action. The context cards are exports of the actual English extension UI. Browser content and timing are staged for the walkthrough; this is not a live model recording.

The deliverables are `public/demo/tabby-focus-demo.mp4`, its JPEG poster, and an English WebVTT description track. The original Tabby artwork is in `public/brand/tabby/`.

## Re-render

Install project dependencies and Playwright Chromium. An FFmpeg executable with H.264 (`libx264`) encoding must be available on PATH, or set `TABBY_FFMPEG` to its full path.

```sh
node scripts/render-video.mjs --preview
node scripts/render-video.mjs
```

Preview frames are written to `artifacts/video-review/`. The renderer uses a local-only HTML scene, deterministic frame times, and no user data or AI requests. Edit the composition in `focus-demo.html`; the two frozen UI exports are in `assets/`.

## Timeline

- 0–4.4 s: goal and relevant tutorial.
- 4.4–8.75 s: cat-video detour and a context-aware nudge.
- 8.75–12.1 s: Back to work returns to the tutorial.
- 12.1–15 s: Tabby closing card.

All meaning is visible in the frames; no music or voiceover is needed for playback.
