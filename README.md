# Turbine Run

A three-lane DeLorean arcade runner for **www.irishchud.com**. Real 3D toy countryside, a rear jet engine, Irish livestock and a final stop at the Turbine Arms.

## Run

Serve this directory with `python3 -m http.server 8080`, then visit `http://localhost:8080`. Requires a browser with WebGL2. No build step. Three.js 0.180.0 is vendored under `vendor/` with its MIT license; no runtime CDN dependencies.

## Controls

- Left/right or A/D: steer; swipe horizontally on a phone.
- Space/up: jet jump over cows and sheep; tractors must be dodged.
- Shift/lightning: spend a pint on 2.4 seconds of boost.
- P/Escape/pause: pause. Switching tabs pauses automatically.
- Sound is opt-in.

Speed climbs from 72 to 108, rows tighten, and double-obstacle patterns become more common. Each row retains a clear lane. Three hits end the run. The 6.2 km course ends at the pub.

## Code

- `src/engine.js`: deterministic simulation, continuous collision timing, normalized jump parabola and course generation.
- `src/renderer.js`: Three.js chase camera, scenery, instancing, lighting, shadows and animation.
- `src/models.js`: original procedural car, livestock, tractor, pint, pub, tree and turbine geometry.
- `src/main.js`: input, game screens, HUD and optional audio.

`npm test` runs mechanics tests with Node 18+. Includes seeded-course fairness, full boosted runs, and 30/60/120 Hz timing equivalence. Browser visual verification remains outstanding because the browser permission gate rejected access; source tests are not a substitute for visual or mobile-device testing.

## Hosting

Vercel: framework Other, no build command, output directory repository root. The `www` domain was responding successfully when checked. The bare apex domain failed TLS negotiation; attach/verify `irishchud.com` in the Vercel project's domain settings and configure its redirect to `www`.
