import test from 'node:test';
import assert from 'node:assert/strict';
import {createHouseModel} from '../scripts/house-model.mjs';
import {FloorMap} from '../src/nav.js';
import {inWalkableArea} from '../src/house/navigation.js';
import {HOUSE_ROOMS} from '../src/house/house-layout.js';

// The indexed walkability test must agree with the player's own test everywhere,
// including around rotated furniture such as the hall console and the lobby bench.
test('the indexed floor map matches inWalkableArea on a fine sweep of the house',()=>{
 const world=createHouseModel({optimize:false});
 const map=new FloorMap(world.colliders);
 const points=HOUSE_ROOMS.flatMap(r=>r.polygon),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
 let checked=0;
 for(let x=Math.min(...xs);x<=Math.max(...xs);x+=.13)for(let z=Math.min(...zs);z<=Math.max(...zs);z+=.13){
  assert.equal(map.walkable(x,z),inWalkableArea(x,z,true,world.colliders),`disagreement at ${x.toFixed(2)},${z.toFixed(2)}`);checked++;
 }
 assert.ok(checked>10000);
});
