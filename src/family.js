import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Little 3D versions of PennyGame's canvas family: round heads with proper
// faces, tees over trousers or a skirt, arms that bend at the elbow, legs that
// swing, and hands that wave in the air when someone needs something.
const materials=new Map();
export const colorMat=(hex,roughness=.85)=>{const key=hex+':'+roughness;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:new THREE.Color(hex),roughness}));return materials.get(key);};
const geo={
 leg:new THREE.CapsuleGeometry(.058,.3,4,12),shoe:new THREE.SphereGeometry(.07,12,8),hips:new THREE.CylinderGeometry(.165,.175,.14,18),
 torso:new THREE.CapsuleGeometry(.17,.28,4,20),collar:new THREE.TorusGeometry(.1,.024,8,20),neck:new THREE.CylinderGeometry(.06,.065,.12,12),
 sleeve:new THREE.CapsuleGeometry(.064,.1,4,12),upperArm:new THREE.CapsuleGeometry(.048,.14,4,10),forearm:new THREE.CapsuleGeometry(.045,.16,4,10),hand:new THREE.SphereGeometry(.056,12,8),
 skirt:new THREE.CylinderGeometry(.17,.26,.24,20,1,true),badge:new THREE.SphereGeometry(.05,12,8),
 head:new THREE.SphereGeometry(.2,26,18),ear:new THREE.SphereGeometry(.045,10,8),nose:new THREE.SphereGeometry(.028,10,8),
 smile:new THREE.TorusGeometry(.036,.009,6,12,Math.PI),mouthLine:new THREE.BoxGeometry(.07,.014,.012),tooth:new THREE.BoxGeometry(.016,.018,.01),
 sclera:new THREE.SphereGeometry(.034,12,10),pupil:new THREE.SphereGeometry(.019,10,8),glint:new THREE.SphereGeometry(.008,6,5),brow:new THREE.BoxGeometry(.06,.013,.012),
 cheek:new THREE.SphereGeometry(.03,8,6),
 cap:new THREE.SphereGeometry(.215,22,16,0,Math.PI*2,0,1.6),longCap:new THREE.SphereGeometry(.215,22,16,0,Math.PI*2,0,1.95),
 fringe:new THREE.SphereGeometry(.212,22,8,Math.PI/2-1.05,2.1,.42,.62),bun:new THREE.SphereGeometry(.085,14,10),tuft:new THREE.CapsuleGeometry(.04,.09,4,8),tail:new THREE.CapsuleGeometry(.045,.2,4,10),tie:new THREE.TorusGeometry(.045,.012,6,12),
 shadow:new THREE.CircleGeometry(.3,24),
 padBody:new THREE.BoxGeometry(.15,.028,.06),padGrip:new THREE.CapsuleGeometry(.018,.05,3,8),padStick:new THREE.CylinderGeometry(.008,.006,.014,8),padButton:new THREE.CylinderGeometry(.007,.007,.008,8),
};
const shadowMat=new THREE.MeshBasicMaterial({color:0x2a3128,transparent:true,opacity:.18,depthWrite:false});
const steamMat=new THREE.MeshStandardMaterial({color:0xe6f2f7,roughness:.55,transparent:true,opacity:.94,depthWrite:false});
const bubbleMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.2,transparent:true,opacity:.75});

