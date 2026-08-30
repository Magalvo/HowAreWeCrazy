# How Are We Crazy

`How Are We Crazy` is an original, mobile-first conversation card game built as an installable
Progressive Web App. One device becomes the deck: players reveal cards, talk, pass freely,
and save prompts they want to revisit.

## Scope

This is a private project: a game to play with friends. There are no purchases, no
microtransactions, no accounts, and no analytics, and none are planned.

That decision is load-bearing rather than incidental. It is what keeps the Imgflip image
templates in `Caption Clash` inside the terms they are offered under, and it is why
several of the concerns a commercial product would carry are deliberately absent from the
list at the end of this file.

## MVP Features

- Three escalating levels: Curiosity, Connection, and Reflection.
- Tailored prompts for two people, friends, or groups.
- Quick, full, and long sessions.
- Cooperative live rooms where one host controls the shared deck.
- `A Table 4 Two` live rooms for two phones with a shared connection milestone and optional closing reward.
- `Inner Circle` live rooms for 3-6 phones with fair targeting, scoring, Bailout, and Double Down.
- `Icebreaker` live rooms for 3-6 phones with roulette turns and shared group progress.
- `Caption Clash` live rooms for 2-8 phones, set up two ways. It runs in either direction:
  an image on the table answered with a caption, or a caption on the table answered with an
  image. And it runs with or without a judge - judged needs three players and scores to 5,
  while free play needs only two, seats no judge, and simply shows both answers until the
  cards run out. Image templates are snapshotted from Imgflip by `npm run cards:refresh`;
  Imgflip hosts them without owning them, and its terms cover the personal, non-commercial
  use this project is. The 128 caption cards are original, in English and Portuguese. This
  is the one mode that needs the network mid-game, so it does not work offline.
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

### Room Durability

Rooms live in the memory of one instance, so a restart, a redeploy, or the six-hour idle
sweep ends them. For games played in a single sitting this is an accepted trade-off rather
than a gap: the fix is a database, and a database is more machinery than this project
needs. The practical consequence is the one above - do not deploy while a group is
playing.

## Adaptive Live Experiences

When creating a live room, choose the experience that suits the table:

- `A Table 4 Two` has two partners build a shared meter toward 20 points while completing two prompts at each depth. Reaching the milestone unlocks a shared activity or meaningful closing question.
- `Inner Circle` keeps private draws, selected responders, one free `Bailout`, and one `Double Down`, while cooldowns spread prompts fairly around the group. First to 21 wins.
- `Icebreaker` has the active facilitator pick a light depth, then spin for a fair server-selected responder. The group builds toward 15 points together.
- `Caption Clash` deals every player a private hand and turns over one card per round.
  Everyone but the judge plays at once, the plays stay anonymous while the judge decides,
  and authorship appears only after the round is over. Which deck goes on the table and
  which is dealt into hands is a setup choice, so the same rules run in both directions;
  an image hand is dealt smaller than a caption hand, since every card in it is a separate
  request to a third-party host. Without a judge there is no judging phase and no score,
  and two players are enough. It runs on its own engine rather than the adaptive one,
  because it is the only mode where players act simultaneously.

Live rooms live only in server memory, so restarting the local or hosted server clears
active matches.

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

## Possible Next Steps

None of this is committed work. It is what would matter if it were.

1. Rate-limit room creation. The URL is public, so anyone who finds it can open rooms.
   The idle sweep caps the cost at six hours rather than forever, which is likely enough
   at this scale.
2. Serve static assets with `Cache-Control` and `ETag`, and fall back to `index.html` on
   unknown paths so deep links resolve instead of returning plain-text 404s.
3. Write more cards. Content is what these games run out of, not code.
4. Cache `Caption Clash` images through the service worker, or accept that the one mode
   needing the network stays online-only.

Accounts, purchases, analytics, and app-store packaging are deliberately not on this list.
See [Scope](#scope).
