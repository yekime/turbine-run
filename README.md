# Turbine Run

A dependency-free neon arcade drive for irishchud.com. Built with Canvas 2D, ES modules and procedural Web Audio. Chunky Irish toy geometry inspired by guinness-goblin, reimagined as a sunset back-road racer.

## Run

Serve this directory with `python3 -m http.server 8080`, then open http://localhost:8080. Any static host works; publish the repository root. No build, external fonts, image downloads or tracking.

## Play

- Left/right or A/D: change lanes. Touch: swipe or use arrow buttons.
- Space / up arrow: rear jet jump. Clears cows and sheep, not tractors.
- Shift / lightning button: spend a collected pint on 2.4 seconds of jet boost.
- Escape / P / pause button: pause or resume. Switching tabs automatically pauses.
- Speed climbs from 72 to 108; obstacle rows gradually tighten and double-obstacle rows become more frequent, always leaving one clear lane.
- Three bodywork points; temporary invulnerability after a hit. A finite 6.2 km course ends at the Turbine Arms (roughly 50–70 seconds).
- Sound is opt-in. Reduced-motion preference disables title-screen movement and boost streaks.

Pints are fantastical fuel collectibles, not a real-world driving recommendation. No payments, personal data or external APIs.

## Tests

`npm test` (Node 18+). Tests cover row safety, control bounds, pause, boost fuel, jump collision, hit immunity, loss and finish. Game state is isolated in `src/engine.js`.

## Personalisation

Pub name and birthday copy are in `index.html` and `src/main.js` (`pub` and `finish`). No recipient name is assumed. Domain setup is performed at your static host; this source does not modify DNS.
