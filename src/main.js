import './style.css';
import * as THREE from 'three';
import {World} from './world.js';
import {Game,RULES,fmt$} from './game.js';
import {Agents,approachNode} from './agents.js';
import {ZONES,zoneForNeed} from './zones.js';
import {roomAt} from './nav.js';
import {stationPose} from './stations.js';
import {createDoll,createBubble,Effects} from './family.js';
import {installTouchStick} from './house/touch-controls.js';
import {hasTouchInput,installGameViewport,viewportBounds} from './house/game-viewport.js';
import {pickTouchInteraction} from './house/touch-targets.js';
import {moveAlongFloor} from './house/navigation.js';

import {HomeSound} from './house/home-sound.js';
import {RecordPlayer} from './house/record-player.js';
import {clawControlsHTML,mountClawControls} from './house/claw-game.js';
import {pinballControlsHTML,mountPinballControls} from './house/pinball-game.js';
import {play,setMuted,isMuted} from './audio.js';
import {fetchBoard,submitScore,renderBoard,LS_BEST,LS_NAME} from './leaderboard.js';
import {PETS} from './house/life.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
installGameViewport();
const touchMode=()=>hasTouchInput()||document.documentElement.classList.contains('touch-device');
// A phone: a touch screen with little room. The HUD shrinks, off-screen needs
// stack in a tray under it instead of floating around the edges, and the
// roster folds to a chip so the thumb stick and buttons stay clear.
const phoneQuery=matchMedia('(max-width:700px),(max-height:520px)');
const isPhone=()=>touchMode()&&phoneQuery.matches;
let hudBottom=80;
function syncLayout(){
 document.documentElement.classList.toggle('phone',isPhone());
 const hud=$('#hud');if(hud&&!hud.hidden){hudBottom=hud.offsetTop+hud.offsetHeight;$('#app').style.setProperty('--hud-bottom',hudBottom+'px');}
}
phoneQuery.addEventListener('change',syncLayout);
const ROOM_NAMES={living:'living room',living_landing:'living room',living_south:'dining threshold',hall:'entrance hall',lobby:'lift lobby',passage:'hallway',dining:'dining room',balcony:'living balcony',dining_bay:'dining balcony',kitchen:'kitchen',bedroom:'main bedroom',guest:'second bedroom',study:'home office',wine:'wine cellar',theatre:'window lounge',bath:'main bathroom',powder:'powder room',vanity:'vanity',wardrobe:'wardrobe',meditation:'meditation alcove',utility:'utility yard',service_hall:'service passage',service_bath:'service bathroom',service_room:'service room',store:'store room',east_hall:'bedroom entrance',guest_bath:'second bathroom'};
const roomName=(x,z)=>ROOM_NAMES[roomAt(x,z)?.id]||'somewhere in the house';
const clockLabel=hours=>{const h=((hours%24)+24)%24,m=Math.floor(h*60);return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;};
const MOVIE='/art/telescope/galaxy.mp4';

let familySize=4,petCount=1,bestScore=Number(localStorage.getItem(LS_BEST)||0),scoreSaved=false,lastResult=null;
let zombieDoll=null,disposeStick=()=>{},disposeMiniGame=()=>{},miniGame=null,movie=null,hudTimer=0,rosterTimer=0,logTimer=null,commandFor=null;
const markers=new Map();

// ---- world, rules and movement -------------------------------------------
let game=null,agents=null;   // assigned below; the world starts its frame loop immediately
const world=new World($('#scene'),{onTick:tick,onLook:updateLookHint,onStatus:updateLoading});
const effects=new Effects(world.scene);
const sound=new HomeSound();
const recordPlayer=new RecordPlayer(sound,{onChange:spinning=>{world.recordPlaying=spinning;updateLookHint(world.lookTarget);},onMessage:toast,onStart:()=>world.turntable.start(),beforePlay:()=>world.turntable.ready(),onStop:()=>world.turntable.stop()});
game=new Game({hooks:{
 log:logMsg,
 sfx:play,
 fx:(type,c,text,color)=>{if(type==='income'){flash($('#money'),'flash-green');return;}if(!c)return;effects.add(type,new THREE.Vector3(c.x,c.y+(c.isPet?c.height+.3:1.75*(c.size||1)),c.z),text,color);},
 place:c=>agents.place(c),
 go:(c,zone,purpose)=>agents.go(c,zone,purpose),
 stop:c=>agents.stop(c),
 died:c=>{agents.remove(c);const entry=world.characters.get(c.id);if(entry){entry.group.visible=false;}effects.add('ghost',new THREE.Vector3(c.x,c.y+.6,c.z));effects.memorial(new THREE.Vector3(c.x,c.y,c.z),c.name);if(commandFor===c.id)closeCommand();},
 over:result=>{lastResult=result;setTimeout(showGameOver,1800);},
 zombie:(kind,z)=>{agents.zombieEvent(kind,z);if(kind==='enter'){zombieDoll=createDoll({name:'Zombie'},{zombie:true});zombieDoll.scale.setScalar(1.05);world.scene.add(zombieDoll);}if(kind==='gone'&&zombieDoll){world.scene.remove(zombieDoll);zombieDoll=null;}if(kind==='hunt'&&commandFor===z.victim?.id)closeCommand();},
 broke:()=>flash($('#money'),'flash-red'),
}});
agents=new Agents(world.nav,game,{petRoaming:world.petRoaming,stations:world.stations});
world.onInteract=interact;
world.onUnlock=()=>{if(game.running&&!commandFor&&!miniGame)showPause();};
world.onTap=(x,y)=>{
 if(!game.running||world.paused)return;
 const id=world.pickCharacter(x,y);if(id){openCommand(id);return;}
 const hit=pickTouchInteraction(world,x,y);if(!hit)return;
 if(hit.type==='pet')openCommand(hit.id);else if(hit.type==='fixture'||hit.type==='object')activateTarget(hit.id,hit.ray);
};
world.onHouseMessage=toast;
world.onStep=()=>{if(!isMuted())sound.step();};
world.onClawPlay=()=>openMiniGame('claw');
world.onPinballPlay=()=>openMiniGame('pinball');
world.onCinemaPlay=()=>world.cinema.active?stopCinema():startCinema();
world.onHandRecordCancel=()=>recordPlayer.stop();
world.onBoneChange=()=>{};
const LS_QUALITY='athome_penny_quality';
const liteRequested=new URLSearchParams(location.search).get('lite')==='1'||localStorage.getItem(LS_QUALITY)==='low';
if(liteRequested)world.setQuality('low');
$('#liteMode').checked=world.quality==='low';
$('#liteMode').onchange=e=>{world.setQuality(e.target.checked?'low':'high');try{localStorage.setItem(LS_QUALITY,world.quality);}catch{}};
world.onQuality=level=>{$('#liteMode').checked=level==='low';if(level==='low')toast('Switched to performance mode to keep the frame rate up (mirrors off, lighter shadows). Change it on the start screen.');};

