import * as THREE from 'three';
import {buildHouse} from './house/house.js';
import {optimizeHouse} from './house/house-meshes.js';
import {applyHouseTextures} from './house/house-materials.js';
import {applyHallwayArt} from './house/house-gallery.js';
import {applyBathroomTextures} from './house/house-bathrooms.js';
import {applyDetailTexture} from './house/bedroom-details.js';
import {HouseReflections} from './house/house-reflections.js';
import {Daylight} from './house/daylight.js';
import {HOUSE_VIEWS,HOUSE_ROOMS,planPoint,floorHeight,pointInPolygon} from './house/house-layout.js';
import {moveWithJump} from './house/navigation.js';
import {BalconyLife} from './house/balcony-life.js';
import {applyHomeDetails} from './house/home-furnishings.js';
import {applyDiningArt} from './house/dining-details.js';
import {applyBalconyWallArt} from './house/balcony-wall-details.js';
import {preloadPetFilms,preloadPetActivities} from './house/pet-media.js';
import {createActor} from './house/actors.js';
import {PETS} from './house/life.js';
import {AssetReadiness} from './house/asset-readiness.js';
import {hasTouchInput,viewportBounds,fitRenderer} from './house/game-viewport.js';
import {installTouchLook} from './house/touch-controls.js';
import {installDesktopInteraction} from './house/desktop-controls.js';
import {optimizeLocalLights} from './house/render-lighting.js';
import {AdaptiveResolution} from './house/render-quality.js';
import {prepareHouseRenderer} from './house/render-preparation.js';
import {HandInteractionBody} from './house/hand-interaction-body.js';
import {installPetBone} from './house/pet-bone-model.js';
import {petPose} from './house/pet-locomotion.js';
import {mat,box,cyl,sphere} from './primitives.js';
import {NavGraph} from './nav.js';
import {PetRoaming} from './pet-roaming.js';
import {PetSocial} from './house/pet-social.js';

