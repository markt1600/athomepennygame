// PennyGame's little synthesised sound effects, unchanged in spirit.
let context=null,muted=false;
function beep(freq,dur,type='sine',vol=.15){
 if(muted)return;
 try{
  context=context||new (window.AudioContext||window.webkitAudioContext)();
  if(context.state==='suspended')context.resume().catch(()=>{});
  const o=context.createOscillator(),g=context.createGain();
  o.type=type;o.frequency.value=freq;
  g.gain.setValueAtTime(vol,context.currentTime);
  g.gain.exponentialRampToValueAtTime(.001,context.currentTime+dur);
  o.connect(g);g.connect(context.destination);
  o.start();o.stop(context.currentTime+dur);
 }catch{}
}
const later=(ms,fn)=>setTimeout(fn,ms);
export const sfx={
 request:()=>beep(880,.12,'square',.08),
 serve:()=>{beep(523,.1);later(90,()=>beep(784,.15));},
 miss:()=>beep(220,.3,'sawtooth',.12),
 death:()=>{beep(196,.4,'sawtooth',.15);later(250,()=>beep(131,.6,'sawtooth',.15));},
 peaceful:()=>{beep(660,.35,'sine',.1);later(300,()=>beep(523,.4,'sine',.09));later(650,()=>beep(392,.7,'sine',.08));},
 income:()=>beep(1047,.08,'triangle',.07),
 cash:()=>{beep(1320,.07,'triangle',.1);later(70,()=>beep(1760,.12,'triangle',.1));},
 broke:()=>beep(150,.2,'square',.1),
 tickle:()=>{beep(1200,.07,'sine',.1);later(80,()=>beep(1500,.07,'sine',.1));later(160,()=>beep(1300,.07,'sine',.1));},
 zombie:()=>{beep(90,.5,'sawtooth',.13);later(400,()=>beep(72,.7,'sawtooth',.13));},
 chomp:()=>{beep(200,.08,'square',.16);later(140,()=>beep(160,.08,'square',.16));later(280,()=>beep(120,.12,'square',.16));},
 step:()=>beep(140,.04,'triangle',.02),
 open:()=>beep(700,.05,'sine',.05),
};
export function play(name){sfx[name]?.();}
export function setMuted(value){muted=value;}
export function isMuted(){return muted;}
