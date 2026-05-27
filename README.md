# Open Thread

`Open Thread` is an original, mobile-first conversation card game built as an installable
Progressive Web App. One device becomes the deck: players reveal cards, talk, pass freely,
and save prompts they want to revisit.

## MVP Features

- Three escalating levels: Curiosity, Connection, and Reflection.
- Tailored prompts for two people, friends, or groups.
- Quick, full, and long sessions.
- Cooperative live rooms where one host controls the shared deck.
- `Points Mode` live rooms for 3-6 phones with turns, targeting, scoring, Bailout, and Double Down.
- Session resume and a locally saved card collection.
- Installable, responsive PWA with offline support.
- Original branding and original card copy.

## Run Locally

```bash
npm run dev
```

Open `http://localhost:4173` on a desktop. To join a live room from phones on the same
Wi-Fi network, open the development machine's network address with port `4173`, then enter
the room code or open the invite link copied by the host.

## Points Mode

When creating a live room, select `Points Mode`. Once 3-6 players have joined, the host
starts the match. On each turn the active player privately draws a `Curiosity` (1 point),
`Connection` (3 points), or `Reflection` (5 points) card and targets another player.

- Responders tap `Completed` to earn points or `Pass` to let the active player claim or discard.
- Each player has one free `Bailout`, which removes a prompt and redirects a same-level replacement.
- Each player has one `Double Down`, which doubles a responder's reward while risking the base value.
- The first player to 21 points wins; if all 36 prompts run out first, the high score wins.

Points Mode rooms live only in server memory during this prototype release, so restarting
the local server clears active matches.

## Test

```bash
npm test
npm run check
```

## Next Product Steps

1. Persist rooms in a hosted database and deploy the live-room server publicly.
2. Add authored expansion packs and a content-management workflow.
3. Add optional accounts, purchases, and analytics only after validating repeat play.
4. Package the PWA for app stores with Capacitor when the web experience is proven.