const stats={tickMs:0,frameMs:0,frames:0};
function tick(dt,active){
 if(!game)return;
 const started=performance.now();
 const running=game.running&&!world.paused;
 if(running){game.update(dt);agents.player=world.feetPosition;agents.update(dt);world.hours=game.hours;sound.update(dt,game.hours,world.room.includes('balcony'));autopilot.update(dt);}
 else if(!game.running)world.hours+=dt/40;
 world.powderDoor.update(dt,agents.occupied.get('toilet-0')?.station?.id==='toilet-0',world.feetPosition);
 syncVisuals(running?dt:0);
 effects.update(running?dt:0);
 if(game.running||lastResult){hudTimer+=dt;rosterTimer+=dt;if(hudTimer>.1){hudTimer=0;updateHUD();}if(rosterTimer>.25){rosterTimer=0;updateRoster();}updateMarkers();}
 stats.tickMs+=(performance.now()-started-stats.tickMs)*.05;stats.frameMs+=(dt*1000-stats.frameMs)*.05;stats.frames++;
}

function syncVisuals(dt){
 for(const c of game.chars){
  const entry=world.characters.get(c.id);if(!entry)continue;const g=entry.group;
  if(c.dead){g.visible=false;continue;}
  if(c.isPet){g.userData.bubble?.update(dt,bubbleFor(c));continue;}   // the world moves At Home's pet sprites
  g.scale.setScalar(c.size);
  if(c.station){
   const p=stationPose(c.station),kind=c.station.kind,options={...bubbleFor(c),pose:kind,busy:c.busy};
   if(kind==='sit'){g.position.set(p.x,p.top-.5*c.size,p.z);g.rotation.set(0,p.yaw,0,'YXZ');}
   else if(kind==='lie'){g.position.set(p.x-p.fx*.8*c.size,p.top+.17*c.size,p.z-p.fz*.8*c.size);g.rotation.set(-Math.PI/2,Math.atan2(-p.fx,-p.fz),0,'YXZ');}
   else{g.position.set(p.x,p.floor,p.z);g.rotation.set(0,p.yaw,0,'YXZ');}
   g.userData.update(dt,c.state,false,0,options);
  }
  else{g.position.set(c.x,c.y,c.z);g.rotation.set(0,c.heading||0,0,'YXZ');g.userData.update(dt,c.state,c.moving,Math.hypot(c.vx||0,c.vz||0)/Math.max(.5,c.size),bubbleFor(c));}
 }
 const z=game.zombie;
 if(z&&zombieDoll){zombieDoll.position.set(z.x,z.y,z.z);zombieDoll.rotation.y=z.heading||0;const moving=['entering','walking','leaving'].includes(z.phase)&&z.path?.length>0;zombieDoll.userData.update(dt,'zombie',moving,z.speed||.7,z.phase==='choosing'?{emoji:'🧟',urgency:1-z.timer/RULES.ZOMBIE_CHOICE_TIME,pulse:true}:z.phase==='eating'?{emoji:'😈',tint:'#b71c1c',pulse:true}:{emoji:'🧟',tint:'#33691e'});}
}
function bubbleFor(c){
 if(c.state==='request'&&c.need)return {emoji:c.need.emoji,urgency:1-c.reqT/RULES.REQUEST_TIME,pulse:c.reqT<10};
 if(c.state==='going'&&c.destination)return {emoji:ZONES[c.destination.zone].emoji,tint:'#1565c0'};
 if(c.state==='work')return {emoji:'💼',tint:'#1565c0'};
 if(c.state==='happy')return {emoji:{eating:'🍽️',napping:'💤',resting:'☕',showering:'🚿','on the toilet':'🚽',exercising:'🏋️',playing:'🎮'}[c.busy]||'💕',tint:'#e91e63'};
 if(c.state==='tickle')return {emoji:'🤭',tint:'#e91e63'};
 if(c.state==='doomed')return {emoji:'😱',tint:'#b71c1c',pulse:true};
 return {};
}

