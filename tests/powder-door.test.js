import test from 'node:test';
import assert from 'node:assert/strict';
import {createHouseModel} from '../scripts/house-model.mjs';
import {DOOR_OPEN} from '../src/powder-door.js';
import {planPoint} from '../src/house/house-layout.js';
import {inWalkableArea,intersectsFootprint} from '../src/house/navigation.js';

const world=createHouseModel({optimize:false});
const door=world.powderDoor,doorway=planPoint(415,433),[dx,dz]=doorway;
const blocked=(x,z)=>intersectsFootprint(x,z,door.collider);

test('the powder-room door starts open against the wall and leaves the doorway clear',()=>{
 assert.equal(door.angle,DOOR_OPEN);assert.equal(door.shut,false);
 assert.ok(world.colliders.includes(door.collider),'the leaf is a collider the player walks around');
 for(const x of [dx-.3,dx,dx+.3])assert.ok(inWalkableArea(x,dz,true,world.colliders),`doorway clear at ${x.toFixed(2)}`);
 assert.ok(!blocked(dx,dz)&&!blocked(dx-.5,dz+.2),'an open leaf does not block the way in');
});

test('the door swings shut for whoever sits on the toilet and opens again afterwards',()=>{
 door.update(.1,true);assert.ok(door.angle<DOOR_OPEN&&!door.shut,'it takes a moment to swing');
 for(let i=0;i<20;i++)door.update(.1,true);
 assert.equal(door.angle,0);assert.ok(door.shut);
 assert.ok(blocked(dx,dz)&&blocked(dx-.08,dz-.3)&&blocked(dx-.08,dz+.3),'a shut leaf spans the whole opening');
 assert.ok(!inWalkableArea(dx-.1,dz,true,world.colliders),'the player cannot walk through it');
 assert.equal(Math.abs(door.hinge.rotation.y),0);
 for(let i=0;i<20;i++)door.update(.1,false);
 assert.equal(door.angle,DOOR_OPEN);assert.ok(!blocked(dx,dz));
});

test('the door waits while the player is standing in the doorway, and resets open',()=>{
 door.update(.1,true,{x:dx+.2,z:dz});assert.equal(door.angle,DOOR_OPEN,'held open for the player');
 door.update(.1,true,{x:dx+3,z:dz});assert.ok(door.angle<DOOR_OPEN,'closes once they have moved on');
 door.reset();assert.equal(door.angle,DOOR_OPEN);assert.equal(door.target,DOOR_OPEN);
});
