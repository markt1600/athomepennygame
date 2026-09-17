import * as THREE from 'three';
import {buildHouse} from '../src/house/house.js';
import {optimizeHouse} from '../src/house/house-meshes.js';
import {mat,box,cyl,sphere} from '../src/primitives.js';

// A headless world: enough of the World interface for the house builder,
// tests and scripts, with no renderer, DOM or textures.
export function createHouseModel({optimize=true}={}){
 const world={scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),materials:{},colliders:[],targets:[],mat,box,cyl,sphere};
 buildHouse(world);if(optimize)world.optimization=optimizeHouse(world);return world;
}
