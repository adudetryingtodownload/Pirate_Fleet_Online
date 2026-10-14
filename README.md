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
4. When it's live, open the URL Render gives you, create a room and send family the invite link shown in the lobby.
Free plans sleep when idle, so the first visit can take about a minute to wake up. Any host that runs Node and supports WebSockets works (Fly.io, Railway, a VPS).
