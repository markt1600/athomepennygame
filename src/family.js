import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Little 3D versions of PennyGame's canvas family: round heads, bright shirts,
// swinging legs, and arms that wave in the air when someone needs something.
const materials=new Map();
export const colorMat=(hex,roughness=.85)=>{const key=hex+':'+roughness;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:new THREE.Color(hex),roughness}));return materials.get(key);};
const geo={
 leg:new THREE.CylinderGeometry(.055,.05,.5,10),arm:new THREE.CylinderGeometry(.045,.04,.42,10),
 body:new THREE.CylinderGeometry(.16,.19,.46,16),shoulders:new THREE.SphereGeometry(.165,16,10),
 head:new THREE.SphereGeometry(.19,20,14),hair:new THREE.SphereGeometry(.2,18,12),bun:new THREE.SphereGeometry(.09,12,8),
 eye:new THREE.SphereGeometry(.028,8,6),cheek:new THREE.SphereGeometry(.03,8,6),tail:new THREE.CylinderGeometry(.05,.03,.28,8),
 shadow:new THREE.CircleGeometry(.3,24),foot:new THREE.SphereGeometry(.065,10,8),
};
const shadowMat=new THREE.MeshBasicMaterial({color:0x2a3128,transparent:true,opacity:.18,depthWrite:false});
const black=colorMat('#1d1a18',.5),white=colorMat('#ffffff',.4),pink=colorMat('#ff9db2',.9);

