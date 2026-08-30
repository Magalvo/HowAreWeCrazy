# How Are We Crazy

`How Are We Crazy` is an original, mobile-first conversation card game built as an installable
Progressive Web App. One device becomes the deck: players reveal cards, talk, pass freely,
and save prompts they want to revisit.

## MVP Features

- Three escalating levels: Curiosity, Connection, and Reflection.
- Tailored prompts for two people, friends, or groups.
- Quick, full, and long sessions.
- Cooperative live rooms where one host controls the shared deck.
- `A Table 4 Two` live rooms for two phones with a shared connection milestone and optional closing reward.
- `Inner Circle` live rooms for 3-6 phones with fair targeting, scoring, Bailout, and Double Down.
- `Icebreaker` live rooms for 3-6 phones with roulette turns and shared group progress.
- `Caption Clash` live rooms for 3-8 phones: a rotating judge picks the caption that fits
  the image best. Image templates are snapshotted from Imgflip by
  `npm run cards:refresh`; Imgflip hosts them without owning them, so its terms cover
  personal, non-commercial use only. Caption copy is original. This is the one mode that
  needs the network mid-game, so it does not work offline.
- Session resume and a locally saved card collection.
- Installable, responsive PWA with offline support.
- Original branding and original card copy.

## Run Locally

```bash
npm run dev
```

This runs the Node room API and the React/Vite web client together. Open
`http://localhost:5173` on a desktop. To join a live room from phones on the same
Wi-Fi network, open the development machine's network address with port `5173`, then enter
the room code or open the invite link copied by the host.

## Frontend Architecture

The web client now runs through React, Vite, and TypeScript. React owns setup, local
Conversation play, adaptive live-room screens, saved prompts, and live room updates.
The pure JavaScript game engines and Node room API remain independent of the interface,
so future UX work can iterate without rewriting server rule enforcement.

```bash
npm run build
```

The production build writes `dist/`; `npm start` serves that built client together with
the room API and Server-Sent Events endpoint.

## Deploy A Phone Playtest On Render

This repository includes a [`render.yaml`](./render.yaml) Blueprint for one always-on
Node web service in Render's Frankfurt region. It serves the installable web app, room
API, and live updates together from one HTTPS URL.

1. Push this project to a GitHub, GitLab, or Bitbucket repository.
2. In Render, select **New > Blueprint** and connect that repository.
3. Confirm the `open-thread-playtest` web service configuration from `render.yaml`.
4. Deploy the Blueprint and open the service URL on the host phone.
5. Create a live room and use **Share invite** so each participant opens the same public
   URL on their own phone.

The service is served at <https://howarewecrazy.magalvo.com>, a custom domain whose
certificate Render binds to the service named in the Blueprint. The service keeps the
name it was first deployed under: renaming it would make Render build a separate service
and leave the domain stranded on the old one. Invite links follow whichever host the app
was opened from, so nothing in the client needs to know about this.

The Blueprint uses the paid `starter` instance rather than a sleeping free service.
Conversation sessions can include long quiet pauses, so an always-on instance avoids
cold-start interruptions during a game. Render verifies availability through `GET /health`.

Live rooms are held in the memory of that single instance. A room is released after six
hours without activity, and every open room is lost when the service restarts or
redeploys, so avoid deploying while a group is playing.

### Playtest Limitation

This first hosted version keeps rooms in server memory. A Render restart, redeploy, or
service replacement ends active rooms. Treat this deployment as a live playtest build,
not durable session hosting. The next hosting milestone is storing room/session state in
Supabase Postgres while keeping private prompt authorization on the Node server.

## Adaptive Live Experiences

When creating a live room, choose the experience that suits the table:

- `A Table 4 Two` has two partners build a shared meter toward 20 points while completing two prompts at each depth. Reaching the milestone unlocks a shared activity or meaningful closing question.
- `Inner Circle` keeps private draws, selected responders, one free `Bailout`, and one `Double Down`, while cooldowns spread prompts fairly around the group. First to 21 wins.
- `Icebreaker` has the active facilitator pick a light depth, then spin for a fair server-selected responder. The group builds toward 15 points together.

Adaptive rooms live only in server memory during this prototype release, so restarting
the local or hosted server clears active matches.

## Test

```bash
npm test
```

Two suites run under one command. `npm run test:node` covers the rule engines and the
room API through Node's own test runner, against `test/`. `npm run test:web` covers the
React client through Vitest and Testing Library, against tests that sit beside the code
they exercise in `src/`.

`npm run check` is the full gate: it parses every plain JavaScript module, type-checks the
client, and runs both suites.

```bash
npm run check
```

## Next Product Steps

1. Persist rooms in Supabase Postgres so active rooms recover after web-service restarts.
2. Replace participant tokens in live-stream URLs with short-lived subscription tickets or secure session cookies before broader public access.
3. Add authored expansion packs and a content-management workflow.
4. Add optional accounts, purchases, and analytics only after validating repeat play.
5. Package the PWA for app stores with Capacitor when the web experience is proven.
