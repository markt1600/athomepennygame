import test from 'node:test';
import assert from 'node:assert/strict';
import {createHouseModel} from '../scripts/house-model.mjs';
import {NavGraph,roomAt} from '../src/nav.js';
import {Game} from '../src/game.js';
import {Agents,walkSpeed,ERRAND_PATIENCE} from '../src/agents.js';
import {ZONES,PET_NEEDS} from '../src/zones.js';
import {HOUSE_VIEWS} from '../src/house/house-layout.js';
import {inWalkableArea} from '../src/house/navigation.js';

const world=createHouseModel({optimize:false});
let seed=3;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
const nav=new NavGraph(world.colliders,{random});

function setup(opts){
 const arrivals=[];
 const game=new Game({random,hooks:{}});
 const agents=new Agents(nav,game,{random});
 Object.assign(game.hooks,{place:c=>agents.place(c),go:(c,zone,purpose)=>agents.go(c,zone,purpose),stop:c=>agents.stop(c),zombie:(k,z)=>agents.zombieEvent(k,z)});
 const arrived=game.arrived.bind(game);game.arrived=c=>{arrivals.push([c.name,c.destination?.zone,c.x,c.z]);arrived(c);};
 game.start(opts);
 return {game,agents,arrivals};
}
const simulate=(game,agents,seconds,step=1/30)=>{for(let t=0;t<seconds;t+=step){game.update(step);agents.update(step);}};

test('everyone spawns on open floor and keeps wandering inside the house',()=>{
 const {game,agents}=setup({familySize:6,petCount:3});
 for(const c of game.chars)c.nextReq=1e9;
 for(const c of game.chars)assert.ok(inWalkableArea(c.x,c.z,true,world.colliders),`${c.name} spawns clear of furniture`);
 const travelled=new Map(game.chars.map(c=>[c.name,0]));const last=new Map(game.chars.map(c=>[c.name,{x:c.x,z:c.z}]));
 simulate(game,agents,90);
 for(const c of game.chars){
  assert.ok(inWalkableArea(c.x,c.z,true,world.colliders),`${c.name} stays clear of furniture (${c.x.toFixed(2)},${c.z.toFixed(2)})`);
  assert.ok(roomAt(c.x,c.z),`${c.name} is inside a room`);
 }
 // Sample movement: at least the humans should have moved around.
 const moved=game.chars.filter(c=>Math.hypot(c.x-last.get(c.name).x,c.z-last.get(c.name).z)>.5);
 assert.ok(moved.length>=4,`${moved.length} wanderers moved`);void travelled;
});

test('a commanded family member walks to the zone, arrives beside its furniture and is served there',()=>{
 const {game,agents,arrivals}=setup({familySize:3,petCount:0});
 for(const c of game.chars)c.nextReq=1e9;
 const penny=game.chars[0];
 for(const [needIndex,zoneId] of [[0,'table'],[2,'toilet'],[3,'bed'],[4,'mat'],[5,'tv'],[6,'tub']]){
  game.startRequest(penny,{...[{id:'eat',emoji:'🍔',verb:'fed',zone:'table'},{id:'drink',zone:'table'},{id:'bathroom',emoji:'🚽',verb:'sent',zone:'toilet'},{id:'sleep',emoji:'😴',verb:'tucked in',zone:'bed'},{id:'exercise',emoji:'🏋️',verb:'exercised',zone:'mat'},{id:'play',emoji:'🎮',verb:'played with',zone:'tv'},{id:'bathe',emoji:'🛁',verb:'bathed',zone:'tub'}][needIndex],want:'x'});
  assert.ok(game.act(penny,'serve').ok,zoneId);
  assert.equal(penny.state,'going');
  simulate(game,agents,60);
  const [,zone,ax,az]=arrivals.at(-1)||[];
  assert.equal(zone,zoneId,`${zoneId}: ${penny.state}`);
  const away=Math.hypot(ax-ZONES[zoneId].position[0],az-ZONES[zoneId].position[1]);
  assert.ok(away<=ZONES[zoneId].radius+.05,`arrived ${away.toFixed(2)} m from the ${zoneId} at ${ax.toFixed(2)},${az.toFixed(2)}`);
  assert.equal(roomAt(ax,az).id,ZONES[zoneId].room);
  assert.ok(['happy','wander','request'].includes(penny.state),penny.state);
  penny.nextReq=1e9;simulate(game,agents,3);
 }
});