// Each doll is only a few draw calls: every limb, the body and the head are
// merged into one vertex-coloured mesh apiece, sharing a single material.
const dollMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85});
const paint=(geometry,hex)=>{const color=new THREE.Color(hex),n=geometry.attributes.position.count,data=new Float32Array(n*3);for(let i=0;i<n;i++)color.toArray(data,i*3);geometry.setAttribute('color',new THREE.BufferAttribute(data,3));return geometry;};
function merged(parts){
 const list=parts.map(({geometry,color,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0]})=>{const g=geometry.clone();g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale)));return paint(g,color);});
 const mesh=new THREE.Mesh(mergeGeometries(list,false),dollMaterial);for(const g of list)g.dispose();mesh.castShadow=true;return mesh;
}
export function createDoll(c,{zombie=false}={}){
 const g=new THREE.Group();g.name=c.name;
 const skin=zombie?'#8bc34a':c.skin,shirt=zombie?'#5d7052':c.shirt,hair=zombie?'#2f3a26':c.hair,trousers=zombie?'#33402e':'#3f4d6b',shoe='#1d1a18';
 const pivot=(x,y,z,mesh)=>{const p=new THREE.Group();p.position.set(x,y,z);p.add(mesh);g.add(p);return p;};
 const shadow=new THREE.Mesh(geo.shadow,shadowMat);shadow.rotation.x=-Math.PI/2;shadow.position.y=.004;g.add(shadow);
 const legs=[-.075,.075].map(x=>pivot(x,.52,0,merged([{geometry:geo.leg,color:trousers,position:[0,-.25,0]},{geometry:geo.foot,color:shoe,position:[0,-.5,.03],scale:[1,.7,1.4]}])));
 g.add(merged([{geometry:geo.body,color:shirt,position:[0,.76,0]},{geometry:geo.shoulders,color:shirt,position:[0,.98,0],scale:[1,.55,1]}]));
 const arms=[-.21,.21].map(x=>pivot(x,.98,0,merged([{geometry:geo.arm,color:shirt,position:[0,-.19,0]},{geometry:geo.foot,color:skin,position:[0,-.42,0],scale:[.85,.85,.85]}])));
 const headParts=[{geometry:geo.head,color:skin,position:[0,.16,0]}];
 if(zombie)headParts.push({geometry:geo.hair,color:hair,position:[0,.28,-.03],scale:[1,.7,1]});
 else if(c.hairStyle===0)headParts.push({geometry:geo.hair,color:hair,position:[0,.27,-.03],scale:[1.02,.72,1.02]});           // short crop
 else if(c.hairStyle===1)headParts.push({geometry:geo.hair,color:hair,position:[0,.22,-.03],scale:[1.03,.9,1.03]},{geometry:geo.bun,color:hair,position:[-.19,.28,-.02]},{geometry:geo.bun,color:hair,position:[.19,.28,-.02]});   // side buns
 else if(c.hairStyle===2)headParts.push({geometry:geo.hair,color:hair,position:[0,.26,-.03],scale:[1.02,.78,1.02]},{geometry:geo.bun,color:hair,position:[.02,.4,-.02],scale:[.6,1,.6]});   // short with a tuft
 else headParts.push({geometry:geo.hair,color:hair,position:[0,.22,-.03],scale:[1.03,.95,1.03]},{geometry:geo.tail,color:hair,position:[0,.1,-.2],rotation:[.55,0,0]});   // ponytail
 if(!zombie)for(const x of [-.11,.11])headParts.push({geometry:geo.cheek,color:'#ff9db2',position:[x,.12,.15],scale:[1,.6,.5]});
 if(zombie){headParts.push({geometry:geo.cheek,color:'#1d1a18',position:[0,.07,.17],scale:[1.6,.9,.5]});for(const x of [-.03,.03])headParts.push({geometry:geo.cheek,color:'#ffffff',position:[x,.055,.19],scale:[.35,.6,.3]});}
 const headPivot=pivot(0,1.14,0,merged(headParts));
 const eyes=[-.07,.07].map(x=>{const e=new THREE.Mesh(geo.eye,zombie?colorMat('#b71c1c',.4):black);e.position.set(x,.17,.165);if(zombie&&x>0)e.scale.setScalar(.7);headPivot.add(e);return e;});
 const bubble=createBubble();bubble.position.y=1.85;g.add(bubble);
 let phase=Math.random()*6,t=0,blink=2+Math.random()*3;
 g.userData.update=(dt,state,moving,speed,options={})=>{
  t+=dt;blink-=dt;if(blink<-.12)blink=2+Math.random()*4;
  const walkSpeed=moving?Math.max(.4,speed||.9):0;phase+=dt*walkSpeed*9;
  const swing=moving?Math.sin(phase)*.65:0;
  legs[0].rotation.x=swing;legs[1].rotation.x=-swing;
  let armL=-swing*.8,armR=swing*.8,armZ=.12,bob=moving?Math.abs(Math.sin(phase))*.03:Math.sin(t*2)*.01,tilt=0,headY=0;
  if(state==='request'){const wave=Math.sin(t*11)*.35;armL=-.4;armR=-.4;armZ=2.55+wave;bob=Math.abs(Math.sin(t*6))*.05;}
  else if(state==='work'){armL=armR=-1.15+Math.sin(t*9)*.06;armZ=.35;}
  else if(state==='happy'){bob=Math.abs(Math.sin(t*10))*.14;armZ=1.2+Math.sin(t*10)*.5;armL=armR=-.3;}
  else if(state==='tickle'){tilt=Math.sin(t*22)*.14;armZ=1.6;armL=armR=.4;bob=Math.abs(Math.sin(t*16))*.05;}
  else if(state==='doomed'){tilt=Math.sin(t*35)*.05;armZ=2.3;armL=armR=-.9;}
  else if(zombie){armL=armR=-1.45+Math.sin(t*3)*.1;armZ=.15;headY=Math.sin(t*2.2)*.08;}
  arms[0].rotation.set(armL,0,armZ);arms[1].rotation.set(armR,0,-armZ);
  g.rotation.z=tilt;headPivot.rotation.set(headY,0,0);headPivot.position.y=1.14+bob;
  const eyeScale=blink<0?.15:1;eyes[0].scale.y=eyeScale;eyes[1].scale.y=eyeScale*(zombie?.7:1);
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
