import {HOUSE_ROOMS,pointInPolygon,floorHeight} from './house/house-layout.js';
import {HOUSE_STAIRS} from './house/house-layout.js';
import {intersectsFootprint} from './house/navigation.js';

// The player's walkability test scans every room and every piece of furniture.
// Building a graph needs tens of thousands of samples, so index both by their
// bounding boxes first. The rules are otherwise identical to inWalkableArea.
export class FloorMap{
 constructor(colliders,padding=.16){
  this.padding=padding;
  const bbox=poly=>{const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]);return [Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];};
  this.areas=[...HOUSE_ROOMS.filter(r=>r.walkable!==false),...HOUSE_STAIRS].map(r=>({polygon:r.polygon,box:bbox(r.polygon)}));
  // Padding applies in the footprint's own frame, so a rotated box grows on
  // both axes before it is projected onto world x and z.
  this.solids=colliders.map(c=>{const a=c.angle||0,hw=c.w/2+padding,hd=c.d/2+padding,ex=Math.abs(Math.cos(a))*hw+Math.abs(Math.sin(a))*hd,ez=Math.abs(Math.sin(a))*hw+Math.abs(Math.cos(a))*hd;return {c,box:[c.x-ex,c.z-ez,c.x+ex,c.z+ez]};});
 }
 inside(x,z){return this.areas.some(a=>x>=a.box[0]&&x<=a.box[2]&&z>=a.box[1]&&z<=a.box[3]&&pointInPolygon(x,z,a.polygon));}
 walkable(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z)||!this.inside(x,z))return false;
  let floor;
  for(const {c,box} of this.solids){
   if(x<box[0]||x>box[2]||z<box[1]||z>box[3])continue;
   if(c.top!==undefined){floor??=floorHeight(x,z);if(c.top<=floor+.015)continue;}
   if(intersectsFootprint(x,z,c,this.padding))return false;
  }
  return true;
 }
}

// A walking graph over the whole house, sampled on a 20 cm grid. Links use the
// same floor-following rules as the player, so family members climb the same
// small steps, pass through the same doorways and stop at the same furniture.
class Heap{
 constructor(){this.items=[];}
 get size(){return this.items.length;}
 push(item){const a=this.items;a.push(item);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].f<=a[i].f)break;[a[p],a[i]]=[a[i],a[p]];i=p;}}
 pop(){const a=this.items,top=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<a.length&&a[l].f<a[m].f)m=l;if(r<a.length&&a[r].f<a[m].f)m=r;if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m;}}return top;}
}
const key=(i,j)=>i+','+j;
export const roomAt=(x,z)=>HOUSE_ROOMS.find(r=>pointInPolygon(x,z,r.polygon))||null;

