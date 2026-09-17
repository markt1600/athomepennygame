import test from 'node:test';
import assert from 'node:assert/strict';
import {createHouseModel} from '../scripts/house-model.mjs';
import {NavGraph,roomAt} from '../src/nav.js';
import {ZONES} from '../src/zones.js';
import {HOUSE_VIEWS,floorHeight,planPoint} from '../src/house/house-layout.js';
import {inWalkableArea} from '../src/house/navigation.js';

const world=createHouseModel({optimize:false});
const started=performance.now();
const nav=new NavGraph(world.colliders);
const buildMs=performance.now()-started;
const hall={x:HOUSE_VIEWS.hall[0],z:HOUSE_VIEWS.hall[2]};

test('the walking graph covers the house and builds quickly enough for a loading screen',()=>{
 assert.ok(nav.nodes.size>3000,`only ${nav.nodes.size} nodes`);
 assert.ok(buildMs<15000,`graph took ${Math.round(buildMs)} ms`);
 const linked=[...nav.nodes.values()].filter(n=>n.links.length>=3).length;
 assert.ok(linked/nav.nodes.size>.85,'most nodes connect to their neighbours');
});

test('every zone has standing spots in its own room, beside the furniture and reachable from the hall',()=>{
 for(const zone of Object.values(ZONES)){
  const spots=nav.nearestNodes(...zone.position,{count:zone.seats,maxDist:zone.radius});
  assert.ok(spots.length>=Math.min(zone.seats,2),`${zone.id} has ${spots.length} spots`);
  for(const n of spots){
   assert.ok(inWalkableArea(n.x,n.z,true,world.colliders),`${zone.id} spot is clear of furniture`);
   assert.equal(n.room,zone.room,`${zone.id} spot lies in ${n.room}, expected ${zone.room}`);
  }
  // A spot boxed in by dining chairs is skipped at run time; enough must remain.
  const routable=spots.filter(n=>{const path=nav.route(hall,n);return path&&path.length>1;});
  assert.ok(routable.length>=Math.min(zone.seats,2),`${zone.id}: ${routable.length} spots reachable from the hall`);
 }
});

test('zones are reachable from one another with smoothed, walkable paths',()=>{
 const ids=Object.keys(ZONES);
 for(const a of ids)for(const b of ids){
  if(a===b)continue;
  const from=nav.nearestNodes(...ZONES[a].position,{count:1,maxDist:ZONES[a].radius})[0];
  const to=nav.nearestNodes(...ZONES[b].position,{count:1,maxDist:ZONES[b].radius})[0];
  const path=nav.route(from,to);
  assert.ok(path,`${a} → ${b}`);
  for(let i=1;i<path.length;i++)assert.ok(nav.clear(path[i-1],path[i]),`${a} → ${b} segment ${i} crosses furniture or a big step`);
  assert.ok(path.length<60,`${a} → ${b} path is smoothed (${path.length} corners)`);
 }
});

test('the hall connects down the steps into the sunken living room and out to the front door',()=>{
 const [lx,lz]=planPoint(440,620),living={x:lx,z:lz};
 assert.equal(roomAt(living.x,living.z).id,'living');assert.equal(floorHeight(living.x,living.z),0);
 const route=nav.route(hall,living);
 assert.ok(route&&route.length>1);
 const [dx,dz]=planPoint(890.5,784.5);
 assert.ok(nav.route({x:dx,z:dz},hall),'the front door threshold reaches the hall');
 assert.ok(nav.nodes.size>3000&&buildMs<4000,`graph: ${nav.nodes.size} nodes in ${Math.round(buildMs)} ms`);
 // Walking around another person: the detour avoids their personal space.
 const mid=route[Math.floor(route.length/2)];
 const detour=nav.route(hall,living,{avoid:[{x:mid.x,z:mid.z,r:.45}]});
 if(detour)for(const p of detour)assert.ok(Math.hypot(p.x-mid.x,p.z-mid.z)>=.44||p===detour[0],'keeps clear of the avoided point');
});

test('wander targets stay on open floor and the requested rooms',()=>{
 let seed=7;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const graph=new NavGraph(world.colliders,{random});
 for(let i=0;i<40;i++){
  const n=graph.wanderTarget(hall,{min:1,max:8,rooms:['living','dining','passage','kitchen','hall']});
  assert.ok(n,'a wander target exists');
  assert.ok(['living','dining','passage','kitchen','hall'].includes(n.room),n.room);
  assert.ok(n.links.length>=7,'open floor');
 }
});
