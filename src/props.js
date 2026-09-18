import * as THREE from 'three';
import {ZONES} from './zones.js';
import {stationPose} from './stations.js';

// Things that appear while someone is busy: a plate of food or a drink on the
// dining table that empties as they eat, kibble in a pet's bowl that goes down
// as they crunch, and a video game on the lounge screen while someone plays.
const mats=new Map();
const mat=(color,roughness=.6)=>{const key=color+':'+roughness;if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color,roughness}));return mats.get(key);};
const mesh=(geometry,material,parent,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
const geo={
 plate:new THREE.CylinderGeometry(.13,.11,.012,28),rim:new THREE.TorusGeometry(.125,.008,6,28),
 bun:new THREE.SphereGeometry(.06,16,10,0,Math.PI*2,0,Math.PI/2),base:new THREE.CylinderGeometry(.06,.058,.02,16),patty:new THREE.CylinderGeometry(.064,.064,.022,16),cheese:new THREE.BoxGeometry(.12,.006,.12),lettuce:new THREE.CylinderGeometry(.07,.066,.012,12),
 chip:new THREE.BoxGeometry(.012,.012,.07),pea:new THREE.SphereGeometry(.009,6,5),
 glass:new THREE.CylinderGeometry(.034,.028,.12,16,1,true),liquid:new THREE.CylinderGeometry(.03,.026,1,14),straw:new THREE.CylinderGeometry(.004,.004,.16,6),
 kibble:new THREE.SphereGeometry(.014,6,5),
};
const glassMat=new THREE.MeshStandardMaterial({color:0xdfeff5,roughness:.1,transparent:true,opacity:.35,side:THREE.DoubleSide});

function burger(parent){
 const g=new THREE.Group();parent.add(g);
 const layers=[mesh(geo.base,mat(0xd9a05b),g,0,.01,0),mesh(geo.patty,mat(0x5b3a24),g,0,.031,0),mesh(geo.cheese,mat(0xf4c542,.4),g,0,.044,0),mesh(geo.lettuce,mat(0x6fbf4a),g,0,.052,0),mesh(geo.bun,mat(0xe0a860),g,0,.058,0)];
 mesh(geo.cheese,mat(0xf4c542,.4),g,0,.044,0).rotation.y=.4;
 const chips=[];for(let i=0;i<7;i++){const c=mesh(geo.chip,mat(0xf0c060,.5),g,.1+Math.cos(i*1.1)*.025,.008+i*.004,-.02+Math.sin(i*1.7)*.03);c.rotation.y=i*.5;c.rotation.z=.15;chips.push(c);}
 const peas=[];for(let i=0;i<9;i++)peas.push(mesh(geo.pea,mat(0x5da84a),g,-.095+Math.cos(i*2.1)*.022,.012,.01+Math.sin(i*2.1)*.022));
 // Bites: the stack shrinks from the top, then the chips and peas go.
 return p=>{for(const [i,l] of layers.entries()){const keep=Math.min(1,Math.max(0,(p-.25)*4-(layers.length-1-i)*.16+.4));l.visible=keep>.05;l.scale.setScalar(.6+keep*.4);}
  for(const [i,c] of chips.entries())c.visible=p>.22-i*.03;for(const [i,pea] of peas.entries())pea.visible=p>.12-i*.012;};
}
function drink(parent){
 const g=new THREE.Group();parent.add(g);
 mesh(geo.glass,glassMat,g,0,.06,0);const liquid=mesh(geo.liquid,mat(0xf28b3a,.3),g,0,0,0);liquid.material.transparent=true;liquid.material.opacity=.85;
 const straw=mesh(geo.straw,mat(0xffffff,.5),g,.02,.1,0);straw.rotation.z=-.25;
 return p=>{const h=.005+p*.105;liquid.scale.y=h;liquid.position.y=h/2;};
}
function kibble(parent,color){
 const g=new THREE.Group();parent.add(g);const bits=[];
 for(let i=0;i<22;i++){const r=.02+((i*7)%5)*.016,a=i*2.4,b=mesh(geo.kibble,mat(color,.9),g,Math.cos(a)*r,.05+(i%3)*.012,Math.sin(a)*r);b.scale.set(1,.7,1.3);b.rotation.y=a;bits.push(b);}
 return p=>{for(const [i,b] of bits.entries())b.visible=p>i/bits.length;};
}

// A cheerful little platformer drawn on the lounge screen while someone plays.
class GameScreen{
 constructor(world){
  this.world=world;this.canvas=document.createElement('canvas');this.canvas.width=512;this.canvas.height=246;this.ctx=this.canvas.getContext('2d');
  this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;this.on=false;this.t=0;this.frame=0;this.score=0;this.coins=[];
 }
 start(){if(this.on)return;this.on=true;this.t=0;this.score=0;this.coins=[];const face=this.world.cinema.face;this.was={map:face.material.map,color:face.material.color.getHex()};face.material.map=this.texture;face.material.color.set(0xffffff);face.material.needsUpdate=true;}
 stop(){if(!this.on)return;this.on=false;const face=this.world.cinema.face;if(face.material.map===this.texture){face.material.map=this.was?.map||null;face.material.color.set(this.was?.color??0xe5e5df);face.material.needsUpdate=true;}}
 update(dt){
  if(!this.on)return;this.t+=dt;this.frame+=dt;if(this.frame<1/14)return;this.frame=0;
  const c=this.ctx,W=this.canvas.width,H=this.canvas.height,t=this.t,scroll=t*120;
  const sky=c.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#7ec8ff');sky.addColorStop(1,'#d9f3ff');c.fillStyle=sky;c.fillRect(0,0,W,H);
  c.fillStyle='#ffffffcc';for(let i=0;i<4;i++){const x=((i*170-scroll*.25)%(W+120)+W+120)%(W+120)-60,y=30+i*28;c.beginPath();c.arc(x,y,18,0,7);c.arc(x+22,y-8,22,0,7);c.arc(x+46,y,18,0,7);c.fill();}
  c.fillStyle='#5bb85a';for(let i=0;i<6;i++){const x=((i*140-scroll*.5)%(W+160)+W+160)%(W+160)-80;c.beginPath();c.arc(x,H-40,70,Math.PI,0);c.fill();}
  c.fillStyle='#7a4f2b';c.fillRect(0,H-40,W,40);c.fillStyle='#3fa33d';c.fillRect(0,H-46,W,10);
  c.fillStyle='#b8894f';for(let i=0;i<5;i++){const x=((i*220+60-scroll)%(W+80)+W+80)%(W+80)-40,y=H-46-70-(i%2)*40;c.fillRect(x,y,90,18);c.fillStyle='#fdf0a0';c.fillRect(x+4,y+4,82,3);c.fillStyle='#b8894f';}
  // Coins drift past; the hero bounces and collects them.
  if(this.coins.length<6&&Math.random()<.06)this.coins.push({x:W+20,y:H-90-Math.random()*90});
  const hero={x:120,y:H-46-Math.abs(Math.sin(t*4))*70-22};
  for(const coin of this.coins){coin.x-=120/14;c.fillStyle='#ffcc33';c.beginPath();c.ellipse(coin.x,coin.y,9*Math.abs(Math.cos(t*6+coin.x)),11,0,0,7);c.fill();c.strokeStyle='#c78f00';c.stroke();if(Math.hypot(coin.x-hero.x,coin.y-hero.y)<26){coin.x=-100;this.score+=10;}}
  this.coins=this.coins.filter(k=>k.x>-30);
  c.fillStyle='#ff6b6b';c.fillRect(hero.x-14,hero.y-14,28,30);c.fillStyle='#ffd8b0';c.fillRect(hero.x-11,hero.y-20,22,16);c.fillStyle='#3b2a20';c.fillRect(hero.x-12,hero.y-24,24,7);c.fillStyle='#000';c.fillRect(hero.x-5,hero.y-15,3,4);c.fillRect(hero.x+3,hero.y-15,3,4);
  c.fillStyle='#000a';c.fillRect(0,0,W,26);c.fillStyle='#fff';c.font='bold 16px "Baloo 2","Segoe UI",sans-serif';c.fillText('SCORE '+this.score,12,19);c.fillText('★ '.repeat(3),W-70,19);c.fillStyle='#ffe066';c.fillText('LEVEL '+(1+Math.floor(t/20)),W/2-36,19);
  this.texture.needsUpdate=true;
 }
}

export class Props{
 constructor(world){this.world=world;this.meals=new Map();this.bowls=new Map();this.screen=new GameScreen(world);}
 update(dt,chars){
  const alive=new Set();let playing=false;
  for(const c of chars){
   if(c.dead||c.state!=='happy')continue;
   if(!c.isPet&&c.busy==='eating'&&c.station?.zone==='table'){alive.add(c.id);this.meal(c,Math.max(0,Math.min(1,c.happyT/ZONES.table.stay)));}
   else if(c.isPet&&c.busy==='eating'){alive.add(c.id);this.bowl(c,Math.max(0,Math.min(1,c.happyT/(ZONES.bowls.stay||5))));}
   else if(c.busy==='playing'&&c.station?.zone==='tv')playing=true;
  }
  for(const [id,entry] of [...this.meals,...this.bowls])if(!alive.has(id))this.remove(id);
  if(playing&&!this.world.cinema.active)this.screen.start();else this.screen.stop();
  this.screen.update(dt);
 }
 // A plate on the table in front of the chair; the meal vanishes bite by bite.
 meal(c,progress){
  let entry=this.meals.get(c.id);
  if(!entry){
   const p=stationPose(c.station),g=new THREE.Group();g.name=c.name+"'s meal";
   g.position.set(p.x+p.fx*.62,1.28+.006,p.z+p.fz*.62);this.world.scene.add(g);   // straight in front of the chair, on the table top
   mesh(geo.plate,mat(0xfbfaf6,.35),g,0,.006,0);mesh(geo.rim,mat(0x9fc8d8,.4),g,0,.012,0).rotation.x=Math.PI/2;
   const food=c.served==='drink'?drink(g):burger(g);
   if(c.served!=='drink'){const cup=new THREE.Group();cup.position.set(.19,0,-.06);g.add(cup);drink(cup)(.8);}
   entry={g,food};this.meals.set(c.id,entry);
  }
  entry.food(progress);
 }
 // Kibble in the pet's own kitchen bowl.
 bowl(c,progress){
  let entry=this.bowls.get(c.id);
  if(!entry){
   const corner=this.world.petCorners?.get(c.id);if(!corner)return;
   const food=corner.contents[0],g=new THREE.Group();g.position.copy(food.position);g.position.y+=0;corner.g.add(g);
   entry={g,food:kibble(g,c.kind==='tortoise'?0x6f9a3a:c.kind==='cat'?0x8a5a3a:0x9a6a40)};this.bowls.set(c.id,entry);
  }
  entry.food(progress);
 }
 remove(id){const entry=this.meals.get(id)||this.bowls.get(id);if(!entry)return;entry.g.parent?.remove(entry.g);this.meals.delete(id);this.bowls.delete(id);}
 clear(){for(const id of [...this.meals.keys(),...this.bowls.keys()])this.remove(id);this.screen.stop();}
}