// ---- HUD, roster, markers ---------------------------------------------------
const stat=(id,value)=>{const el=$('#'+id);if(el&&el.firstChild.textContent!==String(value))el.firstChild.textContent=value;};
function updateHUD(){
 const g=game;
 stat('score',Math.floor(g.score));stat('best',bestScore);stat('money',fmt$(g.money));stat('income',Math.ceil(g.incomeT)+'s');
 stat('alive',g.chars.filter(c=>!c.dead&&!c.isPet).length+(g.chars.some(c=>c.isPet)?' +'+g.chars.filter(c=>!c.dead&&c.isPet).length+'🐾':''));
 stat('timeS',g.timeLabel());stat('served',g.served);stat('earned',fmt$(g.earned));
 const human=Math.min(RULES.COST_CAP,RULES.HUMAN_BASE_COST+Math.floor(g.elapsed/60)),pet=Math.min(RULES.COST_CAP,RULES.PET_BASE_COST+Math.floor(g.elapsed/60));
 stat('cost',`$${human} / $${pet}`);
 const clock=$('#clock');if(clock)clock.firstChild.textContent=clockLabel(g.hours);
 syncLayout();
}
function statusFor(c){
 if(c.dead)return c.deathType==='sleep'?'😇 passed away peacefully':c.deathType==='eaten'?'🧟 eaten by the zombie':'💀 gone';
 if(c.state==='request'&&c.need)return `${c.need.emoji} ${c.need.want} · ${Math.ceil(c.reqT)}s`;
 if(c.state==='going'&&c.destination)return `🚶 off to the ${ZONES[c.destination.zone].label}`;
 if(c.state==='work')return `💼 working · $${game.workPay(c)} in ${Math.ceil(RULES.WORK_PAY_EVERY-c.workTimer)}s`;
 if(c.state==='happy')return {eating:'🍽️ eating at the table',napping:'💤 napping in bed',resting:'☕ resting on the sofa',showering:'🚿 in the shower','on the toilet':'🚽 on the toilet',exercising:'🏋️ exercising',playing:'🎮 playing'}[c.busy]||'💕 feeling great';
 if(c.state==='tickle')return '🤭 giggling';
 if(c.state==='doomed')return '😱 frozen in fear';
 if(c.isPet)return {sleep:'💤 napping',lounge:'😸 lounging',groom:'🧼 grooming',chew:'🦴 chewing the bone',play:'🎾 playing together'}[c.activity]||'🐾 pottering about';
 return '🙂 wandering';
}
function updateRoster(){
 const list=$('#roster ol');if(!list)return;
 const rows=game.chars.map(c=>{
  const urgency=c.state==='request'?1-c.reqT/RULES.REQUEST_TIME:0;
  const cls=c.dead?'dead':c.state==='request'?(urgency>.65?'urgent':'needs'):c.state==='doomed'?'urgent':'';
  return `<li class="${cls}"><span class="who">${c.isPet?c.emoji:c.gender==='f'?'👩':'👨'} <b>${c.name}</b><small>${c.isPet?c.kind:'age '+c.age}</small></span><span class="what">${statusFor(c)}</span><span class="where">${c.dead?'':'📍 '+roomName(c.x,c.z)}</span></li>`;
 });
 const html=rows.join('');if(list.dataset.html!==html){list.dataset.html=html;list.innerHTML=html;}
}
const project=new THREE.Vector3();
function updateMarkers(){
 const host=$('#markers');if(!host)return;
 const wanted=new Map();
 if(game.running){
  for(const c of game.chars){if(c.dead)continue;if(c.state==='request'&&c.need)wanted.set(c.id,{x:c.x,y:c.y+(c.isPet?c.height+.55:2.05*c.size),z:c.z,emoji:c.need.emoji,text:`${c.name} ${c.need.want}`,time:`${Math.ceil(c.reqT)}s`,need:true,urgency:1-c.reqT/RULES.REQUEST_TIME});else if(c.state==='doomed')wanted.set(c.id,{x:c.x,y:c.y+2*c.size,z:c.z,emoji:'😱',text:c.name,urgency:1});}
  const z=game.zombie;if(z&&z.phase==='choosing')wanted.set('zombie',{x:z.x,y:z.y+2.2,z:z.z,emoji:'🧟',text:'FEED ME!',time:`${Math.ceil(z.timer)}s`,need:true,urgency:1});
 }
 for(const [id,el] of markers)if(!wanted.has(id)){el.remove();markers.delete(id);}
 const b=viewportBounds(),cam=world.camera;const feet=world.feetPosition,phone=isPhone();let trayRow=0;
 const ordered=phone?[...wanted].sort((a,b)=>(b[1].urgency||0)-(a[1].urgency||0)):wanted;
 for(const [id,m] of ordered){
  let el=markers.get(id);if(!el){el=document.createElement('div');el.className='marker';host.append(el);markers.set(id,el);}
  project.set(m.x,m.y,m.z).project(cam);
  const behind=project.z>1;let sx=(project.x+1)/2*b.width,sy=(1-project.y)/2*b.height;
  if(behind){sx=b.width-sx;sy=b.height*.9;}
  const margin=70,inside=!behind&&sx>margin&&sx<b.width-margin&&sy>margin&&sy<b.height-margin;
  const distance=Math.hypot(m.x-feet.x,m.z-feet.z);
  if(!inside){
   // Point along the edge of the screen toward whoever is out of view.
   const cx=b.width/2,cy=b.height/2;let dx=sx-cx,dy=sy-cy;if(behind){dx=-dx;dy=Math.abs(dy)||1;}
   const scale=Math.min((cx-margin)/Math.abs(dx||1e-6),(cy-margin)/Math.abs(dy||1e-6));sx=cx+dx*scale;sy=cy+dy*scale;
   const angle=Math.atan2(dy,dx)*180/Math.PI;
   el.innerHTML=`<i style="transform:rotate(${angle}deg)">➤</i><b>${m.emoji}</b><span>${m.need?'<em>Go help</em> ':''}${m.text}${m.time?` · ${m.time}`:''} · ${distance.toFixed(0)}m</span>`;
   if(phone){   // stacked under the HUD, most urgent first, instead of floating around the edges
    el.className='marker edge tray'+(trayRow?'':' first')+(m.urgency>.65?' urgent':m.urgency>.35?' warm':'');
    el.style.left='8px';el.style.top=`${hudBottom+6+trayRow*31}px`;el.style.display=trayRow<5?'':'none';trayRow++;continue;
   }
  }else el.innerHTML=`<b>${m.emoji}</b><span>${m.text}${m.time?` · ${m.time}`:''}</span>`;
  el.className='marker'+(m.urgency>.65?' urgent':m.urgency>.35?' warm':'')+(inside?'':' edge');
  // Keep the whole pill on screen (long names used to run off the right edge). The
  // urgent beat animates transform, so position with left/top.
  const hw=el.offsetWidth/2+4,hh=el.offsetHeight+4;sx=Math.max(hw,Math.min(b.width-hw,sx));sy=Math.max(hh,Math.min(b.height-4,sy));
  el.style.display='';el.style.left=`${sx}px`;el.style.top=`${sy}px`;
 }
}
function updateLookHint(id){
 const el=$('#look-hint');if(!el)return;
 const c=id&&game?.chars.find(c=>c.id===id);const key=touchMode()?'Tap':'Click';
 const fixture=id&&world.houseInteractions.label(id);
 el.textContent=c&&!c.dead?`${key} · talk to ${c.name}`:fixture?`${key} · ${fixture}`:id==='turntable'?`${key} · ${recordPlayer.enabled?(world.turntable.busy?world.turntable.label:'Stop the record'):'Play the record'}`:'';
}
function flash(el,cls){if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}
function logMsg(msg,color){const el=$('#log');el.textContent=msg;el.style.color=color||'';el.classList.add('show');clearTimeout(logTimer);logTimer=setTimeout(()=>el.classList.remove('show'),isPhone()?4200:6000);}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3800);}

