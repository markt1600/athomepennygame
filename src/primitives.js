import * as THREE from 'three';

// Shared mesh helpers. The house builder calls these as world methods, so they
// use `this` for the material cache and default parent.
export function mat(color,roughness=.8,metalness=0){const key=[color,roughness,metalness].join();return this.materials[key]||(this.materials[key]=new THREE.MeshStandardMaterial({color,roughness,metalness}));}
export function box(w,h,d,x,y,z,material,parent=this.scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof material==='number'?this.mat(material):material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
export function cyl(rt,rb,h,x,y,z,material,parent=this.scene,n=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,n),typeof material==='number'?this.mat(material):material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
export function sphere(r,x,y,z,material,parent=this.scene,sx=1,sy=1,sz=1){const m=new THREE.Mesh(new THREE.SphereGeometry(r,24,16),typeof material==='number'?this.mat(material):material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m;}
