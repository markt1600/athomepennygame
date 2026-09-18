# At Home — Keep Them Alive!

[PennyGame](https://github.com/markt1600/pennygame)'s family survival game, played inside the 3D home from [At Home](https://github.com/markt1600/at-home).

Instead of dragging cartoon family members around a single canvas room, you walk through the house in first person. When someone needs something they wave their arms and a bubble counts down. You have to **find them** (the roster tells you which room they are in and edge markers point the way), walk up, and **tell them where to go**: the dining table, the nearest bathroom, their bed, the nearest shower, the window lounge, the meditation alcove, the home office desk, the sofa for a break. They walk there on their own and the need is served when they arrive. Pets are Leo, Cyrus and Pebble from At Home, with their own bowls in the kitchen and walks on the balcony.

Everything else is PennyGame: starting money, `$5` human needs and `$1` pet needs that inflate `+$1` a minute up to `$10`, two missed needs and someone dies, a year of age every ten seconds and a peaceful passing at 100, `$5` per ten seconds at the desk for anyone aged 12 to 60, half-price needs for workers, a raise every five working years, a compulsory break after sixty seconds, tickling, income every thirty seconds, a global Hall of Fame, and a zombie on `Z` that gives you ten seconds to choose who to offer.

The house keeps working while you play. Everything At Home lets you do is still here, through the same modules: put a record on the turntable (the hands place the vinyl and a gentle house melody plays when no music library is configured), close the curtains and watch the sky film on the window-lounge projector, light the hallway candle, tidy the shoes by the lobby bench, open the fridge, run the taps and the bath drain, turn on the stove, call the lift, and play the claw machine and the Deadpool pinball table. Leo, Cyrus and Pebble use At Home's roaming and filmed sprites, so they nap, groom, lounge belly-up, play together, and Leo fetches his bone when you pick it up and throw it. The family game pauses while a mini-game panel is open.

People use the furniture rather than standing beside it. Workers sit on the office chairs (At Home's gaming chair now faces the dual-monitor desk, and two more chairs stand at the simulator desk), diners sit on the six dining chairs, breaks are taken on the orange sofa, the bathroom need uses the powder-room toilet, sleepers lie in the main bed or the second bedroom's bed, exercise happens on the meditation-alcove mats, play means the claw machine or pinball, and a bath is a shower in the glass cubicle behind a frosted steam screen. Every one of these stations is exclusive, so two people never share a chair or a bed, and a chair hemmed in by its neighbours is reached with a short sideways squeeze. Off-screen arrows say who needs what ("Go help · Penny is hungry · 12s · 7m"). Meals are real: a plate with a burger, chips and a drink (or a tall drink for the thirsty) appears on the table in front of the chair and empties bite by bite; the pets' kibble mounds go down in their own kitchen bowls the same way. Playing means the window lounge, where the lounge sofa and chair face the big screen: the screen runs a little platformer and the player holds a controller. The bathroom need and the shower both go to the nearest of the three bathrooms (powder room, main bathroom, second bathroom), and all three have hinged doors that whoever uses the toilet or the shower shuts behind them; it swings open again when they get up, waits while you are standing in the doorway, and keeps you out while it is shut. Pets sent on an errand squeeze past a housemate asleep in a narrow gap, and an errand that still cannot find a way after half a minute is called off and refunded.

Two rules changed because the house is big:

- Need timers pause while someone walks to a chore. The difficulty is finding people and budgeting, not sprinting across twenty metres of hallway.
- Workers who leave the desk for a snack walk back on their own and keep their shift clock, instead of PennyGame's five-second return window.

## Controls

Desktop: `WASD` or arrows walk, mouse looks, `Space` jumps small furniture, a click talks to the family member in front of you, number keys pick a menu option, `P` pauses (the pause menu can also end the game and show your score), `X` toggles the autopilot, `Z` summons the zombie, `M` mutes, `Esc` opens the pause menu.

Touch: At Home's controls. The left thumb stick walks, dragging anywhere else looks around, and tapping a family member, pet or fixture uses it. The Talk button acts on whatever is in front of you, and there are Pause and zombie buttons.

**Autopilot** (the 🤖 button in the top bar, the 🤖 touch button, or **X**) runs you round the house: it walks to whoever is asking for something, most urgent first, faces them and gives the order, puts idle adults to work when nobody needs anything, and skips anyone you cannot afford for a while. Any walk or stick input hands control back. Talking to someone is a click or a tap; the aim looks for the crown of the head first, so a worker hidden behind a chair back still lights up when their head shows.

On a phone the layout is trimmed: a compact HUD, off-screen needs stacked in a tray under it (most urgent first) instead of floating around the edges, and the family roster behind the 👨‍👩‍👧‍👦 button in the HUD so the thumb stick and buttons stay clear.

## Frame rate

- The house is At Home's batched geometry; each family member is only a few draw calls (limbs, body and head are merged into vertex-coloured meshes) plus one sprite for the need bubble.
- At Home's adaptive resolution scales the drawing buffer to hold 45–60 fps, and mirror reflections refresh at most one pane per frame.
- **Performance mode** (start-screen checkbox, or `?lite=1`) turns mirrors off, refreshes shadows rarely and caps the pixel ratio at 1. It switches itself on if more than half of a four-second window runs under 30 fps at the lowest resolution, and the choice is remembered on the device.
- The rules engine, navigation and agent updates cost well under a millisecond per frame; walking-graph searches only happen when someone picks a destination.

## Run locally

Node 20.19 or newer:

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm test` builds the house headlessly and checks the rules engine (needs, money, work, aging, zombie, game over), the navigation graph (every zone has standing spots in the right room, all zones reach each other, the graph builds in well under a second), agent movement (people stay on the floor, reach every zone, share the desk, the zombie walks in and out), pets on At Home's roaming reaching the bowls and the balcony, and that the indexed walkability test agrees with At Home's own.

## Deploy to Vercel

Import the repository as a Vite project (`vercel.json` already sets the build command and output directory). For the shared leaderboard add the **Upstash Redis** marketplace integration under Storage; it supplies `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (the legacy `KV_REST_API_*` names also work). Without it the game keeps a per-device leaderboard in `localStorage`.

## Layout

- `src/game.js` — PennyGame's rules, independent of three.js. Travel is delegated to the agent layer through hooks.
- `src/zones.js` — which room each need maps to, in the house's own plan coordinates.
- `src/nav.js` — a 20 cm walking graph over the house with A* and path smoothing, built from the same colliders the player uses.
- `src/agents.js` — moves family members and the zombie along the graph, with polite detours around each other and the player; pets are handed to At Home's roaming and only sent on errands.
- `src/stations.js` — the chairs, sofa seats, toilet, beds, shower, games and mats people occupy, each exclusive, with the standing spots they are reached from.
- `src/doors.js` — the three hinged bathroom doors and their moving colliders.
- `src/props.js` — plates of food, kibble and the lounge game screen that appear while someone is busy.
- `src/pet-roaming.js` — At Home's pet roaming, changed only to borrow the game's walking graph instead of resampling the house.
- `src/family.js` — the family dolls (round heads with eyes, brows, noses and smiles, tees over trousers or a skirt, arms that bend at the elbow), their need bubbles and the effects; each doll is a handful of merged vertex-coloured meshes.
- `src/world.js` — the renderer, first-person movement and aiming, adapted from At Home's scene.
- `src/main.js` — HUD, roster, markers, menus, leaderboard and the game loop.
- `src/house/` — At Home's modules, unchanged: walls, furniture, textures, daylight, balcony life, fixtures, hands, turntable, cinema, claw and pinball, pet sprites, pet social play and the fetch bone. `life.js` is a small stand-in that only supplies the clock helper and the pet roster.
- `api/leaderboard.js` — the Upstash-backed global top ten from PennyGame.

The house geometry, artwork and pet films are the same authored, non-identifying assets that At Home publishes: dimensions and furniture, no address or photographs.

## Pi spectator mode
Open `/?pi=1&lite=1` to load the house, start the default family game, keep autopilot enabled and restart ten seconds after game over. Pi mode is muted initially, uses low graphics quality with a 30 FPS cap and a compact HUD, and does not request pointer lock or submit scores. The parent at `https://pi.marktan.ai` may send `pi-game-sound` (boolean `muted`) or `pi-game-restart` messages; all other message origins are ignored. Normal game play is unchanged.
