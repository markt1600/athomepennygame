import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {planPoint,floorHeight} from './house/house-layout.js';

// Places where a family member actually uses the furniture: chairs to sit on
// at the desks and the dining table, sofa seats, three toilets, both beds to
// lie in, three shower cubicles, the lounge sofa for games and the exercise mat.
// Every station is exclusive, so two people never end up on the same spot.
// Chair stations follow their chairs when the player pushes them.
const OFFICE_CHAIRS=[
 {x:.45,z:-4.60,yaw:-Math.PI/2,existing:true},                 // the gaming chair, now facing the dual-monitor desk
 {x:.45,z:-5.55,yaw:Math.PI,color:0x2f4a3f,name:'Green office chair at the simulator desk'},
 {x:1.55,z:-5.55,yaw:Math.PI,color:0x5a3d2e,name:'Brown office chair at the simulator desk'},
];
export function buildOfficeChair(world,root,{x,z,yaw,color,name}){
 const g=new THREE.Group();g.name=name;g.position.set(x,floorHeight(x,z),z);g.rotation.y=yaw;root.add(g);
 const steel=world.mat(0x808480,.24,.8),black=world.mat(0x171a19,.46),fabric=world.mat(color,.9);
 const soft=(w,h,d,px,py,pz,mat)=>{const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,.025),mat);m.position.set(px,py,pz);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 world.cyl(.033,.055,.41,0,.24,0,steel,g);
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5,end=new THREE.Vector3(Math.cos(a)*.33,.06,Math.sin(a)*.33),start=new THREE.Vector3(0,.12,0),dir=end.clone().sub(start);
  const rod=world.cyl(.017,.017,dir.length(),...start.clone().add(end).multiplyScalar(.5).toArray(),black,g,10);rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
  world.cyl(.037,.037,.04,end.x,.04,end.z,black,g,10);}
 soft(.56,.11,.55,0,.46,0,fabric);soft(.54,.8,.12,0,.9,-.23,fabric).rotation.x=-.1;soft(.32,.15,.14,0,1.12,-.14,black);
 for(const px of [-.31,.31]){world.cyl(.017,.017,.26,px,.56,-.06,black,g,8);soft(.07,.06,.34,px,.7,.02,black);}
 return g;
}
const facing=yaw=>({fx:Math.sin(yaw),fz:Math.cos(yaw)});
// Standing spots around a station: behind it first, then either side.
const around=(x,z,yaw,offsets)=>{const {fx,fz}=facing(yaw);return offsets.map(([side,back])=>({x:x+fx*back-fz*side,z:z+fz*back+fx*side}));};
const CHAIR_OFFSETS=[[0,-.62],[.5,-.15],[-.5,-.15],[0,-.9],[.55,-.4],[-.55,-.4]];
function chairStation(id,zone,item,seatTop){
 return {id,zone,kind:'sit',pose(){const g=item.group,yaw=g.rotation.y;return {x:g.position.x,z:g.position.z,floor:g.position.y,top:g.position.y+seatTop,yaw,...facing(yaw)};},approaches(){const g=item.group;return around(g.position.x,g.position.z,g.rotation.y,CHAIR_OFFSETS);}};
}
function fixedStation(id,zone,kind,plan,yaw,{top=null,approachOffsets=CHAIR_OFFSETS,approachPoints=null}={}){
 const [x,z]=planPoint(...plan),floor=floorHeight(x,z),pose={x,z,floor,top:top===null?floor:floor+top,yaw,...facing(yaw)};
 const approaches=approachPoints?approachPoints.map(p=>{const [ax,az]=planPoint(...p);return {x:ax,z:az};}):around(x,z,yaw,approachOffsets);
 return {id,zone,kind,pose:()=>pose,approaches:()=>approaches};
}
export function buildStations(world){
 const items=world.movableFurniture.items,office=world.homeOffice,stations=[];
 const place=(item,{x,z,yaw})=>{const g=item.group;g.position.set(x,g.position.y,z);g.rotation.y=yaw;Object.assign(item.collider,{x,z,angle:yaw});item.start=g.position.clone();};
 for(const spec of OFFICE_CHAIRS){
  let item;
  if(spec.existing){item=items.find(i=>i.group===office.chair);place(item,spec);}
  else{const g=buildOfficeChair(world,world.houseRoot,spec);world.movableFurniture.add(g,{w:.75,d:.72,top:.53});item=items[items.length-1];}
  stations.push(chairStation('desk-'+stations.length,'desk',item,.52));
 }
 for(const item of items.filter(i=>i.group.name==='Dining chair'))stations.push(chairStation('table-'+stations.length,'table',item,.505));
 // The orange north sofa in the sunken living room: three seats facing the room.
 for(const [i,dx] of [-.9,0,.9].entries())stations.push(fixedStation('sofa-'+i,'sofa','sit',[406+dx*38.57,556],0,{top:.58,approachOffsets:[[0,.9],[.5,.9],[-.5,.9]]}));
 // Toilets: the powder room (seat facing north), the main bathroom (facing west)
 // and the second bathroom (facing east). People use whichever is nearest.
 const IN_FRONT=[[0,.7],[.4,.7],[-.4,.7],[0,1]];
 stations.push(fixedStation('toilet-0','toilet','sit',[360,462],Math.PI,{top:.44,approachOffsets:IN_FRONT}));
 stations.push(fixedStation('toilet-1','toilet','sit',[935,254],-Math.PI/2,{top:.44,approachOffsets:IN_FRONT}));
 stations.push(fixedStation('toilet-2','toilet','sit',[998,477],Math.PI/2,{top:.44,approachOffsets:IN_FRONT}));
 // Beds: two places each, heads on the pillows at the west end.
 for(const [i,dz] of [-.5,.5].entries())stations.push(fixedStation('bed-'+i,'bed','lie',[579+6,331+dz*38.57],-Math.PI/2,{top:.555,approachPoints:[[579+55,331+dz*38.57],[579,331+dz*60],[579+30,331+dz*60]]}));
 // The second bed is hemmed in on its east side, so both places are reached from its foot.
 for(const [i,pz] of [332,367].entries())stations.push(fixedStation('kidbed-'+i,'kidbed','lie',[962,pz],-Math.PI/2,{top:.59,approachPoints:[[962,389],[940,389],[985,389],[1009,pz]]}));
 // Showers: the glass cubicles in the main bathroom, the powder room and the second bathroom.
 stations.push(fixedStation('shower-0','tub','shower',[935,216],Math.PI/2,{approachPoints:[[927,244],[938,244],[916,244],[905,244]]}));
 stations.push(fixedStation('shower-1','tub','shower',[333,455],0,{approachPoints:[[333,426],[333,419],[341,419],[341,426]]}));
 stations.push(fixedStation('shower-2','tub','shower',[1005,548],-Math.PI/2,{approachPoints:[[1005,515],[1012,515],[998,515],[1005,508]]}));
 // Playing: the window-lounge sofa's south seat and the lounge chair, both facing
 // the movie screen. The coffee table fills the space in front, so both are
 // reached from the gap at the sofa's south end.
 const LOUNGE_GAP=[[372,318],[380,318],[387,318],[395,318]];
 stations.push(fixedStation('play-0','tv','sit',[341,271+.58*38.57],Math.PI/2,{top:.57,approachPoints:LOUNGE_GAP}));
 stations.push(fixedStation('play-1','tv','sit',[353,345],Math.PI/2,{top:.55,approachPoints:LOUNGE_GAP}));
 // Two mats in the meditation alcove.
 for(const [i,dz] of [-.45,.45].entries())stations.push(fixedStation('mat-'+i,'mat','exercise',[563,228+dz*38.57],0,{approachOffsets:[[0,-.6],[.6,0],[-.6,0],[0,.6]]}));
 world.stations=stations;return stations;
}
export const stationPose=station=>station.pose();
export const stationApproaches=station=>station.approaches();