// ---- autopilot: runs round the house sorting everyone out ------------------
// Walks the player along the navigation graph to whoever is asking for
// something (most urgent first), faces them and gives the order, and puts
// idle adults to work when nobody needs anything. Any walk or stick input
// hands control back.
const autopilot={on:false,target:null,action:null,path:[],spots:[],spotIndex:0,spotTries:0,wait:0,faceT:0,retry:new Map(),drive:{x:0,z:0},progress:null,stuckT:0,reroutes:0,
 toggle(force,quiet=false){
  this.on=force??!this.on;this.target=null;this.path=[];this.wait=0;this.drive={x:0,z:0};if(world.touchMove.x||world.touchMove.z)world.touchMove={x:0,z:0};
  $('#autoBtn').classList.toggle('on',this.on);$('#touch-auto').classList.toggle('on',this.on);
  if(!quiet)toast(this.on?'🤖 Autopilot on: I will run round and sort everyone out. Walk or use the stick to take over.':'🤖 Autopilot off, you have the controls.');
 },
 pick(){
  const now=game.elapsed,feet=world.feetPosition,near=c=>Math.hypot(c.x-feet.x,c.z-feet.z),fresh=c=>(this.retry.get(c.id)||0)<=now;
  const needs=game.chars.filter(c=>!c.dead&&c.state==='request'&&c.need&&fresh(c)).sort((a,b)=>a.reqT-b.reqT);
  if(needs.length)return {c:needs[0],action:'serve'};
  const workers=game.chars.filter(c=>!c.dead&&(c.state==='work'||c.destination?.purpose==='work'||c.destination?.purpose==='resume')).length;
  if(workers<2){const idle=game.chars.filter(c=>!c.dead&&!c.isPet&&c.state==='wander'&&c.age>=12&&c.age<=60&&fresh(c)).sort((a,b)=>near(a)-near(b));if(idle.length)return {c:idle[0],action:'work'};}
  return null;
 },
 // A node the player can actually step to from where they stand, so a route
 // never starts on the far side of a wall or a cabinet.
 startNode(){
  const feet=world.feetPosition;
  for(const n of world.nav.nearestNodes(feet.x,feet.z,{count:10,maxDist:1.4})){const m=moveAlongFloor(feet.x,feet.z,n.x-feet.x,n.z-feet.z,world.colliders);if(Math.hypot(m.x-n.x,m.z-n.z)<.03)return n;}
  return world.nav.nearest(feet.x,feet.z);
 },
 route(c){
  // Standing spots: the chair's own approach spot for someone seated, then open
  // floor around them, in their room first so a wall never sits between us.
  const feet=world.feetPosition,room=roomAt(c.x,c.z)?.id,near=n=>Math.hypot(n.x-feet.x,n.z-feet.z);
  const spots=world.nav.nearestNodes(c.x,c.z,{count:12,maxDist:1.4,exclude:n=>Math.hypot(n.x-c.x,n.z-c.z)<.7}).sort((a,b)=>((roomAt(b.x,b.z)?.id===room)-(roomAt(a.x,a.z)?.id===room))||near(a)-near(b));
  const seat=c.station&&approachNode(world.nav,c.station,feet);
  this.spots=seat?[seat,...spots.filter(n=>n!==seat)]:spots;
  this.spotIndex=0;this.spotTries=0;return this.routeToSpot();
 },
 routeToSpot(smooth=true){
  const start=this.startNode();if(!start){this.path=[];return false;}
  while(this.spotIndex<this.spots.length&&this.spotTries<4){
   const path=world.nav.route(start,this.spots[this.spotIndex++],{smooth});this.spotTries++;
   if(path){this.path=path;this.faceT=0;this.progress={x:world.feetPosition.x,z:world.feetPosition.z};this.stuckT=0;return true;}
  }
  this.path=[];return false;
 },
 giveUp(c,seconds){this.retry.set(c.id,game.elapsed+seconds);this.target=null;this.path=[];this.drive={x:0,z:0};world.touchMove={x:0,z:0};this.wait=.3;},
 turn(dt,desiredYaw,desiredPitch=0,rate=7){
  let d=desiredYaw-world.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));const k=Math.min(1,dt*rate);
  world.yaw+=d*k;world.pitch+=(desiredPitch-world.pitch)*k;return Math.abs(d)<.12;
 },
 update(dt){
  if(!this.on)return;
  // Any key or a stick position we did not set ourselves hands control back.
  const tm=world.touchMove;
  if(Object.values(world.keys).some(Boolean)||Math.abs(tm.x-this.drive.x)>1e-6||Math.abs(tm.z-this.drive.z)>1e-6){this.toggle(false);return;}
  if(commandFor||miniGame||world.handInteraction.active){this.drive={x:0,z:0};world.touchMove={x:0,z:0};return;}
  if(this.wait>0){this.wait-=dt;return;}
  const goal=this.pick();
  if(!goal){this.target=null;this.path=[];this.drive={x:0,z:0};world.touchMove={x:0,z:0};return;}
  const c=goal.c;
  if(this.target!==c.id){this.target=c.id;this.action=goal.action;this.anchor={x:c.x,z:c.z};this.reroutes=0;if(!this.route(c)){this.giveUp(c,4);return;}}
  if(Math.hypot(c.x-this.anchor.x,c.z-this.anchor.z)>.9){this.anchor={x:c.x,z:c.z};if(!this.route(c)){this.giveUp(c,4);return;}}   // they moved on
  const feet=world.feetPosition,cam=world.camera.position;
  const dist=Math.hypot(c.x-feet.x,c.z-feet.z),level=Math.abs(c.y-feet.y)<.7;
  const doll=world.characters.get(c.id)?.group,head=doll&&world.aimPoints(c,doll)[0],visible=head&&head.distanceTo(cam)<3&&!world.occluded(head,head.distanceTo(cam));
  if(!this.path.length||dist<1.15&&level&&visible){
   // Close enough: stop, face them and give the order once we can see their head
   // (the aim itself may have settled on a neighbour standing shoulder to shoulder).
   this.drive={x:0,z:0};world.touchMove={x:0,z:0};
   const headY=(doll?.position.y??c.y)+(c.isPet?c.height*.6:1.25*c.size);
   const facing=this.turn(dt,Math.atan2(-(c.x-cam.x),-(c.z-cam.z)),Math.atan2(headY-cam.y,Math.hypot(c.x-cam.x,c.z-cam.z)),9);
   this.faceT+=dt;
   if(facing&&(world.lookTarget===c.id||visible)){
    const a=game.actionsFor(c).find(a=>a.id===this.action);
    if(a&&!a.disabled){const r=game.act(c,a.id);if(r.ok)logMsg('🤖 '+a.label,'#1565c0');else toast(r.message);}
    this.giveUp(c,a&&!a.disabled?2:8);return;
   }
   if(this.faceT>1.4){   // still not aimed at them: try another standing spot, then leave them for a while
    if(dist>3.4||!this.routeToSpot())this.giveUp(c,6);
   }
   return;
  }
  // Follow the path through the normal walking code (collisions, stairs, furniture pushing) by driving the stick.
  const next=this.path[0],dx=next.x-feet.x,dz=next.z-feet.z,d=Math.hypot(dx,dz);
  if(d<.2){this.path.shift();if(!this.path.length){this.drive={x:0,z:0};world.touchMove={x:0,z:0};}return;}
  const yaw=world.yaw,ux=dx/d,uz=dz/d,lx=ux*Math.cos(yaw)-uz*Math.sin(yaw),lz=ux*Math.sin(yaw)+uz*Math.cos(yaw);
  this.drive={x:lx,z:lz};world.touchMove=this.drive;world.eyeHeight=1.67;
  this.turn(dt,Math.atan2(-ux,-uz),-.06);
  // No progress for a while: re-plan from where we really are, and after a few tries leave this one.
  if(Math.hypot(feet.x-this.progress.x,feet.z-this.progress.z)>.25){this.progress={x:feet.x,z:feet.z};this.stuckT=0;}
  else if((this.stuckT+=dt)>1.2){   // jammed on a corner: retrace the grid path node by node, then try another spot, then leave them
   this.stuckT=0;if(++this.reroutes>3){this.giveUp(c,6);return;}
   this.spotIndex=Math.max(0,this.spotIndex-(this.reroutes<3?1:0));this.spotTries=0;if(!this.routeToSpot(false))this.giveUp(c,6);
  }
 },
};

