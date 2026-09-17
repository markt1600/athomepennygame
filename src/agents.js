import {floorHeight,planPoint,FRONT_DOOR,HOUSE_VIEWS} from './house/house-layout.js';
import {ZONES} from './zones.js';
import {PETS} from './house/life.js';
import {stationPose,stationApproaches} from './stations.js';

// Moves family members, pets and the zombie along the navigation graph. The
// rules engine decides *what* happens; this layer decides where feet go.
const HOME_ROOMS=['living','living_landing','living_south','dining','passage','kitchen','hall'];
const SPAWN_VIEWS=['living','dining','kitchen','hall','corridor','wine','study','bedroom','theatre'];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const walkSpeed=c=>c.isPet?(c.kind==='dog'?.5:c.kind==='cat'?.42:.11):.95*(.55+.45*(c.size||1));

// The standing spot from which a station is used: beside it when the grid
// has room, otherwise the nearest reachable floor within a metre (a chair
// hemmed in by its neighbours is reached with a small sideways squeeze).
export function approachNode(nav,station,from=null){
 const reachable=n=>!from||nav.route(from,n,{smooth:false});
 for(const point of stationApproaches(station)){const n=nav.nearest(point.x,point.z,{maxDist:.45});if(n&&reachable(n))return n;}
 const p=stationPose(station);
 return nav.nearestNodes(p.x,p.z,{count:40,maxDist:1.6}).find(reachable)||null;
}
export class Agents{
 constructor(nav,game,{random=Math.random,petRoaming=null,stations=[]}={}){
  this.nav=nav;this.game=game;this.random=random;this.reserved=new Map();this.stations=stations;this.occupied=new Map();
  // With At Home's pet roaming attached, pets keep their own wandering, resting,
  // greeting and fetch behaviour; this layer only sends them on errands.
  this.petRoaming=petRoaming;
  const [dx,dz]=planPoint(...FRONT_DOOR.center);this.doorway={x:dx,z:dz};
  const hall=HOUSE_VIEWS.hall;this.hallSpot={x:hall[0],z:hall[2]};
 }
 roamed(c){return c.isPet&&this.petRoaming?this.petRoaming.pets.get(c.id):null;}
 place(c){
  if(c.isPet&&this.petRoaming){const p=this.petRoaming.register(c.id,PETS.find(p=>p.id===c.id).plan);Object.assign(c,{x:p.x,z:p.z,y:p.y,heading:0,path:[],idle:0,moving:false,blocked:0,spot:null});return;}
  const view=HOUSE_VIEWS[SPAWN_VIEWS[Math.floor(this.random()*SPAWN_VIEWS.length)]];
  const n=this.nav.wanderTarget({x:view[0],z:view[2]},{min:0,max:3})||this.nav.nearest(view[0],view[2]);
  c.x=n.x;c.z=n.z;c.y=n.y;c.heading=this.random()*Math.PI*2;c.path=[];c.idle=this.random()*2;c.moving=false;c.blocked=0;c.spot=null;
 }
 release(c){if(c.spot){this.reserved.delete(c.spot.key);c.spot=null;}if(c.stationTarget&&c.stationTarget!==c.station){this.occupied.delete(c.stationTarget.id);c.stationTarget=null;}}
 // A free station at the zone (a chair, a bed place, the shower…) with a
 // standing spot beside it this person can walk to. Falls back to open floor.
 stationFor(c,zone){
  for(const station of this.stations.filter(s=>s.zone===zone.id)){
   const owner=this.occupied.get(station.id);if(owner&&owner!==c)continue;
   const n=approachNode(this.nav,station,c);if(n)return {station,node:n};
  }
  return null;
 }
 // Choose a standing spot beside the zone's furniture that nobody else holds.
 spot(c,zone){
  const held=[...this.reserved].filter(([,owner])=>owner!==c).map(([k])=>this.nav.nodes.get(k)).filter(Boolean);
  const taken=n=>held.some(h=>dist(h,n)<.5);
  const nodes=this.nav.nearestNodes(zone.position[0],zone.position[1],{count:zone.seats+4,maxDist:zone.radius,exclude:taken});
  return nodes.find(n=>this.nav.route(c,n,{smooth:false}))||null;
 }
 // Using a station moves the character onto it; leaving puts them back on the
 // floor beside it so the next path starts on open floor.
 occupy(c,station){const p=stationPose(station);c.station=station;c.stationTarget=null;this.occupied.set(station.id,c);c.x=p.x;c.z=p.z;c.y=p.floor;c.heading=p.yaw;c.moving=false;c.vx=c.vz=0;}
 vacate(c){
  if(!c.station)return;const station=c.station;c.station=null;this.occupied.delete(station.id);
  const spot=approachNode(this.nav,station,null);
  if(spot){c.squeeze={x:spot.x,z:spot.z};c.heading=Math.atan2(spot.x-c.x,spot.z-c.z);}
 }
 go(c,zone,purpose){
  this.release(c);if(c.station&&!this.roamed(c))this.vacate(c);
  const use=this.roamed(c)?null:this.stationFor(c,zone),n=use?use.node:this.spot(c,zone);if(!n)return false;
  if(use){this.occupied.set(use.station.id,c);c.stationTarget=use.station;}
  if(this.roamed(c)){
   const hurry=c.kind==='tortoise'?2.6:1.5;
   // At Home's router keeps pets out of the player's personal space; someone
   // told to go somewhere while you stand over them should still set off.
   let ok=this.petRoaming.command(c.id,n,hurry);
   if(!ok){const player=this.petRoaming.player;this.petRoaming.player=null;ok=this.petRoaming.command(c.id,n,hurry);this.petRoaming.player=player;}
   if(!ok)return false;
   this.reserved.set(n.key,c);c.spot=n;c.faceZone=zone;c.errand=true;return true;
  }
  const path=this.nav.route(c,n);if(!path)return false;
  this.reserved.set(n.key,c);c.spot=n;c.path=path;c.hurry=purpose!=='resume'?1.45:1.2;c.moving=true;c.blocked=0;c.faceZone=zone;return true;
 }
 stop(c){if(this.roamed(c)){this.petRoaming.release(c.id,3);this.petRoaming.interact(c.id);c.errand=false;return;}c.path=[];c.moving=false;c.idle=.5+this.random();}
 remove(c){this.release(c);if(c.station){this.occupied.delete(c.station.id);c.station=null;}if(this.roamed(c)){this.petRoaming.release(c.id,1e9);this.petRoaming.pets.delete(c.id);return;}c.path=[];c.moving=false;}
 // Copy At Home's roaming state onto the game character each frame.
 syncPet(c){
  const p=this.roamed(c);if(!p)return;
  c.x=p.x;c.z=p.z;c.y=p.y;c.vx=p.vx||0;c.vz=p.vz||0;c.moving=!!p.moving;c.activity=p.activity;c.distance=p.distance;if(p.heading!==undefined)c.heading=p.heading;
  if(c.state==='going'&&c.errand&&p.command&&p.arrived){c.errand=false;this.petRoaming.release(c.id,c.destination?.purpose==='need'?6:2);this.face(c,c.faceZone);this.game.arrived(c);this.release(c);}
  else if(c.state==='going'&&c.errand&&!p.command){c.errand=false;this.game.travelFailed(c);this.release(c);}
 }
 // Everyone else on this floor level, plus the player, counts as someone to
 // walk around. The player is never a hard wall: after a while people squeeze past.
 obstaclesFor(c){
  const list=this.game.chars.filter(o=>o!==c&&!o.dead&&Math.abs(o.y-c.y)<.5).map(o=>({x:o.x,z:o.z,r:o.state==='work'?.3:.42,agent:o}));
  if(this.player&&Math.abs(this.player.y-c.y)<.6)list.push({x:this.player.x,z:this.player.z,r:.5,player:true});
  return list;
 }
 step(c,dt,speed){
  if(!c.path.length){c.moving=false;return 'idle';}
  const next=c.path[0],d=dist(c,next);
  if(d<.02){c.path.shift();if(!c.path.length){c.moving=false;return 'arrived';}return 'moving';}
  const dirx=(next.x-c.x)/d,dirz=(next.z-c.z)/d;let move=Math.min(d,speed*dt);
  // Give way to whoever is standing in front, follow whoever walks the same
  // way, and after a while find another route round them. Never wait forever.
  const finalApproach=c.path.length===1&&d<.7;
  let ahead=null;
  if(c.blocked>=0)for(const o of this.obstaclesFor(c)){
   const ox=o.x-c.x,oz=o.z-c.z,od=Math.hypot(ox,oz);if(od>=o.r||od<1e-6)continue;
   if((ox*dirx+oz*dirz)/od<.45)continue;
   const a=o.agent;
   if(a&&a.moving&&(a.vx*dirx+a.vz*dirz)>.2*Math.hypot(a.vx,a.vz)){move*=.6;continue;}
   if(finalApproach&&(!a||!a.moving))continue;
   ahead=o;break;
  }
  if(ahead){
   c.blocked+=dt;c.stuck=(c.stuck||0)+dt;c.moving=false;
   if(ahead.agent&&ahead.agent.state==='wander'&&!ahead.agent.path.length)ahead.agent.idle=Math.min(ahead.agent.idle,.3);
   if(c.state==='wander'){if(c.blocked>.6){c.path=[];c.idle=.3+this.random();c.blocked=0;c.stuck=0;}return 'blocked';}
   if(c.blocked>.6){
    c.blocked=0;const goal=c.path[c.path.length-1];
    const detour=this.nav.route(c,goal,{avoid:this.obstaclesFor(c).map(o=>({x:o.x,z:o.z,r:o.r+.05}))});
    if(detour&&detour.length>1&&dist(detour[1],next)>.05)c.path=detour;
   }
   if(c.stuck>2.5){c.blocked=-2.5;c.stuck=0;}   // nobody can route around: politely squeeze past for a moment
   return 'blocked';
  }
  if(c.blocked<0)c.blocked=Math.min(0,c.blocked+dt);else c.blocked=0;
  c.stuck=0;
  const nx=c.x+dirx*move,nz=c.z+dirz*move;
  c.vx=(nx-c.x)/dt;c.vz=(nz-c.z)/dt;c.x=nx;c.z=nz;c.y=floorHeight(c.x,c.z);c.moving=true;
  const target=Math.atan2(next.x-c.x,next.z-c.z);let delta=target-c.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));c.heading+=delta*Math.min(1,dt*10);
  return 'moving';
 }
 update(dt){
  if(dt<=0)return;
  for(const c of this.game.chars){
   if(this.roamed(c)){if(!c.dead)this.syncPet(c);continue;}
   c.vx=0;c.vz=0;
   if(c.dead||c.state==='doomed'||c.state==='work'){c.moving=false;if(c.state==='work'&&c.faceZone&&!c.station){this.face(c,c.faceZone);}continue;}
   if(c.squeeze){const d=dist(c,c.squeeze);if(d<.03){c.x=c.squeeze.x;c.z=c.squeeze.z;c.squeeze=null;c.moving=false;}else{const move=Math.min(d,.6*dt);c.vx=(c.squeeze.x-c.x)/d*.6;c.vz=(c.squeeze.z-c.z)/d*.6;c.x+=(c.squeeze.x-c.x)/d*move;c.z+=(c.squeeze.z-c.z)/d*move;c.y=floorHeight(c.x,c.z);c.moving=true;c.heading=Math.atan2(c.vx,c.vz);continue;}}
   if(c.state==='going'){
    const result=this.step(c,dt,walkSpeed(c)*(c.hurry||1.3));
    if(result==='arrived'){
     // The last stretch onto a chair or into a cubicle is a short squeeze
     // past the furniture, walked slowly in a straight line.
     if(c.stationTarget&&!c.squeeze){const p=stationPose(c.stationTarget);c.squeeze={x:p.x,z:p.z};c.heading=Math.atan2(p.x-c.x,p.z-c.z);continue;}
     if(c.stationTarget)this.occupy(c,c.stationTarget);else this.face(c,c.faceZone);
     this.game.arrived(c);if(c.state!=='work')this.release(c);
    }
    else if(result==='idle'){if(c.stationTarget){this.occupy(c,c.stationTarget);this.game.arrived(c);if(c.state!=='work')this.release(c);}else{this.game.travelFailed(c);this.release(c);}}
    continue;
   }
   if(c.state!=='wander'){c.moving=false;continue;}
   if(c.station){if(c.idle>0){c.idle-=dt;c.moving=false;continue;}this.vacate(c);c.idle=.4;continue;}
   if(c.path.length){this.step(c,dt,walkSpeed(c));continue;}
   c.idle-=dt;if(c.idle>0){c.moving=false;continue;}
   const n=this.nav.wanderTarget(c,{min:1.2,max:c.isPet&&c.kind==='tortoise'?2.5:7,rooms:this.random()<.6?HOME_ROOMS:null});
   const path=n&&this.nav.route(c,n);
   if(path){c.path=path;c.moving=true;}else c.idle=1+this.random()*2;
   c.idle=1.5+this.random()*4;
  }
  this.updateZombie(dt);
 }
 face(c,zone){if(!zone)return;const [zx,zz]=zone.position;c.heading=Math.atan2(zx-c.x,zz-c.z);}
 // ---- zombie ---------------------------------------------------------------
 zombieEvent(kind,z){
  if(kind==='enter'){z.x=this.doorway.x;z.z=this.doorway.z;z.y=floorHeight(z.x,z.z);z.path=this.nav.route(z,this.hallSpot)||[];z.heading=0;z.speed=.7;if(!z.path.length)this.game.zombieArrived();}
  else if(kind==='hunt'){const v=z.victim;z.path=this.nav.route(z,{x:v.x,z:v.z})||[];z.speed=.9;if(!z.path.length)this.game.zombieReached();}
  else if(kind==='leave'){z.path=this.nav.route(z,this.doorway)||[];z.speed=.8;z.leavingT=0;}
 }
 updateZombie(dt){
  const z=this.game.zombie;if(!z)return;
  if(z.phase==='entering'||z.phase==='walking'||z.phase==='leaving'){
   const result=this.zombieStep(z,dt);
   if(z.phase==='entering'&&result==='arrived')this.game.zombieArrived();
   else if(z.phase==='walking'){const v=z.victim;if(v&&dist(z,v)<.55)this.game.zombieReached();else if(result==='arrived'&&v){z.path=this.nav.route(z,{x:v.x,z:v.z})||[];if(!z.path.length)this.game.zombieReached();}}
   else if(z.phase==='leaving'){z.leavingT=(z.leavingT||0)+dt;if(result==='arrived'||z.leavingT>40)this.game.zombieLeft();}
  }
 }
 zombieStep(z,dt){
  if(!z.path?.length)return 'arrived';
  const next=z.path[0],d=dist(z,next);
  if(d<.02){z.path.shift();return z.path.length?'moving':'arrived';}
  const move=Math.min(d,z.speed*dt);z.x+=(next.x-z.x)/d*move;z.z+=(next.z-z.z)/d*move;z.y=floorHeight(z.x,z.z);z.walk=(z.walk||0)+move;
  const target=Math.atan2(next.x-z.x,next.z-z.z);let delta=target-z.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));z.heading+=delta*Math.min(1,dt*6);return 'moving';
 }
}
export {ZONES};
