import test from 'node:test';import assert from 'node:assert/strict';import{createGame,course,steer,step,jump,boost,speed,LENGTH}from'../src/engine.js';
test('each obstacle row has a safe pint lane',()=>{const rows=course();for(const z of new Set(rows.map(e=>e.z))){const row=rows.filter(e=>e.z===z),pint=row.find(e=>e.type==='pint');assert(pint);assert(!row.some(e=>e.type!=='pint'&&e.lane===pint.lane));}});
test('lane bounds and paused simulation',()=>{const g=createGame();g.mode='playing';for(let i=0;i<9;i++)steer(g,-1);assert.equal(g.lane,-1);g.mode='paused';step(g,.05);assert.equal(g.distance,0);});
test('pints fuel manually activated boost',()=>{const g=createGame();g.mode='playing';g.events=[{z:1,lane:0,type:'pint'}];step(g,.05);assert.equal(g.pints,1);assert.equal(g.boost,0);assert(boost(g));assert.equal(g.fuel,0);assert(!boost(g));});
test('jump clears cow but not tractor',()=>{for(const type of['cow','tractor']){const g=createGame();g.mode='playing';g.events=[{z:1,lane:0,type}];jump(g);g.jump=.6;step(g,.05);assert.equal(g.lives,type==='cow'?3:2);}});
test('invulnerability protects consecutive impacts',()=>{const g=createGame();g.mode='playing';g.events=[{z:1,lane:0,type:'cow'},{z:2,lane:0,type:'tractor'}];step(g,.05);assert.equal(g.lives,2);});
test('course finishes and freezes',()=>{const g=createGame();g.mode='playing';g.events=[];g.distance=LENGTH-1;step(g,.05);assert.equal(g.mode,'won');step(g,.05);assert.equal(g.distance,LENGTH);});
test('three separate hits end run',()=>{const g=createGame();g.mode='playing';for(let i=0;i<3;i++){g.invincible=0;g.events=[{z:g.distance+1,lane:0,type:'tractor'}];step(g,.05);}assert.equal(g.mode,'lost');});

test('difficulty increases speed and row density without blocking safe lanes',()=>{const g=createGame();const initial=speed(g);g.distance=LENGTH*.9;assert(speed(g)>initial+30);const distances=[...new Set(course().map(e=>e.z))];assert(distances.at(-1)-distances.at(-2)<distances[1]-distances[0]);});

import {COLLISION_OFFSET, JUMP_DURATION, jumpHeight} from '../src/engine.js';
function runFor(g, seconds, hz) { for(let elapsed=0; elapsed<seconds-1e-9;) { const dt=Math.min(1/hz,seconds-elapsed);step(g,dt);elapsed+=dt; } }
test('lane easing and speed integration agree at 30, 60 and 120 Hz',()=>{
  const results=[30,60,120].map(hz=>{const g=createGame();g.mode='playing';g.events=[];g.fuel=1;boost(g);steer(g,1);runFor(g,3,hz);return g;});
  for(const g of results){assert(Math.abs(g.x-results[0].x)<1e-10);assert(Math.abs(g.distance-results[0].distance)<1e-8);assert.equal(g.boost,0);}
  const near=createGame();near.mode='playing';near.events=[];steer(near,1);step(near,1/60);assert(near.x>0&&near.x<.5,'swerve interpolates rather than teleports');
});
test('jump follows a symmetric parabola and cannot retrigger in flight',()=>{
  const g=createGame();g.mode='playing';assert(jump(g));assert.equal(jumpHeight(g),0);assert(!jump(g));
  g.jump=JUMP_DURATION*.75;assert.equal(jumpHeight(g),.75);g.jump=JUMP_DURATION*.5;assert.equal(jumpHeight(g),1);
  g.jump=JUMP_DURATION*.25;assert.equal(jumpHeight(g),.75);g.jump=0;assert.equal(jumpHeight(g),0);assert(jump(g));
});
test('collision checks actual jump height at arrival, consistently across frame rates',()=>{
  const k=36/LENGTH;
  for(const hz of [30,60,120])for(const time of [.04,.25,.525,.80,1.02])for(const type of ['cow','sheep','tractor']){
    const g=createGame();g.mode='playing';g.events=[{z:COLLISION_OFFSET+72*Math.expm1(k*time)/k,lane:0,type}];jump(g);runFor(g,time+.02,hz);
    const height=4*(time/JUMP_DURATION)*(1-time/JUMP_DURATION);const safe=type!=='tractor'&&height>=.5;
    assert.equal(g.lives,safe?3:2,`${hz}Hz ${type} at ${time}s`);
  }
});
test('many seeded courses allow every safe-lane transition even at maximum boost speed',()=>{
  for(let seed=0;seed<100;seed++){
    const events=course(seed),pints=events.filter(e=>e.type==='pint');
    let previousLane=0,previousZ=COLLISION_OFFSET;
    for(const pint of pints){
      assert(!events.some(e=>e.z===pint.z&&e.type!=='pint'&&e.lane===pint.lane));
      const available=(pint.z-previousZ)/148;
      const required=Math.log(Math.max(1,Math.abs(pint.lane-previousLane)/.4))/14;
      assert(available>required+.25,`seed ${seed} must allow reaction plus lane travel`);
      previousLane=pint.lane;previousZ=pint.z;
    }
  }
});
test('safe lane autopilot can finish multiple seeded courses without damage',()=>{
  for(const seed of [1,42,1981,2026,4294967295]){
    const g=createGame(seed);g.mode='playing';
    while(g.mode==='playing'&&g.time<120){const target=g.events.find(e=>!e.done&&e.type==='pint');if(target){while(g.lane!==target.lane)steer(g,Math.sign(target.lane-g.lane));}if(g.fuel)boost(g);step(g,1/60);}
    assert.equal(g.mode,'won');assert.equal(g.lives,3);assert.equal(g.pints,g.events.filter(e=>e.type==='pint').length);
  }
});
test('pause freezes timers and controls; invalid delta cannot corrupt the run',()=>{
  const g=createGame();g.mode='playing';g.events=[];jump(g);g.fuel=2;boost(g);g.mode='paused';const snapshot=JSON.stringify(g);
  steer(g,1);assert(!jump(g));assert(!boost(g));step(g,.05);assert.equal(JSON.stringify(g),snapshot);
  g.mode='playing';const active=JSON.stringify(g);for(const dt of [-1,0,NaN,Infinity])step(g,dt);assert.equal(JSON.stringify(g),active);
});

test('resolved obstacles and missed pints remain distinct from collected pints', () => {
  const g = createGame(); g.mode = 'playing';
  g.events = [{z: 1, lane: 0, type: 'pint'}, {z: 1, lane: -1, type: 'pint'}, {z: 1, lane: 1, type: 'tractor'}];
  step(g, .05);
  assert(g.events.every(e => e.done));
  assert.equal(g.events[0].collected, true);
  assert.equal(g.events[1].collected, undefined);
  assert.equal(g.events[2].collected, undefined);
});