// ---- talking to the family, using the house --------------------------------
function interact(){
 if(!game.running||world.paused||commandFor||miniGame)return;
 if(world.handInteraction.active){if(world.lookTarget==='turntable'&&world.handInteraction.owner===world.turntable)toggleRecord();return;}
 const id=world.lookTarget;if(!id)return;
 if(world.characters.has(id))openCommand(id);else activateTarget(id);
}
function activateTarget(id,ray=null){
 if(world.handInteraction.active&&!(id==='turntable'&&world.handInteraction.owner===world.turntable))return;
 if(world.houseInteractions.items.has(id)){world.houseInteractions.activate(id,ray);return;}
 if(id==='turntable')toggleRecord();
}
async function toggleRecord(){if(world.cinema.active)stopCinema();try{await recordPlayer.toggle();}catch{toast('Music could not start. Try the turntable again.');}}
function startCinema(){
 recordPlayer.suspend();world.cinema.enter();world.cinema.volume=isMuted()?0:.65;
 movie=document.createElement('video');movie.src=MOVIE;movie.loop=true;movie.playsInline=true;movie.muted=isMuted();movie.preload='auto';movie.load();
 world.cinema.attachVideo(movie);world.cinema.onReady=()=>movie.play().catch(()=>toast('The projector could not start. Try again.'));
 toast('The curtains close and the projector warms up… a little closer to the stars.');updateLookHint(world.lookTarget);
}
function stopCinema(){if(!world.cinema.active)return;world.cinema.leave();if(movie){movie.pause();movie.removeAttribute('src');movie.load();movie=null;}recordPlayer.resume();updateLookHint(world.lookTarget);}
function openCommand(id){
 const c=game.chars.find(c=>c.id===id);if(!c||c.dead)return;
 const dialog=$('#command');commandFor=id;world.paused=true;world.unlock();
 if(c.isPet)world.petRoaming.interact(c.id);
 renderCommand(c);document.body.classList.add('panel-open');
 if(!dialog.open)dialog.showModal();play('open');
}
function renderCommand(c){
 const dialog=$('#command'),actions=game.actionsFor(c);
 const zone=c.state==='request'&&c.need?zoneForNeed(c,c.need):null;
 const intro=c.state==='request'&&c.need?`${c.need.emoji} ${c.name} ${c.need.want}. ${Math.ceil(c.reqT)}s left — the ${zone.label} is ${zone.hint}.`:c.state==='work'?`${c.name} is on the clock at the office desk.`:c.state==='going'&&c.destination?`${c.name} is on the way to the ${ZONES[c.destination.zone].label}.`:c.isPet?`${c.name} the ${c.kind} looks up at you.${c.kind==='dog'?' His bone is somewhere in the house — pick it up and throw it for a game of fetch.':''}`:`${c.name} is ${c.age}${c.age<12?' — too young to work':c.age>60?' and enjoying retirement':''}.`;
 dialog.innerHTML=`<button class="close" data-action="close" aria-label="Close">×</button><div class="eyebrow">${c.isPet?c.kind:'age '+c.age+' · health '+c.health}</div><h2>${c.name}</h2><p class="panel-intro">${intro}</p><div class="stack">${actions.map((a,i)=>`<button data-action="${a.id}" ${a.disabled?'disabled':''} class="${a.danger?'danger':''}"><kbd>${i+1}</kbd><span class="label">${a.label}${a.detail?`<small>${a.detail}</small>`:''}${a.disabled?`<small class="why">${a.disabled}</small>`:''}</span></button>`).join('')||'<p class="fine">Nothing to do right now — they are busy.</p>'}</div><button class="ghost" data-action="close">Leave them be${touchMode()?'':' · Esc'}</button>`;
 dialog.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>choose(button.dataset.action));
 dialog.querySelector('.stack button:not(:disabled)')?.focus({preventScroll:true});
}
function choose(action){
 const c=game.chars.find(c=>c.id===commandFor);
 if(action!=='close'&&c){const r=game.act(c,action);if(!r.ok&&r.message)toast(r.message);if(r.ok&&c.isPet&&action==='serve')world.showCare(c.id);}
 closeCommand();
}
function closeCommand(){
 const dialog=$('#command');commandFor=null;document.body.classList.remove('panel-open');if(dialog.open)dialog.close();
 if(game.running&&!$('#paused').classList.contains('show')){world.paused=false;world.lock();}
}
$('#command').addEventListener('cancel',e=>{e.preventDefault();closeCommand();});
$('#command').addEventListener('keydown',e=>{const digit=e.code.match(/^(?:Digit|Numpad)([1-9])$/)?.[1];if(digit){const b=$(`#command .stack button:nth-of-type(${digit})`);if(b&&!b.disabled){e.preventDefault();b.click();}}});
// The claw and pinball machines: At Home's own controls in a small panel while
// the family waits.
function openMiniGame(type){
 if(miniGame||!game.running)return;
 const dialog=$('#minigame');miniGame=type;world.paused=true;world.unlock();document.body.classList.add('panel-open');
 dialog.className='panel game-panel '+type+'-panel';
 dialog.innerHTML=`<button class="close" data-action="close" aria-label="Close">×</button><div id="minigame-content">${type==='claw'?clawControlsHTML(touchMode()):pinballControlsHTML(touchMode())}</div><button class="ghost" data-action="close">Step away${touchMode()?'':' · Esc'}</button>`;
 dialog.querySelectorAll('[data-action=close]').forEach(b=>b.onclick=closeMiniGame);
 const gameObject=type==='claw'?world.clawGame:world.pinballGame;gameObject.enter(world);
 disposeMiniGame=(type==='claw'?mountClawControls:mountPinballControls)($('#minigame-content'),gameObject);
 if(!dialog.open)dialog.showModal();
}
function closeMiniGame(){
 if(!miniGame)return;disposeMiniGame();disposeMiniGame=()=>{};(miniGame==='claw'?world.clawGame:world.pinballGame).leave();miniGame=null;
 const dialog=$('#minigame');document.body.classList.remove('panel-open');if(dialog.open)dialog.close();
 if(game.running){world.paused=false;world.lock();}
}
$('#minigame').addEventListener('cancel',e=>{e.preventDefault();closeMiniGame();});

