import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPiAutoplay} from '../src/pi-mode.js';
test('Pi waits for artwork, starts unattended, keeps autopilot and restarts after game over',()=>{
 let ready=false,running=false,starts=0,resumes=0,autos=0,retries=0;
 const step=createPiAutoplay({ready:()=>ready,running:()=>running,start:()=>{starts++;running=true;},resume:()=>resumes++,auto:()=>autos++,retry:()=>retries++});
 step(0);assert.equal(starts,0);step(31000);assert.equal(retries,1);ready=true;step(32000);assert.equal(starts,1);assert.equal(autos,1);
 step(33000);assert.equal(starts,1);assert.equal(resumes,2);
 running=false;step(34000);step(43000);assert.equal(starts,1);step(44000);assert.equal(starts,2);assert.equal(autos,3);
});
