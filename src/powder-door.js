import * as THREE from 'three';
import {planPoint,floorHeight} from './house/house-layout.js';

// The powder-room door. At Home leaves this doorway open; here a white panel
// door hangs on the north jamb and swings into the room. Whoever sits on the
// toilet shuts it and it opens again as they get up. Its collider follows the
// leaf, so the player cannot walk through a shut door, and the navigation
// graph is built with the door standing open, where the leaf hugs the wall.
const OPENING=[415,433],WIDTH=.9,LEAF=.83,HEIGHT=2.06,THICK=.04;
export const DOOR_OPEN=Math.PI*.55,DOOR_CLOSED=0;   // radians swung into the room from the wall plane
const SWING=2.4;                                     // radians per second

export function buildPowderDoor(world){
 const [wx,wz]=planPoint(...OPENING),floor=floorHeight(...planPoint(380,433));
 const hinge=new THREE.Group();hinge.name='Powder room door';hinge.userData.dynamic=true;
 hinge.position.set(wx-.035,floor,wz-WIDTH/2+.034);(world.houseRoot||world.scene).add(hinge);
 const paint=world.mat(0xf4f1ea,.55),brass=world.mat(0xcfae5a,.3,.8);
 const leaf=world.box(THICK,HEIGHT,LEAF,0,HEIGHT/2+.01,LEAF/2,paint,hinge);leaf.name='Powder room door leaf';
 for(const y of [.55,1.35])world.box(THICK+.012,.42,LEAF-.2,0,y,LEAF/2,paint,hinge);   // raised panels
 for(const side of [-1,1]){world.cyl(.011,.011,.1,side*(THICK/2+.02),1.0,LEAF-.08,brass,hinge,10).rotation.z=Math.PI/2;world.cyl(.009,.009,.06,side*(THICK/2+.045),1.0,LEAF-.11,brass,hinge,10).rotation.x=Math.PI/2;}
 const collider={x:0,z:0,w:LEAF,d:THICK+.04,angle:0,door:'powder'};world.colliders.push(collider);
 const door={hinge,collider,angle:DOOR_OPEN,target:DOOR_OPEN,
  get shut(){return this.angle<.05;},
  pose(){const dx=-Math.sin(this.angle),dz=Math.cos(this.angle);hinge.rotation.y=-this.angle;collider.x=hinge.position.x+dx*LEAF/2;collider.z=hinge.position.z+dz*LEAF/2;collider.angle=-Math.atan2(dz,dx);},
  // `shut` asks for the door to close; it waits while the player stands in the doorway.
  update(dt,shut,player=null){
   let target=shut?DOOR_CLOSED:DOOR_OPEN;
   if(shut&&player&&Math.hypot(player.x-wx,player.z-wz)<.9)target=this.angle;
   this.target=target;
   if(this.angle===target)return;
   const step=SWING*dt;this.angle=Math.abs(target-this.angle)<=step?target:this.angle+Math.sign(target-this.angle)*step;
   this.pose();
  },
  reset(){this.angle=this.target=DOOR_OPEN;this.pose();},
 };
 door.pose();world.powderDoor=door;return door;
}
