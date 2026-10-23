# Turbine Run

A three-lane jet DeLorean runner for **www.irishchud.com**. Neon Irish dusk, a curved-world road in the style of Subway Surfers, turbine blade transporters to drive up onto, Guinness tankers to jump on, and the Turbine Arms at the end of the road.

## Run

Serve this directory with `python3 -m http.server 8080`, then visit `http://localhost:8080`. Needs WebGL2. No build step. Three.js 0.180.0 and its bloom post-processing passes are vendored under `vendor/` with the MIT license; there are no runtime CDN requests.

## Controls

| Action | Phone | Keyboard |
|---|---|---|
| Change lane | swipe left or right | arrow keys, A, D |
| Jump | swipe up | up arrow, W, Space |
| Slam down from the air | swipe down | down arrow, S |
| Jet boost | double tap, or the bolt gauge | Shift, B, E |
| Pause | pause icon | P, Escape |
| Sound | speaker icon | M |

- Switching lanes in the air does a barrel roll.
- Pints fill the jet gauge, five at most. A boost lasts 2.4 s, adds 40 mph and rams livestock and tractors out of the way.
- Jump cows, sheep, goats, hay bales and keg stacks. Tractors and caravans are too tall: dodge them or boost through.
- Crash into livestock and it topples over; boost into it and it flies.
- Blade transporters have a ramp at the back: drive straight up and ride the blade. Bonus pints run along the top.
- Tankers have no ramp. Driving into the back costs bodywork. Jump onto them instead.
- You can't steer into the side of a truck; the car bumps off it.
- Every neon gate you drive through adds 3.2 mph for the rest of the run, 19 gates in all; they heat from green to cyan, orange and pink as you speed up.
- Three hits end the run.

Sound starts at the first tap or key press. The music is "The Irish Washerwoman", a traditional jig, synthesised live as a synthwave jig; the transcription is the [thesession.org setting by Aaron Bergen](https://thesession.org/tunes/92#setting47183).

## Code

- `src/engine.js`: deterministic simulation in fixed 240 Hz substeps. Lane easing, real jump physics with gravity, slam, trucks with ramps and decks, collisions and course generation with a guaranteed safe lane.
- `src/renderer.js`: Three.js scene. A curved-world vertex bend, a chase camera with shake and FOV kicks, bloom, a cloth flag, the afterburner, particles, the intro and hit reactions.
- `src/models.js`: the car, livestock, tractor, pint, turbine, pub, tree and leprechaun.
- `src/props.js`: gantries, cottages, neon shamrocks, the round tower, blade transporters and tankers.
- `src/audio.js`: engine sound, effects and music, all Web Audio.
- `src/main.js`: input, game screens and the HUD.

`npm test` runs the engine and model tests with Node 18 or later. They cover jump physics, slams, flips, ramps, tankers, side blocking, boost ramming, frame-rate independence, course fairness over 200 seeds and an autopilot that finishes five seeded courses.

Add `?debug` to the URL to expose `__game` and `__tr` in the console for testing.

## Hosting

Vercel: framework Other, no build command, output directory is the repository root.
