# Pirate Fleet Online (round 2a)
Rooms, chat, shared settings and the host-started online game. The server runs the whole simulation (sim.js); clients send steering and crew commands and draw the snapshots they get back.

## Run on your computer
1. Install Node 18+ from nodejs.org
2. In this folder: `npm install` then `npm start`
3. Open http://localhost:3000, click Play, create a room. Open a second tab, join with the code.

## Put it online (Render, free plan)
1. Make a free GitHub account and upload this folder as a new repository.
2. On render.com: New > Web Service > connect the repo.
3. Runtime: Node. Build command: `npm install`. Start command: `npm start`. Free plan.
4. When it's live, open the URL Render gives you, click Play, then Create game, and send family the plain site link. They open it, click Play and pick your game from the list.
Free plans sleep when idle, so the first visit can take about a minute to wake up. Any host that runs Node and supports WebSockets works (Fly.io, Railway, a VPS).

## Checking that the server is up to date
Open your site address followed by /healthz (for example https://your-app.onrender.com/healthz). It should say `ok server v4 · page v9`. If it shows an older version or just `ok`, or the page is missing, the newest server.js has not been deployed yet. Upload ALL files from the zip (server.js, sim.js, package.json, public/index.html), not just one.

## Music
The in-game playlist is the mp3 files in `public/music/` (Rolling Tide and Full Broadside). They play in the lobby and during matches, with a Music button in both places. To add tracks, drop mp3 files there and list them in the `PL` array near the top of the script in `public/index.html`.
