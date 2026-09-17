import test from 'node:test';
import assert from 'node:assert/strict';
import {createHouseModel} from '../scripts/house-model.mjs';
import {NavGraph,roomAt} from '../src/nav.js';
import {Game} from '../src/game.js';
import {Agents,approachNode} from '../src/agents.js';
import {stationPose} from '../src/stations.js';
import {ZONES,NEEDS} from '../src/zones.js';
import {HOUSE_VIEWS} from '../src/house/house-layout.js';
import {inWalkableArea} from '../src/house/navigation.js';

const world=createHouseModel({optimize:false});
let seed=5;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
const nav=new NavGraph(world.colliders,{random});
const hall={x:HOUSE_VIEWS.hall[0],z:HOUSE_VIEWS.hall[2]};
const ROOM={desk:'study',table:'dining',sofa:'living',toilet:'powder',bed:'bedroom',kidbed:'guest',tub:'bath',tv:'passage',mat:'meditation'};

test('every station sits in the right room and has a standing spot beside it that the hall can reach',()=>{
 const count=zone=>world.stations.filter(s=>s.zone===zone).length;
 assert.equal(count('desk'),3);assert.equal(count('table'),6);assert.equal(count('sofa'),3);assert.equal(count('bed'),2);assert.equal(count('kidbed'),2);assert.equal(count('tub'),1);assert.equal(count('tv'),2);assert.equal(count('mat'),2);assert.equal(count('toilet'),1);
 for(const station of world.stations){
  const p=stationPose(station);
  assert.equal(roomAt(p.x,p.z)?.id,ROOM[station.zone],`${station.id} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  const spot=approachNode(nav,station,hall);
  assert.ok(spot,`${station.id} has a standing spot the hall can reach`);
  assert.ok(Math.hypot(spot.x-p.x,spot.z-p.z)<1.65,`${station.id} spot is near it`);
 }
 assert.ok(nav.route(hall,{x:HOUSE_VIEWS.study[0],z:HOUSE_VIEWS.study[2]}),'the office doorway stays open');
});

test('people use the furniture: separate chairs, a bed to lie in, the shower, and they get up again',()=>{
 const game=new Game({random,hooks:{}}),agents=new Agents(nav,game,{random,stations:world.stations});
 Object.assign(game.hooks,{place:c=>agents.place(c),go:(c,zone,purpose)=>agents.go(c,zone,purpose),stop:c=>agents.stop(c)});
 game.start({familySize:6,petCount:0});for(const c of game.chars)c.nextReq=1e9;
 const step=1/30,tick=seconds=>{for(let t=0;t<seconds;t+=step){game.update(step);agents.update(step);}};
 const until=(cond,seconds)=>{for(let t=0;t<seconds&&!cond();t+=step){game.update(step);agents.update(step);}return cond();};
 const [penny,max,lily,sam,rosie,theo]=game.chars;for(const c of [sam,rosie,theo])c.age=20;lily.age=6;
 const sent=[penny,max,sam,rosie].filter(c=>game.act(c,'work').ok);
 assert.equal(sent.length,4,'four workers found the office');
 tick(50);
 const seated=sent.filter(c=>c.station);
 assert.equal(seated.length,3,'three chairs, three sitters');
 assert.equal(new Set(seated.map(c=>c.station.id)).size,3,'no two people on one chair');
 for(const c of seated){assert.equal(c.state,'work');const p=stationPose(c.station);assert.ok(Math.hypot(c.x-p.x,c.z-p.z)<.01,'sits on the chair');}
 assert.equal(sent.find(c=>!c.station).state,'work','the fourth worker stands at the desk');
 // Two diners take two different chairs.
 for(const c of [penny,max]){game.startRequest(c,NEEDS[0]);assert.ok(game.act(c,'serve').ok,c.name);assert.equal(c.station,null,'stood up before leaving');}
 assert.ok(until(()=>penny.station?.zone==='table'&&max.station?.zone==='table',90),'both sit at the dining table');
 assert.notEqual(penny.station.id,max.station.id,'on separate chairs');
 assert.ok(Math.hypot(penny.x-max.x,penny.z-max.z)>.6,'not on top of each other');
 assert.equal(penny.busy,'eating');
 assert.ok(until(()=>penny.state==='going',ZONES.table.stay+3),'back to the desk after eating');assert.equal(penny.station,null);
 assert.ok(until(()=>max.state==='work'&&max.station,60),'Max is back on a chair at the desk');
 game.act(max,'stop');assert.ok(until(()=>!max.station&&!max.squeeze,8),'left the chair');
 assert.ok(inWalkableArea(max.x,max.z,true,world.colliders),'standing on open floor');
 // Sleeping: a child lies in the second bedroom bed, an adult in the main bed.
 lily.age=6;   // she has been ageing a year every ten seconds during all this
 game.startRequest(lily,NEEDS[3]);assert.ok(game.act(lily,'serve').ok);
 game.startRequest(theo,NEEDS[3]);assert.ok(game.act(theo,'serve').ok);
 // Record each sleeper's bed as they reach it; naps are short and the two trips overlap.
 const beds={};
 for(let t=0;t<120&&!(beds.Lily&&beds.Theo);t+=step){game.update(step);agents.update(step);for(const c of [lily,theo])if(c.station&&!beds[c.name])beds[c.name]={station:c.station,busy:c.busy,room:roomAt(c.x,c.z)?.id};}
 assert.ok(beds.Theo,'Theo reached the main bed');assert.equal(beds.Theo.station.kind,'lie');assert.equal(beds.Theo.station.zone,'bed');assert.equal(beds.Theo.busy,'napping');assert.equal(beds.Theo.room,'bedroom');
 assert.ok(beds.Lily,'Lily reached the second bedroom bed');assert.equal(beds.Lily.station.kind,'lie');assert.equal(beds.Lily.station.zone,'kidbed');assert.equal(beds.Lily.room,'guest');
 assert.ok(until(()=>!theo.station&&!theo.squeeze,ZONES.bed.stay+8),'got out of bed');assert.ok(inWalkableArea(theo.x,theo.z,true,world.colliders),'standing on open floor beside the bed');
 // A shower in the main bathroom cubicle.
 game.startRequest(rosie,NEEDS[6]);assert.ok(game.act(rosie,'serve').ok);
 assert.ok(until(()=>rosie.station,120),'reached the shower');
 assert.equal(rosie.station?.kind,'shower');assert.equal(roomAt(rosie.x,rosie.z).id,'bath');assert.equal(rosie.busy,'showering');
 assert.ok(until(()=>!rosie.station,ZONES.tub.stay+6),'left the shower');

});