export class NavGraph{
 constructor(colliders,{step=.2,random=Math.random}={}){
  this.step=step;this.random=random;this.colliders=colliders;
  this.fixed=colliders.filter(c=>!c.movable);
  this.dynamic=colliders.filter(c=>c.movable||c.wall==='fridge-door');
  this.floor=new FloorMap(this.fixed);this.all=new FloorMap(colliders);
  this.nodes=new Map();
  const points=HOUSE_ROOMS.flatMap(r=>r.polygon),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
  const i0=Math.ceil(Math.min(...xs)/step),i1=Math.floor(Math.max(...xs)/step),j0=Math.ceil(Math.min(...zs)/step),j1=Math.floor(Math.max(...zs)/step);
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){
   const x=i*step,z=j*step;
   if(!this.floor.walkable(x,z))continue;
   this.nodes.set(key(i,j),{key:key(i,j),i,j,x,z,y:floorHeight(x,z),room:roomAt(x,z)?.id||null,links:[]});
  }
  // Adjacent samples are 20 cm apart: every 5 cm between them must be clear
  // (a diagonal cabinet's padded corner can clip a link between two clear
  // nodes) and the floor may only change by an ordinary riser.
  const reaches=(a,b)=>{if(b.y-a.y>.22||a.y-b.y>.32)return false;const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.05);for(let i=1;i<n;i++)if(!this.floor.walkable(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;return true;};
  for(const n of this.nodes.values()){
   for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const m=this.nodes.get(key(n.i+di,n.j+dj));if(m&&reaches(n,m))n.links.push({node:m,cost:step});}
  }
  // Diagonals only where both orthogonal neighbours already connect, so a path
  // never clips the corner of a wall or a cabinet.
  for(const n of this.nodes.values()){
   for(const [di,dj] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
    const m=this.nodes.get(key(n.i+di,n.j+dj)),a=this.nodes.get(key(n.i+di,n.j)),b=this.nodes.get(key(n.i,n.j+dj));
    if(!m||!a||!b)continue;
    const ok=n.links.some(l=>l.node===a)&&n.links.some(l=>l.node===b)&&a.links.some(l=>l.node===m)&&b.links.some(l=>l.node===m)&&reaches(n,m);
    if(ok)n.links.push({node:m,cost:step*Math.SQRT2});
   }
  }
 }
 blocked(n){return this.dynamic.some(c=>intersectsFootprint(n.x,n.z,c));}
 // Pushed chairs also clip the links between clear nodes; sample the link at 5 cm.
 blockedLink(a,b){
  if(!this.dynamic.length)return false;
  const near=this.dynamic.filter(c=>Math.hypot(c.x-a.x,c.z-a.z)<Math.max(c.w,c.d)+.6);if(!near.length)return false;
  const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.05);
  for(let i=1;i<n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;if(near.some(c=>intersectsFootprint(x,z,c)))return true;}
  return false;
 }
 // Nearest usable node, searched outward ring by ring from the sample point.
 nearest(x,z,{maxDist=1.6,exclude=null,levelOf=null}={}){
  const step=this.step,ci=Math.round(x/step),cj=Math.round(z/step),rings=Math.ceil(maxDist/step);
  let best=null,bestD=Infinity;
  for(let r=0;r<=rings;r++){
   for(let di=-r;di<=r;di++)for(let dj=-r;dj<=r;dj++){
    if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;
    const n=this.nodes.get(key(ci+di,cj+dj));if(!n||this.blocked(n)||(exclude&&exclude(n)))continue;
    if(levelOf!==null&&Math.abs(n.y-levelOf)>.3)continue;
    const d=Math.hypot(n.x-x,n.z-z);if(d<bestD){bestD=d;best=n;}
   }
   if(best&&bestD<=r*step)break;
  }
  return bestD<=maxDist?best:null;
 }
 // Several nodes around a point, nearest first. Zones seat multiple visitors.
 nearestNodes(x,z,{count=6,maxDist=1.5,exclude=null}={}){
  const out=[],step=this.step,ci=Math.round(x/step),cj=Math.round(z/step),rings=Math.ceil(maxDist/step);
  for(let di=-rings;di<=rings;di++)for(let dj=-rings;dj<=rings;dj++){
   const n=this.nodes.get(key(ci+di,cj+dj));if(!n||this.blocked(n)||(exclude&&exclude(n)))continue;
   const d=Math.hypot(n.x-x,n.z-z);if(d<=maxDist)out.push({n,d});
  }
  return out.sort((a,b)=>a.d-b.d).slice(0,count).map(o=>o.n);
 }
 route(from,to,{smooth=true,avoid=null}={}){
  const start=this.nearest(from.x,from.z),goal=to.key?to:this.nearest(to.x,to.z);
  if(!start||!goal)return null;
  const avoided=n=>n!==goal&&n!==start&&avoid?.some(a=>Math.hypot(n.x-a.x,n.z-a.z)<a.r);
  const h=n=>Math.hypot(n.x-goal.x,n.z-goal.z);
  const open=new Heap(),g=new Map([[start.key,0]]),parent=new Map(),closed=new Set();
  open.push({n:start,f:h(start)});
  let found=null;
  while(open.size){
   const {n}=open.pop();if(closed.has(n.key))continue;closed.add(n.key);
   if(n===goal){found=n;break;}
   const gn=g.get(n.key);
   for(const {node,cost} of n.links){
    if(closed.has(node.key)||this.blocked(node)||this.blockedLink(n,node)||(avoid&&avoided(node)))continue;
    const ng=gn+cost;if(ng<(g.get(node.key)??Infinity)){g.set(node.key,ng);parent.set(node.key,n);open.push({n:node,f:ng+h(node)});}
   }
  }
  if(!found)return null;
  const path=[];for(let n=found;n;n=parent.get(n.key))path.unshift(n);
  if(Math.hypot(start.x-from.x,start.z-from.z)>.002)path.unshift({x:from.x,z:from.z,y:floorHeight(from.x,from.z)});
  return smooth?this.smooth(path):path.map(n=>({x:n.x,z:n.z,y:n.y}));
 }
 // Sampled every 4 cm: the padded corner of a diagonal cabinet can clip a
 // straight segment for less than 10 cm, and a walker following that segment
 // would jam on it.
 clear(a,b){
  const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.04));let x=a.x,z=a.z,h=floorHeight(x,z);
  for(let i=1;i<=count;i++){
   const nx=a.x+(b.x-a.x)*i/count,nz=a.z+(b.z-a.z)*i/count;
   if(!this.all.walkable(nx,nz))return false;
   const nh=floorHeight(nx,nz);if(nh-h>.22||h-nh>.32)return false;h=nh;x=nx;z=nz;
  }
  return true;
 }
 // String pulling: keep the furthest node each corner can see directly.
 smooth(path){
  if(path.length<3)return path.map(n=>({x:n.x,z:n.z,y:n.y}));
  const out=[path[0]];let i=0;
  while(i<path.length-1){
   let j=Math.min(path.length-1,i+24);
   while(j>i+1&&!this.clear(path[i],path[j]))j--;
   out.push(path[j]);i=j;
  }
  return out.map(n=>({x:n.x,z:n.z,y:n.y}));
 }
 // A place to drift to: open floor between one and eight metres of walking away.
 wanderTarget(from,{min=1.2,max=8,rooms=null}={}){
  const start=this.nearest(from.x,from.z,{maxDist:1});if(!start)return null;
  const dist=new Map([[start.key,0]]),queue=[start],choices=[];
  for(let i=0;i<queue.length;i++){
   const n=queue[i],d=dist.get(n.key);
   if(d>=min&&n.links.length>=7&&(!rooms||rooms.includes(n.room))&&!this.blocked(n))choices.push(n);
   if(d>=max)continue;
   for(const {node,cost} of n.links)if(!dist.has(node.key)){dist.set(node.key,d+cost);queue.push(node);}
  }
  if(!choices.length)return null;
  return choices[Math.floor(this.random()*choices.length)];
 }
 reachable(from,to){return !!this.route(from,to,{smooth:false});}
}
