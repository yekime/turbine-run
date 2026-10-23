import test from 'node:test';import assert from 'node:assert/strict';import{createGame,course,steer,step,jump,boost,speed,LENGTH}from'../src/engine.js';
test('each obstacle row has a safe pint lane',()=>{const rows=course();for(const z of new Set(rows.map(e=>e.z))){const row=rows.filter(e=>e.z===z),pint=row.find(e=>e.type==='pint');assert(pint);assert(!row.some(e=>e.type!=='pint'&&e.lane===pint.lane));}});
test('lane bounds and paused simulation',()=>{const g=createGame();g.mode='playing';for(let i=0;i<9;i++)steer(g,-1);assert.equal(g.lane,-1);g.mode='paused';step(g,.05);assert.equal(g.distance,0);});
test('pints fuel manually activated boost',()=>{const g=createGame();g.mode='playing';g.events=[{z:1,lane:0,type:'pint'}];step(g,.05);assert.equal(g.pints,1);assert.equal(g.boost,0);assert(boost(g));assert.equal(g.fuel,0);assert(!boost(g));});
test('jump clears cow but not tractor',()=>{for(const type of['cow','tractor']){const g=createGame();g.mode='playing';g.events=[{z:1,lane:0,type}];jump(g);g.jump=.6;step(g,.05);assert.equal(g.lives,type==='cow'?3:2);}});
test('invulnerability protects consecutive impacts',()=>{const g=createGame();g.mode='playing';g.events=[{z:1,lane:0,type:'cow'},{z:2,lane:0,type:'tractor'}];step(g,.05);assert.equal(g.lives,2);});
test('course finishes and freezes',()=>{const g=createGame();g.mode='playing';g.events=[];g.distance=LENGTH-1;step(g,.05);assert.equal(g.mode,'won');step(g,.05);assert.equal(g.distance,LENGTH);});
test('three separate hits end run',()=>{const g=createGame();g.mode='playing';for(let i=0;i<3;i++){g.invincible=0;g.events=[{z:g.distance+1,lane:0,type:'tractor'}];step(g,.05);}assert.equal(g.mode,'lost');});

test('difficulty increases speed and row density without blocking safe lanes',()=>{const g=createGame();const initial=speed(g);g.distance=LENGTH*.9;assert(speed(g)>initial+30);const distances=[...new Set(course().map(e=>e.z))];assert(distances.at(-1)-distances.at(-2)<distances[1]-distances[0]);});
