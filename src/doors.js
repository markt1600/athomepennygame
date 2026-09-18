import * as THREE from 'three';
import {planPoint,floorHeight} from './house/house-layout.js';

// Bathroom doors. At Home leaves these doorways open; here a white panel door
// hangs in each and swings into the room. Whoever uses the toilet or the
// shower shuts it and it opens again as they leave. Each door's collider
// follows the leaf, so the player cannot walk through a shut door, and the
// navigation graph is built with every door standing open.
const WIDTH=.9,LEAF=.83,HEIGHT=2.06,THICK=.04,SWING=2.4;   // metres and radians per second
// u: the wall's direction; n: into the room; hinge: which jamb along u; open: how far the leaf swings.
export const DOORS=[
 {id:'powder',room:'powder',opening:[415,433],u:[0,1],n:[-1,0],hinge:-1,open:Math.PI*.55,stations:['toilet-0','shower-1'],inside:[380,433]},
 {id:'bath',room:'bath',opening:[868,250],u:[0,1],n:[1,0],hinge:1,open:Math.PI*.5,stations:['toilet-1','shower-0'],inside:[900,250]},
 {id:'guest-bath',room:'guest_bath',opening:[1023,457],u:[1,0],n:[0,1],hinge:1,open:Math.PI*.58,stations:['toilet-2','shower-2'],inside:[1023,490]},
];

export function buildDoor(world,spec){
 const [wx,wz]=planPoint(...spec.opening),floor=floorHeight(...planPoint(...spec.inside)),[ux,uz]=spec.u,[nx,nz]=spec.n;
 const hx=wx+ux*spec.hinge*(WIDTH/2-.034)+nx*.035,hz=wz+uz*spec.hinge*(WIDTH/2-.034)+nz*.035;   // the jamb, on the room side of the wall
 const hinge=new THREE.Group();hinge.name=spec.id+' door';hinge.userData.dynamic=true;hinge.position.set(hx,floor,hz);(world.houseRoot||world.scene).add(hinge);
 const paint=world.mat(0xf4f1ea,.55),brass=world.mat(0xcfae5a,.3,.8);
 const leaf=world.box(THICK,HEIGHT,LEAF,0,HEIGHT/2+.01,LEAF/2,paint,hinge);leaf.name=spec.id+' door leaf';
 for(const y of [.55,1.35])world.box(THICK+.012,.42,LEAF-.2,0,y,LEAF/2,paint,hinge);   // raised panels
 for(const side of [-1,1]){world.cyl(.011,.011,.1,side*(THICK/2+.02),1.0,LEAF-.08,brass,hinge,10).rotation.z=Math.PI/2;world.cyl(.009,.009,.06,side*(THICK/2+.045),1.0,LEAF-.11,brass,hinge,10).rotation.x=Math.PI/2;}
 const collider={x:0,z:0,w:LEAF,d:THICK+.04,angle:0,door:spec.id};world.colliders.push(collider);
 const d0=[-ux*spec.hinge,-uz*spec.hinge];   // the closed leaf runs from the hinge to the other jamb
 const door={id:spec.id,room:spec.room,stations:spec.stations,hinge,collider,openAngle:spec.open,angle:spec.open,target:spec.open,
  get shut(){return this.angle<.05;},
  pose(){const a=this.angle,dx=d0[0]*Math.cos(a)+nx*Math.sin(a),dz=d0[1]*Math.cos(a)+nz*Math.sin(a);hinge.rotation.y=Math.atan2(dx,dz);collider.x=hx+dx*LEAF/2;collider.z=hz+dz*LEAF/2;collider.angle=-Math.atan2(dz,dx);},
  // `shut` asks for the door to close; it waits while the player stands in the doorway.
  update(dt,shut,player=null){
   let target=shut?0:this.openAngle;
   if(shut&&player&&Math.hypot(player.x-wx,player.z-wz)<.9)target=this.angle;
   this.target=target;
   if(this.angle===target)return;
   const step=SWING*dt;this.angle=Math.abs(target-this.angle)<=step?target:this.angle+Math.sign(target-this.angle)*step;
   this.pose();
  },
  reset(){this.angle=this.target=this.openAngle;this.pose();},
 };
 door.pose();return door;
}
export function buildDoors(world){
 world.doors=DOORS.map(spec=>buildDoor(world,spec));
 world.powderDoor=world.doors[0];return world.doors;
}
