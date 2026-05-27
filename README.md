# Open Thread

`Open Thread` is an original, mobile-first conversation card game built as an installable
Progressive Web App. One device becomes the deck: players reveal cards, talk, pass freely,
and save prompts they want to revisit.

## MVP Features

- Three escalating levels: Curiosity, Connection, and Reflection.
- Tailored prompts for two people, friends, or groups.
- Quick, full, and long sessions.
- Cooperative live rooms where one host controls the shared deck.
- `Date Night` live rooms for two phones with a shared connection milestone and optional closing reward.
- `Inner Circle` live rooms for 3-6 phones with fair targeting, scoring, Bailout, and Double Down.
- `Icebreaker` live rooms for 3-6 phones with roulette turns and shared group progress.
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

## Adaptive Live Experiences

When creating a live room, choose the experience that suits the table:

- `Date Night` has two partners build a shared meter toward 20 points while completing two prompts at each depth. Reaching the milestone unlocks a shared activity or meaningful closing question.
- `Inner Circle` keeps private draws, selected responders, one free `Bailout`, and one `Double Down`, while cooldowns spread prompts fairly around the group. First to 21 wins.
- `Icebreaker` has the active facilitator pick a light depth, then spin for a fair server-selected responder. The group builds toward 15 points together.

Adaptive rooms live only in server memory during this prototype release, so restarting
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