// Each doll is only a few draw calls: every limb, the body and the head are
// merged into one vertex-coloured mesh apiece, sharing a single material.
const dollMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62});
const shade=(hex,l)=>new THREE.Color(hex).offsetHSL(0,0,l);
const paint=(geometry,hex)=>{const color=new THREE.Color(hex),n=geometry.attributes.position.count,data=new Float32Array(n*3);for(let i=0;i<n;i++)color.toArray(data,i*3);geometry.setAttribute('color',new THREE.BufferAttribute(data,3));return geometry;};
function merged(parts){
 const list=parts.map(({geometry,color,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0]})=>{const g=geometry.clone();g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale)));return paint(g,color);});
 const mesh=new THREE.Mesh(mergeGeometries(list,false),dollMaterial);for(const g of list)g.dispose();mesh.castShadow=true;return mesh;
}
// Hair by style: a cap that sits back on the head plus a fringe, then buns, a
// tuft or a ponytail. The zombie gets a matted crop.
function hairParts(style,hair,zombie){
 const fringe=[{geometry:geo.fringe,color:hair,position:[0,.17,.012],scale:[1.02,1.06,1.02]}];
 if(zombie)return [{geometry:geo.cap,color:hair,position:[0,.2,-.02],scale:[1,.92,1]},{geometry:geo.fringe,color:hair,position:[.03,.17,.012],scale:[.7,1.06,1.02]}];
 if(style===0)return [{geometry:geo.cap,color:hair,position:[0,.2,-.015],scale:[1.02,.95,1.02]},...fringe];   // short crop
 if(style===1)return [{geometry:geo.longCap,color:hair,position:[0,.19,-.02],scale:[1.04,.98,1.04]},...fringe,{geometry:geo.bun,color:hair,position:[-.21,.3,-.04]},{geometry:geo.bun,color:hair,position:[.21,.3,-.04]}];   // side buns
 if(style===2)return [{geometry:geo.cap,color:hair,position:[0,.2,-.015],scale:[1.02,.95,1.02]},...fringe,{geometry:geo.tuft,color:hair,position:[.03,.42,.02],rotation:[0,0,-.5]}];   // short with a tuft
 return [{geometry:geo.longCap,color:hair,position:[0,.19,-.02],scale:[1.04,1,1.04]},...fringe,{geometry:geo.tie,color:'#ff4f8b',position:[0,.12,-.2],rotation:[Math.PI/2+.5,0,0]},{geometry:geo.tail,color:hair,position:[0,.02,-.24],rotation:[.55,0,0]}];   // ponytail
}
export function createDoll(c,{zombie=false}={}){
 const g=new THREE.Group();g.name=c.name;
 const skin=zombie?'#9ccc65':c.skin,shirt=zombie?'#5d7052':c.shirt,hair=zombie?'#2f3a26':c.hair,pants=zombie?'#33402e':(c.pants||'#3f4d6b'),shoe='#2b2622';
 const skinDark=shade(skin,-.08),shirtDark=shade(shirt,-.16),shirtLight=shade(shirt,.22),dress=!zombie&&c.gender==='f',lip='#c2455a';
 const pivot=(x,y,z,mesh,parent=g)=>{const p=new THREE.Group();p.position.set(x,y,z);p.add(mesh);parent.add(p);return p;};
 const shadow=new THREE.Mesh(geo.shadow,shadowMat);shadow.rotation.x=-Math.PI/2;shadow.position.y=.004;g.add(shadow);
 // Legs swing from the hips; girls wear tights under a skirt, everyone else trousers.
 const legs=[-.08,.08].map(x=>pivot(x,.52,0,merged([{geometry:geo.leg,color:dress?skinDark:pants,position:[0,-.24,0]},{geometry:geo.shoe,color:shoe,position:[0,-.47,.035],scale:[1,.62,1.45]}])));
 const body=[{geometry:geo.hips,color:dress?shirt:pants,position:[0,.56,0]},{geometry:geo.torso,color:shirt,position:[0,.8,0],scale:[1.05,1,.92]},
  {geometry:geo.collar,color:shirtDark,position:[0,1.03,0],rotation:[Math.PI/2,0,0]},{geometry:geo.neck,color:skin,position:[0,1.06,0]},
  {geometry:geo.badge,color:shirtLight,position:[0,.87,.152],scale:[.75,.75,.25]}];
 if(dress)body.push({geometry:geo.skirt,color:pants,position:[0,.5,0]});
 else body.push({geometry:geo.hips,color:shade(pants,-.18),position:[0,.62,0],scale:[1.01,.18,1.01]});   // belt
 g.add(merged(body));
 // Arms: a short sleeve and upper arm at the shoulder, a forearm and hand from the elbow.
 const arms=[],elbows=[];
 for(const x of [-.215,.215]){
  const shoulder=pivot(x,.99,0,merged([{geometry:geo.sleeve,color:shirt,position:[0,-.06,0]},{geometry:geo.upperArm,color:skin,position:[0,-.16,0]}]));
  const elbow=pivot(0,-.24,0,merged([{geometry:geo.forearm,color:skin,position:[0,-.08,0]},{geometry:geo.hand,color:skin,position:[0,-.19,0]}]),shoulder);
  arms.push(shoulder);elbows.push(elbow);
 }
 const headParts=[{geometry:geo.head,color:skin,position:[0,.17,0],scale:[1,1.04,1]},{geometry:geo.nose,color:skinDark,position:[0,.13,.195],scale:[1,.85,.8]},...hairParts(c.hairStyle,hair,zombie)];
 for(const x of [-.195,.195])headParts.push({geometry:geo.ear,color:skin,position:[x,.15,0],scale:[.55,1,.8]});
 for(const x of [-.078,.078])headParts.push({geometry:geo.brow,color:zombie?'#1d1a18':shade(hair,-.05),position:[x,.255,.178],rotation:[0,0,x<0?-.16:.16]});
 if(zombie){headParts.push({geometry:geo.mouthLine,color:'#1d1a18',position:[0,.075,.192],scale:[1.5,.9,1]});for(const x of [-.028,.028])headParts.push({geometry:geo.tooth,color:'#f4f1e6',position:[x,.065,.194]});}
 else{
  headParts.push({geometry:geo.smile,color:lip,position:[0,.09,.192],rotation:[0,0,Math.PI],scale:[1,.8,.6]});
  for(const x of [-.125,.125])headParts.push({geometry:geo.cheek,color:'#ff9db2',position:[x,.11,.15],scale:[1,.6,.4]});
 }
 const headPivot=pivot(0,1.14,0,merged(headParts));
 const eyes=[-.076,.076].map(x=>{
  const eye=merged([{geometry:geo.sclera,color:'#ffffff',position:[0,0,0],scale:[1,1.15,.55]},{geometry:geo.pupil,color:zombie?'#c62828':'#2a201c',position:[0,0,.02],scale:[1,1.1,.7]},{geometry:geo.glint,color:'#ffffff',position:[-.008*Math.sign(x)-.004,.009,.034]}]);
  const p=pivot(x,.185,.172,eye,headPivot);if(zombie&&x>0)p.scale.setScalar(.75);return p;
 });
 // A game controller, held in both hands while playing on the lounge sofa.
 const pad=merged([{geometry:geo.padBody,color:'#2b2b30',position:[0,0,0]},{geometry:geo.padGrip,color:'#2b2b30',position:[-.07,-.02,.02],rotation:[.6,0,.3]},{geometry:geo.padGrip,color:'#2b2b30',position:[.07,-.02,.02],rotation:[.6,0,-.3]},
  {geometry:geo.padStick,color:'#555560',position:[-.045,.018,-.01]},{geometry:geo.padStick,color:'#555560',position:[.02,.018,.012]},
  {geometry:geo.padButton,color:'#e94b4b',position:[.05,.018,-.02]},{geometry:geo.padButton,color:'#4bc0e9',position:[.065,.018,-.005]},{geometry:geo.padButton,color:'#6fdc6f',position:[.05,.018,.01]},{geometry:geo.padButton,color:'#f2d24b',position:[.035,.018,-.005]}]);
 pad.position.set(0,.78,.33);pad.rotation.x=.55;pad.visible=false;g.add(pad);
 const bubble=createBubble();bubble.position.y=1.85;g.add(bubble);
 // A frosted steam screen hides the body in the shower; the head stays visible.
 const steam=new THREE.Mesh(new THREE.CylinderGeometry(.44,.4,1.12,20),steamMat);steam.position.y=.66;steam.visible=false;g.add(steam);
 const bubbles=[0,1,2,3,4].map(i=>{const b=new THREE.Mesh(geo.pupil,bubbleMat);b.scale.setScalar(2+i*.45);steam.add(b);b.position.y=.3+i*.2;return b;});
 let phase=Math.random()*6,t=0,blink=2+Math.random()*3;
 g.userData.update=(dt,state,moving,speed,options={})=>{
  t+=dt;blink-=dt;if(blink<-.12)blink=2+Math.random()*4;
  const pose=options.pose||null,sitting=pose==='sit',still=!!pose,walkSpeed=moving&&!still?Math.max(.4,speed||.9):0;phase+=dt*walkSpeed*9;
  const swing=moving&&!still?Math.sin(phase)*.65:0;
  legs[0].rotation.x=sitting?-1.3:swing;legs[1].rotation.x=sitting?-1.3:-swing;
  const spread=pose==='exercise'?.28+Math.max(0,Math.sin(t*7))*.35:0;legs[0].rotation.z=spread;legs[1].rotation.z=-spread;
  steam.visible=pose==='shower';if(steam.visible)for(const [i,b] of bubbles.entries()){b.position.y=.35+((t*.35+i*.23)%1)*1.1;b.position.x=Math.sin(t*2+i)*.32;b.position.z=Math.cos(t*1.7+i*2)*.32;}
  let armL=-swing*.8,armR=swing*.8,armZ=.1,bob=moving?Math.abs(Math.sin(phase))*.03:Math.sin(t*2)*.01,tilt=0,headY=0,elbowL=-.3,elbowR=-.3;
  if(state==='request'){const wave=Math.sin(t*11)*.35;armL=-.4;armR=-.4;armZ=2.55+wave;bob=Math.abs(Math.sin(t*6))*.05;elbowL=-.5+wave;elbowR=-.5-wave;}
  else if(state==='work'){armL=armR=-.9+Math.sin(t*9)*.05;armZ=.3;elbowL=elbowR=-1.1+Math.sin(t*9)*.15;}
  else if(pose==='lie'){armL=armR=.15;armZ=.25;bob=Math.sin(t*1.6)*.012;elbowL=elbowR=-.15;}
  else if(pose==='shower'){armL=-1.2+Math.sin(t*10)*.45;armR=-1.2-Math.sin(t*10)*.45;armZ=.55;bob=Math.abs(Math.sin(t*5))*.015;elbowL=elbowR=-1.1;}
  else if(pose==='exercise'){armL=armR=-.2;armZ=1.6+Math.sin(t*7)*1.35;bob=Math.max(0,Math.sin(t*7))*.14;elbowL=elbowR=-.1;}
  else if(pose==='play'){armL=armR=-1.0+Math.sin(t*14)*.08;armZ=.3;bob=Math.abs(Math.sin(t*3))*.02;elbowL=elbowR=-1.2+Math.sin(t*14)*.1;}
  else if(pose==='sit'&&state==='happy'&&options.busy==='playing'){const mash=Math.sin(t*16);armL=-.75+mash*.03;armR=-.75-mash*.03;armZ=.22;bob=Math.abs(Math.sin(t*2))*.01;elbowL=-1.35+mash*.05;elbowR=-1.35-mash*.05;tilt=Math.sin(t*3)*.02;}   // thumbs on the controller
  else if(pose==='sit'&&state==='happy'&&options.busy==='eating'){const bite=Math.sin(t*5);armL=-.8+bite*.1;armR=-.8-bite*.1;armZ=.25;bob=Math.abs(bite)*.02;elbowL=-1.5+bite*.4;elbowR=-1.5-bite*.4;}   // tucking in at the table
  else if(pose==='sit'&&state!=='request'&&state!=='work'){armL=armR=-.5;armZ=.2;bob=0;elbowL=elbowR=-.9;}
  else if(state==='happy'){bob=Math.abs(Math.sin(t*10))*.14;armZ=1.2+Math.sin(t*10)*.5;armL=armR=-.3;elbowL=elbowR=-.5;}
  else if(state==='tickle'){tilt=Math.sin(t*22)*.14;armZ=1.6;armL=armR=.4;bob=Math.abs(Math.sin(t*16))*.05;elbowL=elbowR=-1.0;}
  else if(state==='doomed'){tilt=Math.sin(t*35)*.05;armZ=2.3;armL=armR=-.9;elbowL=elbowR=-.4;}
  else if(zombie){armL=armR=-1.45+Math.sin(t*3)*.1;armZ=.15;headY=Math.sin(t*2.2)*.08;elbowL=elbowR=-.2;}
  else if(moving){elbowL=-.45-swing*.3;elbowR=-.45+swing*.3;}
  arms[0].rotation.set(armL,0,armZ);arms[1].rotation.set(armR,0,-armZ);elbows[0].rotation.x=elbowL;elbows[1].rotation.x=elbowR;
  pad.visible=pose==='sit'&&state==='happy'&&options.busy==='playing';if(pad.visible){pad.rotation.z=Math.sin(t*16)*.04;pad.position.y=.78+bob;}
  g.rotation.z=tilt;headPivot.rotation.set(headY,0,0);headPivot.position.y=1.14+bob;
  const eyeScale=blink<0||pose==='lie'?.12:1;eyes[0].scale.y=eyeScale;eyes[1].scale.y=eyeScale*(zombie?.75:1);
  bubble.update(dt,options);
 };
 g.userData.bubble=bubble;
 return g;
}