// The At Home house with its light, balcony life, fixtures, hands, pets and
// mini-games, plus a first-person player. Family members are registered as
// characters the player can aim at; fixtures keep At Home's own interactions.
export class World{
 constructor(canvas,{onTick=()=>{},onLook=()=>{},onStatus=()=>{}}={}){
  this.canvas=canvas;this.onTick=onTick;this.onLook=onLook;this.onStatus=onStatus;
  this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2(0xc9dce6,.002);
  this.camera=new THREE.PerspectiveCamera(62,1,.06,220);this.scene.add(this.camera);
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,hasTouchInput()?1.15:1.6));
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.renderQuality=new AdaptiveResolution(this.renderer.getPixelRatio());
  Object.assign(this,{materials:{},colliders:[],targets:[],keys:{},mode:'menu',paused:false,motion:true,yaw:0,pitch:0,elapsed:0,hours:7.25,room:'hall',walking:false,telescope:{active:false},characters:new Map(),actors:new Map(),touchMove:{x:0,z:0},lookTarget:null,recordPlaying:false});
  this.handInteraction=new HandInteractionBody(this);
  buildHouse(this);this.targets=[];optimizeHouse(this);this.cinema.installRoomDimming();this.cinema.memoryMode=false;this.flashlight.visible=false;
  this.daylight=new Daylight(this);this.reflections=new HouseReflections(this);this.door.rotation.y=-1.45;
  this.nav=new NavGraph(this.colliders);
  this.petRoaming=new PetRoaming(this.colliders,Math.random,this.nav);this.petBone=installPetBone(this);
  this.petSocial=new PetSocial(this.petRoaming,{canStart:()=>this.petBone.phase==='rest',ready:id=>this.actors.get(id)?.userData.playReady});
  this.buildPetCorners();this.balconyLife=new BalconyLife(this);
  optimizeLocalLights(this.scene);this.loadArtwork();this.focus('hall');this.resize();this.clock=new THREE.Clock();
  this.viewportDirty=true;for(const event of ['resize','orientationchange','pageshow'])window.addEventListener(event,()=>{this.viewportDirty=true;});
  window.visualViewport?.addEventListener('resize',()=>{this.viewportDirty=true;});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;this.keys={};this.touchMove={x:0,z:0};});
  canvas.addEventListener('webglcontextrestored',()=>{this.contextLost=false;this.viewportDirty=true;this.daylight.sun.shadow.needsUpdate=true;});
  window.addEventListener('blur',()=>{this.keys={};});
  document.addEventListener('keydown',e=>{if(this.mode!=='play'||this.paused||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,textarea,select,button,[contenteditable="true"]'))return;if(e.code==='Space'){e.preventDefault();if(!e.repeat)this.jumpQueued=true;return;}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();this.keys[e.code]=true;}});
  document.addEventListener('keyup',e=>delete this.keys[e.code]);
  document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;document.body.classList.toggle('wandering',locked);if(!locked){this.keys={};if(this.mode==='play'&&!this.paused&&!document.hidden)this.onUnlock?.();}});
  document.addEventListener('mousemove',e=>{if(hasTouchInput()||document.pointerLockElement!==canvas||this.paused||this.mode!=='play')return;this.yaw-=e.movementX*.0018;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*.0018,-1.15,1.05);});
  installDesktopInteraction(canvas,this);installTouchLook(canvas,this);
  this.quality='high';this.baseShadowInterval=this.daylight.shadowInterval;this.basePixelRatio=this.renderQuality.max;this.slowWindow=0;this.slowSeconds=0;
  this.animate();
 }
 get miniGameActive(){return !!(this.clawGame?.active||this.pinballGame?.active);}
 // Performance mode: no mirror reflections, rarer shadow refreshes and a
 // capped pixel ratio. Chosen by the player, or automatically when frames drag.
 setQuality(level,{announce=false}={}){
  if(this.quality===level)return;this.quality=level;const low=level==='low';
  for(const p of this.reflections.surfaces)p.mesh.visible=!low;
  this.daylight.shadowInterval=low?1200:this.baseShadowInterval;
  this.renderQuality.max=low?Math.min(1,this.basePixelRatio):this.basePixelRatio;
  this.renderQuality.min=Math.min(this.renderQuality.max,Math.max(low?.6:.8,this.renderQuality.max*.65));
  if(this.renderQuality.ratio>this.renderQuality.max){this.renderQuality.ratio=this.renderQuality.max;this.renderer.setPixelRatio(this.renderQuality.ratio);this.viewportDirty=true;}
  this.daylight.sun.shadow.needsUpdate=true;
  if(announce)this.onQuality?.(level);
 }
 watchFrameRate(frameSeconds,active){
  if(!active||this.quality==='low'||frameSeconds>.5)return;
  this.slowWindow+=frameSeconds;this.slowSeconds+=frameSeconds>1/30?frameSeconds:0;
  if(this.slowWindow<4)return;
  // More than half of the last four seconds below 30 fps, at the lowest
  // resolution the adaptive renderer allows: drop to performance mode.
  if(this.slowSeconds>this.slowWindow*.5&&this.renderQuality.ratio<=this.renderQuality.min+.01)this.setQuality('low',{announce:true});
  this.slowWindow=0;this.slowSeconds=0;
 }
 // Food and water bowls in the kitchen corner, one set per pet.
 buildPetCorners(){
  this.petCorners=new Map();
  for(const p of PETS){
   const [x,z]=planPoint(...p.carePlan),y=floorHeight(x,z),g=new THREE.Group();g.name=p.name+' bowls';g.position.set(x,y+.012,z);this.scene.add(g);
   const size=p.id==='pebble'?.2:.26;this.cyl(size,size,.018,0,0,0,this.mat(p.id==='pebble'?0xc1b596:0xb7c19b),g,48);const contents=[];
   for(const [i,color] of [0x755239,0x8eafb6].entries()){const px=size+.17,pz=(i-.5)*.30;this.cyl(.135,.115,.045,px,.022,pz,this.mat(0xabb69e,.35),g,32);contents.push(this.cyl(.113,.113,.006,px,.047,pz,this.mat(color,.2),g,32));
    if(i===0)for(let j=0;j<9;j++){const a=j*2.4,r=.025+(j%3)*.026;this.sphere(p.id==='pebble'?.027:.012,px+Math.cos(a)*r,.058,pz+Math.sin(a)*r,this.mat(p.id==='pebble'?0x63854a:0x976c40),g,1,p.id==='pebble'?.18:1,1.5);}}
   this.petCorners.set(p.id,{g,contents,care:0});
  }
 }
 showCare(id){const corner=this.petCorners.get(id);if(corner)corner.care=2.8;const actor=this.actors.get(id);if(actor)actor.userData.careUntil=this.elapsed+6;}
 loadArtwork(){
  if(this.artwork)return this.artwork.run();
  const a=Math.min(8,this.renderer.capabilities.getMaxAnisotropy()),materials=this.houseMaterials;
  const textures=[['bedroom-marble.webp',t=>applyDetailTexture(t,materials.bedroomMarble,a)],['sage-flowers.webp',t=>applyDetailTexture(t,materials.sageDrawing,a)],['balcony-collage.webp',t=>applyBalconyWallArt(t,materials,a)],['dining-prints.webp',t=>applyDiningArt(t,materials,a)],['entry-details-atlas.webp',t=>applyHomeDetails(t,materials,a)],['house-surfaces-v2.png',t=>applyHouseTextures(t,materials,a)],['hallway-prints.webp',t=>applyHallwayArt(t,materials,a)],['powder-marble.webp',t=>applyBathroomTextures(t,materials,a)]];
  const tasks=textures.map(([id,apply])=>({id,load:attempt=>new Promise((resolve,reject)=>{
   let settled=false;const timeout=setTimeout(()=>{settled=true;reject(new Error('Image transfer timed out'));},20000);
   new THREE.TextureLoader().load(`/art/${id}${attempt?'?retry='+Date.now():''}`,t=>{if(settled){t.dispose();return;}settled=true;clearTimeout(timeout);try{apply(t);resolve();}catch(error){reject(error);}},undefined,error=>{if(!settled){settled=true;clearTimeout(timeout);reject(error);}});
  })}));
  for(const id of ['sunny','miso','pebble'])tasks.push({id:`${id}-films`,load:()=>preloadPetFilms(id)});
  tasks.push({id:'pets',load:async()=>{const responses=await Promise.all(['/art/friends/framing.json','/art/motion/framing.json'].map(url=>fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(20000)})));if(responses.some(r=>!r.ok))throw new Error('Pet information unavailable');[this.framing,this.motionFraming]=await Promise.all(responses.map(r=>r.json()));}});
  this.artwork=new AssetReadiness(tasks,{onChange:status=>this.onStatus(status),prepare:()=>prepareHouseRenderer(this)});return this.artwork.run();
 }
 // Pets are At Home's filmed sprites, driven by At Home's roaming.
 createPet(id){
  const spec=PETS.find(p=>p.id===id);const g=createActor(id,spec.height,this.framing[id],this.motionFraming);this.scene.add(g);this.actors.set(id,g);
  if(!this.petActivitiesWarming){this.petActivitiesWarming=true;setTimeout(async()=>{for(const pet of ['sunny','miso'])await preloadPetActivities(pet);},5000);}
  return g;
 }
 addCharacter(c,group){this.characters.set(c.id,{c,group});this.scene.add(group);}
 removeCharacter(id){const entry=this.characters.get(id);if(!entry)return;this.scene.remove(entry.group);entry.group.userData.dispose?.();this.characters.delete(id);this.actors.delete(id);if(this.lookTarget===id){this.lookTarget=null;this.onLook(null);}}
 clearCharacters(){for(const id of [...this.characters.keys()])this.removeCharacter(id);this.actors.clear();this.petRoaming.pets.clear();this.petSocial.reset();}
 // Fixtures, hands and toys return to their opening state for a new game.
 resetHouse(){
  this.handInteraction.cancel();this.movableFurniture.reset();this.shoeTidy.reset();this.clawGame.reset();this.pinballGame.reset();this.kitchenStove.setRunning(false);this.turntable.reset();this.hallwayCandle.reset();this.recordPlaying=false;
  if(this.cinema.active)this.cinema.leave();
 }
 focus(id){this.handInteraction?.cancel();const p=HOUSE_VIEWS[id]||HOUSE_VIEWS.hall;this.camera.position.set(...p.slice(0,3));this.yaw=p[3];this.pitch=p[4];this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');this.room=id;this.keys={};this.eyeHeight=1.67;this.feet={x:this.camera.position.x,y:floorHeight(this.camera.position.x,this.camera.position.z),z:this.camera.position.z,vy:0,grounded:true};this.jumpQueued=false;}
 lock(){if(this.mode!=='play'||this.paused||hasTouchInput())return;this.canvas.requestPointerLock()?.catch(()=>{});}
 unlock(){this.touchMove={x:0,z:0};this.keys={};if(document.pointerLockElement)document.exitPointerLock();}
 resumeWandering(){this.lock();}
 resize(){const {width,height}=viewportBounds();fitRenderer(this.renderer,this.camera,width,height,this.viewportDirty);this.clawGame?.resizeView();this.pinballGame?.resizeView();this.viewportDirty=false;}
 get feetPosition(){return {x:this.camera.position.x,y:this.feet?.y??floorHeight(this.camera.position.x,this.camera.position.z),z:this.camera.position.z};}
 // A tap on a touch screen: the character closest to the tapped ray.
 pickCharacter(clientX,clientY){
  const b=viewportBounds(),ndc=new THREE.Vector2(((clientX-b.left)/b.width)*2-1,-((clientY-b.top)/b.height)*2+1);
  const ray=new THREE.Raycaster();ray.setFromCamera(ndc,this.camera);let best=null,bestScore=.55;
  for(const [id,{c,group}] of this.characters){
   if(c.dead||c.state==='doomed')continue;
   const centre=group.position.clone().add(new THREE.Vector3(0,(c.isPet?c.height*.5:.9*c.size),0)),distance=centre.distanceTo(this.camera.position);
   if(distance>4.5)continue;
   const miss=ray.ray.distanceToPoint(centre),radius=(c.isPet?.35:.45*c.size)+distance*.04;
   if(miss>radius||miss/radius>=bestScore)continue;
   if(this.occluded(centre,distance))continue;
   best=id;bestScore=miss/radius;
  }
  return best;
 }
 occluded(point,distance){const d=point.clone().sub(this.camera.position).normalize();const ray=new THREE.Raycaster(this.camera.position,d,.05,Math.max(.06,distance-.25));return ray.intersectObject(this.houseRoot,true).some(hit=>!hit.object.material.transparent);}
 animate(){
  requestAnimationFrame(()=>this.animate());const frameSeconds=this.clock.getDelta(),dt=Math.min(frameSeconds,.05);
  if(document.hidden||this.contextLost||this.preparingRenderer){this.renderQuality.reset();return;}
  const ratio=this.renderQuality.update(frameSeconds,this.mode==='play'&&!this.paused&&this.artwork.ready&&!this.viewportDirty);
  if(ratio!==undefined){this.renderer.setPixelRatio(ratio);this.viewportDirty=true;}
  this.resize();this.elapsed+=dt;const active=this.mode==='play'&&!this.paused&&!document.hidden;this.walking=false;
  this.watchFrameRate(frameSeconds,active&&this.artwork.ready);
  if(active){
   if(this.handInteraction.active)this.handInteraction.update(dt);
   else{
    const v=new THREE.Vector3((this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0),0,(this.keys.KeyS||this.keys.ArrowDown?1:0)-(this.keys.KeyW||this.keys.ArrowUp?1:0));
    v.x+=this.touchMove?.x||0;v.z+=this.touchMove?.z||0;
    if(v.length()||this.jumpQueued)this.eyeHeight=1.67;
    v.clampLength(0,1).applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw);
    if(!this.feet||Math.hypot(this.feet.x-this.camera.position.x,this.feet.z-this.camera.position.z)>.1)this.feet={x:this.camera.position.x,y:floorHeight(this.camera.position.x,this.camera.position.z),z:this.camera.position.z,vy:0,grounded:true};
    if(!this.jumpQueued)this.movableFurniture.push(this.feet,v.x*dt*2.1,v.z*dt*2.1);
    const step=moveWithJump(this.feet,v.x*dt*2.1,v.z*dt*2.1,dt,this.colliders,this.jumpQueued);this.jumpQueued=false;this.feet=step;
    this.camera.position.x=step.x;this.camera.position.z=step.z;this.walking=step.distance>.001&&step.grounded;this.walkPhase=(this.walkPhase||0)+step.distance*10;
    if(this.walking&&this.elapsed-(this.lastStep||0)>.5){this.lastStep=this.elapsed;this.onStep?.();}
    if(step.landed)this.landingMotion=.035;this.landingMotion=(this.landingMotion||0)*Math.exp(-12*dt);
    const eye=step.y+(this.eyeHeight||1.67)+(this.motion?(this.walking?Math.sin(this.walkPhase)*.012:0)-this.landingMotion:0);
    this.camera.position.y=step.grounded?THREE.MathUtils.lerp(this.camera.position.y,eye,1-Math.exp(-18*dt)):eye;
   }
   this.room=HOUSE_ROOMS.find(r=>pointInPolygon(this.camera.position.x,this.camera.position.z,r.polygon))?.id||this.room;
  }
  this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');
  this.onTick(dt,active);
  const cam=this.camera.position,animated=!document.hidden&&(this.mode==='menu'||this.mode==='play'&&(!this.paused||this.miniGameActive));
  // At Home's pets: roaming, the fetch bone and their filmed sprites.
  this.petRoaming.update(active?dt:0,{enabled:this.motion,player:cam,hours:this.hours,canWalk:id=>this.actors.get(id)?.userData.canWalk()});
  this.petBone.update(active&&this.motion?dt:0,cam);this.petSocial.update(active?dt:0,{enabled:this.motion,player:cam,hours:this.hours});
  for(const [id,p] of this.petRoaming.pets){const actor=this.actors.get(id);if(!actor)continue;const pose=petPose(p,active?dt:0);actor.position.set(p.x,pose.y,p.z);const ud=actor.userData;ud.activity=p.activity;ud.socialTime=p.socialTime;ud.carryingBone=id==='sunny'&&this.petBone.phase==='return';ud.speed=Math.hypot(p.vx,p.vz);ud.vx=p.vx;ud.vz=p.vz;ud.cameraX=cam.x-p.x;ud.cameraZ=cam.z-p.z;ud.cameraY=cam.y-p.y;ud.travel=p.distance;if(Math.hypot(p.vx,p.vz)>.001)p.heading=Math.atan2(p.vx,p.vz);ud.heading=p.heading||0;ud.care=this.elapsed<(ud.careUntil||0);ud.hopping=!!p.hop;}
  for(const [,g] of this.actors){const distance=g.position.distanceTo(cam);g.rotation.y=Math.atan2(cam.x-g.position.x,cam.z-g.position.z);g.userData.update(animated?dt:0,this.motion,distance<9);}
  this.petBone.updateModel();
  // Fixtures, toys and the turntable keep At Home's own timers.
  this.houseInteractions.update(active?dt:0);
  this.clawGame.update(this.clawGame.active?dt:0);this.pinballGame.update(this.pinballGame.active?dt:0);this.cinema.update(dt);
  this.turntable.update(active?dt:0,this.recordPlaying);this.handInteraction.updateArms();
  this.balconyLife.update(active?dt:0,this.hours,this.motion);this.daylight.update(this.hours);this.daylight.neighborhood.update(active?dt:0,this.hours,this.motion);
  for(const corner of this.petCorners.values()){corner.care=Math.max(0,corner.care-(active?dt:0));for(const content of corner.contents)content.scale.setScalar(corner.care>0?1+Math.sin(corner.care*7)*.05:1);}
  // Aim: a family member in front of the player, then a fixture or the turntable.
  const checkAim=this.elapsed-(this.lastAimCheck||-1)>=.1;
  if(checkAim){
   this.lastAimCheck=this.elapsed;let nearest=null,bestAim=0;
   const forward=this.camera.getWorldDirection(new THREE.Vector3());
   for(const [id,{c,group}] of this.characters){
    if(c.dead||c.state==='doomed')continue;
    const top=c.isPet?c.height*.5:.95*c.size,centre=group.position.clone().add(new THREE.Vector3(0,top,0)),d=centre.clone().sub(cam),distance=d.length();
    if(distance>3.6)continue;const aim=forward.dot(d.clone().normalize());
    if(aim<.84||aim<=bestAim)continue;
    if(this.occluded(centre,distance))continue;
    nearest=id;bestAim=aim;
   }
   // A fixture wins when the player is looking straight at it, even with a
   // family member or pet in the wider cone, so Leo cannot sit on his bone.
   const fixture=this.houseInteractions.select();
   if(fixture){const item=this.houseInteractions.items.get(fixture),aim=forward.dot(item.pos.clone().sub(cam).normalize());if(!nearest||aim>Math.max(bestAim,.985))nearest=fixture;}
   if(!nearest&&this.turntablePosition){const d=this.turntablePosition.clone().sub(cam);if(d.length()<2.3&&forward.dot(d.clone().normalize())>.72&&!this.occluded(this.turntablePosition,d.length()-.05))nearest='turntable';}
   const label=this.houseInteractions.label(nearest)||(nearest==='turntable'?this.turntable.label:'');
   if(nearest!==this.lookTarget||label!==this.lastLabel){this.lookTarget=nearest;this.lastLabel=label;this.onLook(nearest);}
  }
  if(this.quality!=='low')this.reflections.update();this.renderer.render(this.scene,this.camera);
 }
}
Object.assign(World.prototype,{mat,box,cyl,sphere});
