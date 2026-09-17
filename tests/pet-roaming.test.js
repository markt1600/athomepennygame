import test from 'node:test';
import assert from 'node:assert/strict';
import {createHouseModel} from '../scripts/house-model.mjs';
import {NavGraph,roomAt} from '../src/nav.js';
import {PetRoaming} from '../src/pet-roaming.js';
import {Game} from '../src/game.js';
import {Agents} from '../src/agents.js';
import {ZONES,PET_NEEDS} from '../src/zones.js';

// At Home's pet roaming drives the pets in the browser. It borrows the game's
// navigation graph, so building it must be quick and errands must still arrive.
test('pets on At Home roaming wander, answer errands to the bowls and the balcony, and stop when petted',()=>{
 const world=createHouseModel({optimize:false});
 let seed=11;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 const nav=new NavGraph(world.colliders,{random});
 const started=performance.now();const roaming=new PetRoaming(world.colliders,random,nav);
 assert.ok(performance.now()-started<500,'roaming reuses the graph instead of resampling the house');
 assert.equal(roaming.nodes.size,nav.nodes.size);
 const game=new Game({random,hooks:{}}),agents=new Agents(nav,game,{random,petRoaming:roaming});
 Object.assign(game.hooks,{place:c=>agents.place(c),go:(c,zone,purpose)=>agents.go(c,zone,purpose),stop:c=>agents.stop(c)});
 const arrivals=[];const arrived=game.arrived.bind(game);game.arrived=c=>{arrivals.push([c.name,c.destination?.zone,c.x,c.z]);arrived(c);};
 game.start({familySize:3,petCount:3});for(const c of game.chars)c.nextReq=1e9;
 const leo=game.chars.find(c=>c.name==='Leo'),miso=game.chars.find(c=>c.name==='Cyrus');
 assert.equal(roaming.pets.size,3);
 const step=1/30,tick=seconds=>{for(let t=0;t<seconds;t+=step){game.update(step);roaming.update(step,{enabled:true,player:null,hours:12});agents.update(step);}};
 tick(30);
 assert.ok(game.chars.filter(c=>c.isPet).every(c=>roomAt(c.x,c.z)),'pets stay inside the house');
 game.startRequest(leo,PET_NEEDS[0]);assert.ok(game.act(leo,'serve').ok);assert.equal(leo.state,'going');
 tick(90);
 const bowls=arrivals.find(([n,z])=>n==='Leo'&&z==='bowls');
 assert.ok(bowls,'Leo reached the kitchen bowls');
 assert.ok(Math.hypot(bowls[2]-ZONES.bowls.position[0],bowls[3]-ZONES.bowls.position[1])<=ZONES.bowls.radius+.4);
 assert.equal(game.served,1);
 game.startRequest(miso,PET_NEEDS[1]);assert.ok(game.act(miso,'serve').ok);
 tick(120);
 assert.ok(arrivals.some(([n,z])=>n==='Cyrus'&&z==='walk'),'Cyrus reached the living balcony');
 for(const c of game.chars){if(c.state==='request'){c.state='wander';c.need=null;}c.nextReq=1e9;}
 assert.ok(game.act(miso,'tickle').ok);
 assert.equal(roaming.pets.get('miso').wait>0,true,'a petted cat pauses to enjoy it');
});