// A speech bubble sprite that shows a need and its remaining time, or a small
// status glyph. Redrawn only when something visible changes.
export function createBubble(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=192;
 const ctx=canvas.getContext('2d');
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
 sprite.scale.set(.62,.62,1);sprite.visible=false;
 let key='';
 const urgencyColor=u=>u<.35?'#6fcf97':u<.65?'#ffc83c':u<.85?'#ff8c3c':'#eb4646';
 sprite.update=(dt,{emoji=null,urgency=null,tint=null,pulse=false}={})=>{
  if(!emoji){sprite.visible=false;key='';return;}
  const quant=urgency===null?'':Math.round(urgency*24);
  const next=emoji+'|'+quant+'|'+(tint||'');
  sprite.visible=true;
  if(pulse)sprite.scale.setScalar(.62+Math.sin(performance.now()/120)*.05);else sprite.scale.set(.62,.62,1);
  if(next===key)return;key=next;
  ctx.clearRect(0,0,192,192);
  ctx.beginPath();ctx.arc(96,86,68,0,Math.PI*2);ctx.fillStyle='#fffdf7';ctx.fill();
  ctx.lineWidth=9;ctx.strokeStyle=tint||(urgency===null?'#4a3f35':urgencyColor(urgency));ctx.stroke();
  ctx.beginPath();ctx.moveTo(78,146);ctx.lineTo(96,176);ctx.lineTo(114,146);ctx.closePath();ctx.fillStyle='#fffdf7';ctx.fill();
  if(urgency!==null){ctx.beginPath();ctx.arc(96,86,58,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-urgency));ctx.lineWidth=7;ctx.strokeStyle=urgencyColor(urgency);ctx.stroke();}
  ctx.font='76px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#4a3f35';ctx.fillText(emoji,96,92);
  texture.needsUpdate=true;
 };
 return sprite;
}