test('workers take distinct desk spots, pets reach their bowls and the balcony, and the zombie walks in, hunts and leaves',()=>{
 const {game,agents,arrivals}=setup({familySize:4,petCount:3});
 for(const c of game.chars)c.nextReq=1e9;
 const [penny,max]=game.chars;
 assert.ok(game.act(penny,'work').ok);assert.ok(game.act(max,'work').ok);
 assert.notEqual(penny.spot.key,max.spot.key,'two different standing spots at the desk');
 simulate(game,agents,45);
 assert.equal(penny.state,'work');assert.equal(max.state,'work');
 assert.equal(roomAt(penny.x,penny.z).id,'study');assert.ok(Math.hypot(penny.x-max.x,penny.z-max.z)>.15,'not standing on each other');
 const leo=game.chars.find(c=>c.name==='Leo'),pebble=game.chars.find(c=>c.name==='Pebble');
 game.startRequest(leo,{id:'eat',emoji:'🍖',verb:'fed',zone:'bowls',want:'is hungry'});game.act(leo,'serve');
 game.startRequest(pebble,{id:'exercise',emoji:'🎾',verb:'exercised',zone:'walk',want:'wants a walk'});game.act(pebble,'serve');
 simulate(game,agents,60);
 assert.ok(arrivals.some(([n,z])=>n==='Leo'&&z==='bowls'),'Leo reached the kitchen bowls');
 assert.ok(walkSpeed(pebble)<walkSpeed(leo));
 simulate(game,agents,200);
 assert.ok(arrivals.some(([n,z])=>n==='Pebble'&&z==='walk'),'Pebble reached the balcony');
 assert.ok(game.spawnZombie());
 assert.ok(['lobby','hall'].includes(roomAt(game.zombie.x,game.zombie.z)?.id),'the zombie starts at the front door');
 simulate(game,agents,9);
 assert.equal(game.zombie.phase,'choosing','the zombie reached the hall within nine seconds');
 assert.equal(roomAt(game.zombie.x,game.zombie.z)?.id,'hall');
 simulate(game,agents,120);
 const eaten=game.chars.filter(c=>c.deathType==='eaten');
 assert.equal(eaten.length,1,'exactly one family member was eaten');
 assert.equal(game.zombie,null,'the zombie left through the front door');
});

test('a pet errand survives a refused first route, and a stall that never clears is called off with a refund',()=>{
 // At Home's router refuses a command while another pet blocks the way, then retries on its own.
 const pets=new Map(),[hx,,hz]=HOUSE_VIEWS.hall;
 const fake={pets,player:null,
  register(id){const p={id,x:hx,z:hz,y:.45,path:[],arrived:false,command:null,moving:false,activity:'idle'};pets.set(id,p);return p;},
  command(id,target,speed){const p=pets.get(id);p.command={x:target.x,z:target.z,speed};p.arrived=false;p.path=[];return false;},
  release(id){const p=pets.get(id);p.command=null;p.path=[];p.arrived=false;},interact(){}};
 const game=new Game({random,hooks:{}}),agents=new Agents(nav,game,{random,petRoaming:fake});
 Object.assign(game.hooks,{place:c=>agents.place(c),go:(c,zone,purpose)=>agents.go(c,zone,purpose),stop:c=>agents.stop(c)});
 game.start({familySize:2,petCount:2});for(const c of game.chars)c.nextReq=1e9;
 const [leo,cyrus]=game.chars.filter(c=>c.isPet);
 game.startRequest(leo,PET_NEEDS[0]);assert.ok(game.act(leo,'serve').ok,'the errand is accepted although the first route was refused');
 assert.equal(leo.state,'going');const paid=game.money;
 simulate(game,agents,5);assert.equal(leo.state,'going','still waiting for the router');
 const p=pets.get(leo.id);p.path=[{x:p.x+.2,z:p.z}];simulate(game,agents,2);
 p.path=[];p.arrived=true;simulate(game,agents,.1);
 assert.equal(leo.state,'happy','served once roaming reports arrival');assert.equal(game.money,paid);
 game.startRequest(cyrus,PET_NEEDS[1]);assert.ok(game.act(cyrus,'serve').ok);const before=game.money;
 simulate(game,agents,ERRAND_PATIENCE+1);
 assert.equal(cyrus.state,'request','a stall that never clears gives up');assert.ok(game.money>before,'the fee came back');assert.equal(pets.get(cyrus.id).command,null,'roaming was released');
});