// ---- pause, setup, game over ----------------------------------------------
function showPause(){if(!game.running)return;world.paused=true;world.unlock();$('#paused').classList.add('show');$('#resumeBtn').focus({preventScroll:true});}
function resume(){$('#paused').classList.remove('show');if(!game.running)return;world.paused=false;world.lock();}
function showSetup(){
 $('#gameover').classList.remove('show');$('#paused').classList.remove('show');$('#setup').classList.add('show');
 world.mode='menu';world.paused=false;world.unlock();$('#hud').hidden=true;$('#roster').hidden=true;document.body.classList.remove('playing');
 refreshBoards();
}
function startGame(){
 if(!world.artwork.ready)return;
 closeCommand();closeMiniGame();stopCinema();recordPlayer.stop();
 autopilot.toggle(false,true);world.clearCharacters();world.resetHouse();effects.clear();if(zombieDoll){world.scene.remove(zombieDoll);zombieDoll=null;}
 for(const el of markers.values())el.remove();markers.clear();
 lastResult=null;scoreSaved=false;
 game.start({familySize,petCount});
 for(const c of game.chars){
  if(c.isPet){const g=world.createPet(c.id);const bubble=createBubble();bubble.position.y=c.height+.42;bubble.scale.setScalar(.5);g.add(bubble);g.userData.bubble=bubble;world.characters.set(c.id,{c,group:g});}
  else world.addCharacter(c,createDoll(c));
 }
 world.petBone.bind(game.chars.some(c=>c.id==='sunny')?{bone:null}:null);
 world.focus('hall');world.mode='play';world.paused=false;
 $('#setup').classList.remove('show');$('#gameover').classList.remove('show');$('#paused').classList.remove('show');
 $('#hud').hidden=false;$('#roster').hidden=false;document.body.classList.add('playing');
 disposeStick();if(touchMode())disposeStick=installTouchStick($('.touch-stick'),world);
 updateHUD();updateRoster();$('#controls').textContent=touchMode()?'Left thumb to walk · drag to look · tap a family member to talk · tap fixtures to use them · 🤖 runs round for you':'WASD to walk · mouse to look · click to talk or use things · P pause · Z summons a zombie · X autopilot';
 if(!isMuted())sound.start().catch(()=>{});
 world.lock();world.petRoaming.greet(world.camera.position,world.yaw);
}
function showGameOver(){
 const r=lastResult;if(!r)return;
 const isNewBest=r.score>bestScore;if(isNewBest){bestScore=r.score;localStorage.setItem(LS_BEST,String(bestScore));}
 $('#goTitle').textContent='💀 The whole family is gone...';$('#newHigh').hidden=!isNewBest;
 $('#goStats').innerHTML=`⭐ Final score: <b>${r.score}</b> (best: ${bestScore})<br>You survived <b>${r.time}</b><br>Requests served: <b>${r.served}</b><br>Earned at the desk: <b>${fmt$(r.earned)}</b><br>Money left: <b>${fmt$(r.money)}</b>`;
 const saveBtn=$('#saveScoreBtn');saveBtn.disabled=false;saveBtn.textContent='Save score 🏆';$('#nameInput').value=localStorage.getItem(LS_NAME)||'';
 closeCommand();closeMiniGame();world.paused=true;world.unlock();document.body.classList.remove('playing');
 $('#gameover').classList.add('show');refreshBoards();
}
$('#saveScoreBtn').onclick=async()=>{
 if(scoreSaved||!lastResult)return;const btn=$('#saveScoreBtn');
 const name=($('#nameInput').value.trim()||'Anonymous').slice(0,20);localStorage.setItem(LS_NAME,name);
 btn.disabled=true;btn.textContent='Saving…';
 await submitScore({name,score:lastResult.score,time:lastResult.time,served:lastResult.served,justSaved:true});
 scoreSaved=true;btn.textContent='Saved! ✔';
 const list=await fetchBoard();list.forEach(e=>{if(e.name===name&&e.score===lastResult.score)e.justSaved=true;});
 renderBoard($('#goBoard'),list,name);renderBoard($('#setupBoard'),list,name);
};
async function refreshBoards(){const list=await fetchBoard();renderBoard($('#setupBoard'),list);renderBoard($('#goBoard'),list);}
function updateLoading(status){
 const note=$('#loading'),progress=$('#loading progress'),label=$('#loading span'),retry=$('#retryBtn');
 $('#startBtn').disabled=!status.ready;note.hidden=status.ready;
 progress.max=status.total;progress.value=status.loaded;
 label.textContent=status.loading?`Please wait… ${status.preparing?'finishing':'loading'} the house — ${Math.round(status.loaded/status.total*100)}%`:status.ready?'':'Some artwork could not load. Check your connection and try again.';
 retry.hidden=status.loading||status.ready;
}
$('#retryBtn').onclick=()=>world.loadArtwork();
// On phones the roster folds down to whoever needs something; tap its title to see everyone.
$('#roster h3').onclick=()=>$('#roster').classList.toggle('collapsed');
$('#rosterBtn').onclick=()=>$('#roster').classList.toggle('collapsed');
if(touchMode())$('#roster').classList.add('collapsed');