function textSprite(text,{font='700 44px "Baloo 2","Segoe UI",sans-serif',color='#2e7d32',size=1}={}){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext('2d');ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.lineWidth=9;ctx.strokeStyle='rgba(255,253,247,.95)';ctx.strokeText(text,256,64,500);ctx.fillStyle=color;ctx.fillText(text,256,64,500);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false}));
 sprite.scale.set(1.6*size,.4*size,1);sprite.renderOrder=20;return sprite;
}

// Floating words, hearts, confetti, ghosts and small memorials.
export class Effects{
 constructor(scene){this.scene=scene;this.items=[];}
 add(type,position,text,color){
  const p=new THREE.Vector3().copy(position);
  if(type==='float'||type==='cash'||type==='shake'){
   const s=textSprite(text,{color:type==='cash'?'#b8860b':color||'#2e7d32',size:type==='shake'?1.1:1});s.position.copy(p);this.scene.add(s);
   this.items.push({type,sprite:s,t:0,life:1.7,base:p.clone()});
  }else if(type==='hearts'){
   for(let i=0;i<5;i++){const s=textSprite('💗',{size:.35});s.position.copy(p).add(new THREE.Vector3((Math.random()-.5)*.5,Math.random()*.2,(Math.random()-.5)*.5));this.scene.add(s);this.items.push({type,sprite:s,t:-i*.08,life:1.3,base:s.position.clone(),drift:(Math.random()-.5)*.3});}
  }else if(type==='confetti'){
   for(let i=0;i<14;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.01),colorMat(['#ff8fab','#5dade2','#6fcf97','#f5b041','#af7ac5'][i%5]));m.position.copy(p);this.scene.add(m);this.items.push({type,mesh:m,t:0,life:1.4,v:new THREE.Vector3((Math.random()-.5)*2,1.5+Math.random()*1.5,(Math.random()-.5)*2),spin:Math.random()*6});}
  }else if(type==='ghost'){
   const s=textSprite('👻',{size:.9});s.position.copy(p);this.scene.add(s);this.items.push({type,sprite:s,t:0,life:3.5,base:p.clone()});
  }
 }
 memorial(position,name){
  const g=new THREE.Group();g.position.copy(position);
  const candle=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.16,12),colorMat('#f3ead7',.6));candle.position.y=.08;g.add(candle);
  const flame=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),new THREE.MeshStandardMaterial({color:0xffd27a,emissive:0xffa63a,emissiveIntensity:2}));flame.position.y=.19;flame.scale.set(.8,1.5,.8);g.add(flame);
  const label=textSprite(`🕯️ ${name}`,{size:.55,color:'#4a3f35'});label.position.y=.5;g.add(label);
  this.scene.add(g);this.items.push({type:'memorial',mesh:g,flame,t:0,life:Infinity});
 }
 clear(){for(const it of this.items){this.scene.remove(it.sprite||it.mesh);}this.items=[];}
 update(dt){
  for(const it of this.items){
   it.t+=dt;if(it.t<0)continue;
   const k=Math.min(1,it.t/it.life);
   if(it.type==='float'||it.type==='cash'){it.sprite.position.y=it.base.y+k*.9;it.sprite.material.opacity=1-k*k;}
   else if(it.type==='shake'){it.sprite.position.x=it.base.x+Math.sin(it.t*40)*.04;it.sprite.position.y=it.base.y+k*.3;it.sprite.material.opacity=1-k*k;}
   else if(it.type==='hearts'){it.sprite.position.y=it.base.y+k*1.1;it.sprite.position.x=it.base.x+Math.sin(it.t*5)*it.drift;it.sprite.material.opacity=1-k;}
   else if(it.type==='confetti'){it.v.y-=6*dt;it.mesh.position.addScaledVector(it.v,dt);it.mesh.rotation.x+=it.spin*dt;it.mesh.rotation.y+=it.spin*dt;}
   else if(it.type==='ghost'){it.sprite.position.y=it.base.y+k*2.2;it.sprite.position.x=it.base.x+Math.sin(it.t*3)*.15;it.sprite.material.opacity=k<.15?k/.15:1-(k-.15)/.85;}
   else if(it.type==='memorial'){it.flame.scale.y=1.4+Math.sin(it.t*9)*.25;}
  }
  this.items=this.items.filter(it=>{if(it.t<it.life)return true;this.scene.remove(it.sprite||it.mesh);it.sprite?.material.map.dispose();return false;});
 }
}
