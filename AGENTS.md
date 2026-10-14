<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Shuffle transformed Hamiltonian cycle/start combinations, excluding the preceding variant and head location and deduplicating actual paths until the finite pool is exhausted; preserve cycle-order shortcut checks for safe completion.
- Define canvas palettes in global CSS tokens and read them in the browser; recording and on-screen rendering must share the same selected palette and head.
- Model digestion pulses in a browser-safe pure helper using fractional game steps and body-relative positions; this keeps swallowing smooth, pause-aware, and identical in recordings without changing collision logic.
- Pass video format into Game initialization and use a contiguous reversed cycle slice for either starting length; normalize Long progress from its initial small snake so it starts at zero without an empty invalid snake.
- Draw the above-board heading and game counters directly on the recording canvas so preview and exported video match.
- Route the shared ASMR mix through one peak limiter before splitting to speakers and recording to preserve identical, unclipped audio.
- Compute daily upload configurations centrally in the Python runner with date-based palette rotation and banner variants so independent workflow jobs stay distinct.
- Keep meme playback and shared library management in separate modules; composite frames onto the game canvas and route audio through the shared limiter so exports match playback. Daily jobs explicitly pass their centrally configured meme flag.
- Store the shared meme library in Cloud with verified owner role writes, public metadata reads and signed private-storage playback URLs; resumable uploads avoid large-file memory buffering.
- Schedule the next meme from the previous clip's ended/error event in game time; format-specific placement must never cover the board.
- Capture covers directly from the recording canvas while an actually-used meme is visible; upload custom covers for Long only, as Shorts custom cover selection is not supported by the YouTube API.