// ---- setup controls ---------------------------------------------------------
function famPreview(){
 const kids=familySize-2,kidStr=kids===1?'1 newborn 👶':`${kids} kids (incl. a newborn 👶)`;
 const petStr=petCount?' + '+PETS.slice(0,petCount).map(p=>`${p.emoji} ${p.name}`).join(', '):'';
 $('#famPreview').textContent=`👩 Penny + 👨 Max + ${kidStr}${petStr}`;
}
for(let n=3;n<=6;n++){const b=document.createElement('button');b.className='sizebtn'+(n===familySize?' sel':'');b.textContent=n;b.onclick=()=>{familySize=n;$$('#sizepick .sizebtn').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');famPreview();};$('#sizepick').append(b);}
for(let n=0;n<=3;n++){const b=document.createElement('button');b.className='sizebtn'+(n===petCount?' sel':'');b.textContent=n;b.onclick=()=>{petCount=n;$$('#petpick .sizebtn').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');famPreview();};$('#petpick').append(b);}
famPreview();
$('#startBtn').onclick=startGame;
$('#restartBtn').onclick=showSetup;
$('#resumeBtn').onclick=resume;
$('#quitBtn').onclick=()=>{game.running=false;stopCinema();recordPlayer.stop();showSetup();};
$('#pauseBtn').onclick=()=>world.paused&&$('#paused').classList.contains('show')?resume():showPause();
$('#touch-pause').onclick=()=>showPause();
$('#autoBtn').onclick=()=>{if(game.running)autopilot.toggle();};
$('#touch-auto').onclick=()=>{if(game.running)autopilot.toggle();};
$('#touch-interact').onclick=()=>{if(world.lookTarget)interact();else toast('Walk up to someone or something first.');};
$('#touch-zombie').onclick=()=>game.spawnZombie();
const muteButtons=$$('[data-mute]');const paintMute=()=>muteButtons.forEach(b=>b.textContent=isMuted()?'🔇':'🔊');
const applyMute=()=>{paintMute();sound.setVolume(isMuted()?0:.65);recordPlayer.setVolume(isMuted()?0:.65);if(movie)movie.muted=isMuted();world.cinema.volume=isMuted()?0:.65;};
muteButtons.forEach(b=>b.onclick=()=>{setMuted(!isMuted());applyMute();});paintMute();
document.addEventListener('keydown',e=>{
 if(e.target.closest('input,textarea,select,[contenteditable="true"]')||e.altKey||e.ctrlKey||e.metaKey)return;
 if(e.code==='KeyE'&&!e.repeat)interact();
 else if(e.code==='KeyP'&&game.running){if($('#paused').classList.contains('show'))resume();else if(!commandFor&&!miniGame)showPause();}
 else if(e.code==='KeyZ'&&game.running&&!world.paused)game.spawnZombie();
 else if(e.code==='KeyM'){setMuted(!isMuted());applyMute();}
 else if(e.code==='KeyX'&&game.running&&!e.repeat)autopilot.toggle();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.running&&!commandFor&&!miniGame)showPause();});

stat('best',bestScore);
refreshBoards();
window.pennyGame={game,world,agents,autopilot,startGame,openCommand,ZONES,stats,recordPlayer,startCinema,stopCinema,THREE};   // handy for tinkering and smoke tests
if(document.fonts?.load)['700 16px "Baloo 2"','800 20px "Baloo 2"'].forEach(f=>document.fonts.load(f).catch(()=>{}));
document.documentElement.removeAttribute('data-starting');
$('#setup').classList.add('show');
