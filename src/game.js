import {ZONES,NEEDS,BREAK_NEED,PET_NEEDS,zoneForNeed} from './zones.js';
import {PETS} from './house/life.js';

// PennyGame's rules, transplanted into a house you walk through. Nothing here
// knows about three.js: positions and travel belong to the agent layer, which
// reports arrivals back. Timers pause while someone is walking to a chore, so
// the challenge is finding people and budgeting, not the size of the house.
export const RULES={
 REQUEST_TIME:45,      // seconds to answer a need before it is missed
 INCOME_EVERY:30, INCOME_AMT:5,
 MISS_DAMAGE:50, START_MONEY:100,
 YEAR_EVERY:10, MAX_AGE:100,   // seconds per year of age; a peaceful end at 100
 WORK_MIN_AGE:12, WORK_MAX_AGE:60,
 WORK_PAY_EVERY:10, WORK_PAY:5, WORK_BREAK_AFTER:60,
 HUMAN_BASE_COST:5, PET_BASE_COST:1, COST_CAP:10,
 WORK_NEED_DISCOUNT:.5, WORK_RAISE_YEARS:5, RAISE_AMT:1,
 FIRST_REQUEST:[10,24], NEXT_REQUEST:[14,30],
 ZOMBIE_CHOICE_TIME:10, ZOMBIE_EAT_TIME:2.4,
 HAPPY_TIME:1.8, TICKLE_TIME:1.2,
 HOURS_PER_SECOND:1/30,        // a full day of light every twelve minutes
};
const KID_NAMES=['Lily','Sam','Rosie','Theo'],KID_GENDERS=['f','m','f','m'];
export const SHIRTS=['#ff8fab','#5dade2','#af7ac5','#6fcf97','#f5b041','#e74c3c'];
export const HAIRS=['#8d5524','#2c2c2c','#d4a017','#6b3fa0','#c0392b','#3d2b1f'];
export const SKINS=['#ffe0bd','#f1c27d','#ffdbac','#e0ac69','#ffe0bd','#c68642'];
export const PANTS=['#4a3f6b','#3f4d6b','#c94f7c','#4b6b3f','#6b3f4d','#3a5a6b'];
export const sizeForAge=age=>.55+Math.min(age,18)/18*.45;
export const fmt$=v=>'$'+(Number.isInteger(v)?v:v.toFixed(2));
export const pick=(a,random=Math.random)=>a[Math.floor(random()*a.length)];

export class Game{
 constructor({hooks={},random=Math.random,rules=RULES}={}){
  this.hooks=hooks;this.random=random;this.rules=rules;
  this.chars=[];this.running=false;this.paused=false;this.zombie=null;
  this.money=0;this.incomeT=0;this.elapsed=0;this.served=0;this.earned=0;this.score=0;this.hours=7.25;this.slotCounter=0;
 }
 rand(a,b){return a+this.random()*(b-a);}
 randi(a,b){return Math.floor(this.rand(a,b+1));}
 log(msg,color){this.hooks.log?.(msg,color);}
 fx(type,c,text,color){this.hooks.fx?.(type,c,text,color);}
 sfx(name){this.hooks.sfx?.(name);}
 get humans(){return this.chars.filter(c=>!c.isPet);}
 get alive(){return this.chars.filter(c=>!c.dead);}
 timeLabel(){const m=Math.floor(this.elapsed/60),s=Math.floor(this.elapsed%60);return m+':'+String(s).padStart(2,'0');}

 makeChar(i){
  let name,age,gender;
  if(i===0){name='Penny';age=this.randi(28,36);gender='f';}
  else if(i===1){name='Max';age=this.randi(30,40);gender='m';}
  else if(i===2){name=KID_NAMES[0];age=0;gender=KID_GENDERS[0];}
  else{name=KID_NAMES[i-2];age=this.randi(3,12);gender=KID_GENDERS[i-2];}
  return {id:'h'+i,name,age,gender,ageT:0,isPet:false,shirt:SHIRTS[i],hair:HAIRS[i],skin:SKINS[i],pants:PANTS[i],
   hairStyle:gender==='f'?(i===0?1:3):(i===1?0:2),size:sizeForAge(age),
   health:100,misses:0,dead:false,deathType:null,ghostT:-1,
   state:'wander',need:null,reqT:0,nextReq:this.rand(...this.rules.FIRST_REQUEST),happyT:0,tickleT:0,
   workTimer:0,workSession:0,careerS:0,wasWorking:false,deskSlot:0,atDesk:false,destination:null,paid:0,
   x:0,z:0,y:0,heading:0};
 }
 makePet(i){
  const def=PETS[i];
  return {id:def.id,name:def.name,kind:def.kind,emoji:def.emoji,age:0,ageT:0,isPet:true,height:def.height,size:1,
   health:100,misses:0,dead:false,deathType:null,ghostT:-1,
   state:'wander',need:null,reqT:0,nextReq:this.rand(...this.rules.FIRST_REQUEST)+6,happyT:0,tickleT:0,
   workTimer:0,workSession:0,careerS:0,wasWorking:false,deskSlot:0,atDesk:false,destination:null,paid:0,
   x:0,z:0,y:0,heading:0};
 }
 start({familySize=4,petCount=1}={}){
  this.chars=[];
  for(let i=0;i<familySize;i++)this.chars.push(this.makeChar(i));
  for(let i=0;i<petCount;i++)this.chars.push(this.makePet(i));
  this.money=this.rules.START_MONEY;this.incomeT=this.rules.INCOME_EVERY;this.elapsed=0;this.served=0;this.earned=0;this.score=0;this.hours=7.25;
  this.zombie=null;this.running=true;this.paused=false;this.slotCounter=0;this.result=null;
  for(const c of this.chars)this.hooks.place?.(c);
  this.log('Take care of your family! 💕 Find whoever needs something and send them to the right room.');
 }

 onTheJob(c){return !c.isPet&&(c.state==='work'||c.wasWorking);}
 needCost(c){const r=this.rules;let cost=Math.min(r.COST_CAP,(c.isPet?r.PET_BASE_COST:r.HUMAN_BASE_COST)+Math.floor(this.elapsed/60));if(this.onTheJob(c))cost*=r.WORK_NEED_DISCOUNT;return cost;}
 workPay(c){const r=this.rules;return r.WORK_PAY+r.RAISE_AMT*Math.floor((c.careerS||0)/(r.YEAR_EVERY*r.WORK_RAISE_YEARS));}
 canWork(c){return !c.isPet&&c.age>=this.rules.WORK_MIN_AGE&&c.age<=this.rules.WORK_MAX_AGE;}
 zoneFor(c){return c.need?zoneForNeed(c,c.need):null;}

 startRequest(c,need){
  if(c.state==='work')c.wasWorking=true;
  c.state='request';c.need=need||pick(c.isPet?PET_NEEDS:NEEDS,this.random);c.reqT=this.rules.REQUEST_TIME;
  this.sfx('request');this.hooks.stop?.(c);
  const zone=this.zoneFor(c);
  if(c.need.id==='break')this.log(`${c.name} needs a break! ☕ Find them at the desk and send them to the ${zone.label}.`,'#b8860b');
  else this.log(`${c.name} ${c.need.want}! ${c.need.emoji} Send them to the ${zone.label} ${zone.hint}.`,'#b8860b');
  this.hooks.request?.(c);
 }
 satisfyRequest(c){
  const isBreak=c.need.id==='break';
  if(!isBreak){this.served++;this.fx('float',c,c.need.emoji+' -'+fmt$(c.paid)+(this.onTheJob(c)?' 💼½price!':''),'#2e7d32');}
  else this.fx('float',c,'☕ break time!','#2e7d32');
  c.health=Math.min(100,c.health+10);this.fx('hearts',c);this.sfx('serve');
  const verb=c.need.verb;
  if(isBreak){c.wasWorking=false;c.workTimer=0;c.workSession=0;this.log(`${c.name} is taking a well-earned break! ☕`,'#2e7d32');}
  else this.log(`${c.name} was ${verb}! ${c.need.emoji}`+(c.wasWorking?' They will head back to the desk.':''),'#2e7d32');
  const zone=this.zoneFor(c);c.busy=isBreak?'resting':zone?.busy||null;c.served=c.need.id;
  c.need=null;c.paid=0;c.state='happy';c.happyT=zone?.stay||this.rules.HAPPY_TIME;
  this.scheduleNext(c);
 }
 missRequest(c){
  c.misses++;c.health-=this.rules.MISS_DAMAGE;
  this.fx('float',c,'💔 -'+this.rules.MISS_DAMAGE+' HP','#c62828');this.sfx('miss');
  this.log(`You ignored ${c.name}... 💔 (${c.misses}/2 misses)`,'#c62828');
  c.wasWorking=false;c.workTimer=0;c.workSession=0;c.atDesk=false;c.need=null;
  if(c.health<=0)return this.killChar(c);
  c.state='wander';this.scheduleNext(c);
 }
 scheduleNext(c){c.nextReq=this.rand(...this.rules.NEXT_REQUEST)*Math.max(.5,1-this.elapsed/600);}
 tickle(c){
  c.state='tickle';c.tickleT=this.rules.TICKLE_TIME;this.hooks.stop?.(c);
  const txt=c.isPet?(c.kind==='dog'?pick(['woof woof! 🐶','*wags tail* 🐕','*happy zoomies!*'],this.random):c.kind==='cat'?pick(['purrrr~ 😺','*rolls over* 🐱','meow! 😸'],this.random):pick(['*slow blink* 🐢','*munches a leaf*','*wiggles happily*'],this.random))
   :pick(['hehe~ 🤭','hahaha! 😆','teehee! 😄','*giggles* 🥰'],this.random);
  this.fx('float',c,txt,'#d81b60');this.sfx('tickle');
 }
 startWork(c,resumed){
  c.state='work';c.atDesk=true;c.deskSlot=this.slotCounter++;c.destination=null;
  if(resumed){c.wasWorking=false;this.log(`${c.name} is back at the desk — work clock continues! 💼`,'#1565c0');}
  else{c.workTimer=0;c.workSession=0;c.wasWorking=false;this.log(`${c.name} started working! 💼 $${this.workPay(c)} every ${this.rules.WORK_PAY_EVERY}s`,'#1565c0');}
 }
 stopWork(c,quiet){
  c.state='wander';c.atDesk=false;c.workTimer=0;c.workSession=0;c.wasWorking=false;c.destination=null;
  if(!quiet)this.log(`${c.name} left the desk.`,'#666');
 }
 die(c,type){
  c.dead=true;c.state='dead';c.deathType=type;c.need=null;c.destination=null;c.atDesk=false;c.ghostT=0;
  this.hooks.died?.(c);
  if(this.humans.every(p=>p.dead))this.endGame();
 }
 killChar(c){this.sfx('death');this.log(`☠️ ${c.name} has died... focus on the others!`,'#000');this.die(c,'skeleton');}
 peacefulDeath(c){this.sfx('peaceful');this.log(`😇 ${c.name} lived a full life and passed away peacefully at ${c.age}...`,'#7b1fa2');this.die(c,'sleep');}

 // ---- travel -------------------------------------------------------------
 send(c,zone,purpose){
  const ok=this.hooks.go?.(c,zone,purpose);
  if(ok===false)return false;
  c.state='going';c.destination={zone:zone.id,purpose};c.atDesk=false;return true;
 }
 arrived(c){
  if(c.dead||c.state!=='going'||!c.destination)return;
  const {purpose}=c.destination;c.destination=null;
  if(purpose==='need'||purpose==='break'){if(c.need)this.satisfyRequest(c);else{c.state='wander';}}
  else if(purpose==='work')this.startWork(c,false);
  else if(purpose==='resume')this.startWork(c,true);
  else c.state='wander';
 }
 travelFailed(c){
  if(c.state!=='going')return;const {purpose}=c.destination||{};c.destination=null;
  if(purpose==='need'||purpose==='break'){c.state='request';if(c.paid){this.money+=c.paid;c.paid=0;}this.log(`${c.name} could not get there. Try again.`,'#c62828');}
  else{c.state='wander';c.wasWorking=false;}
 }

 // ---- player commands ----------------------------------------------------
 actionsFor(c){
  const out=[];if(!c||c.dead)return out;
  if(c.state==='doomed')return out;
  if(this.zombie?.phase==='choosing')out.push({id:'sacrifice',label:`Offer ${c.name} to the zombie 🧟`,danger:true});
  if(c.state==='request'&&c.need){
   const zone=this.zoneFor(c);
   if(c.need.id==='break')out.push({id:'serve',label:`Send to the ${zone.label} for a break ☕`,detail:'free'});
   else{const cost=this.needCost(c);out.push({id:'serve',label:`${c.need.emoji} Send to the ${zone.label}`,detail:fmt$(cost)+(this.onTheJob(c)?' · worker discount':''),disabled:this.money<cost?`Not enough money — you need ${fmt$(cost)}`:null});}
  }
  if(c.state==='work')out.push({id:'stop',label:'Stop working and leave the desk',detail:`next $${this.workPay(c)} in ${Math.ceil(this.rules.WORK_PAY_EVERY-c.workTimer)}s`});
  if(!c.isPet&&(c.state==='wander'||c.state==='happy'||c.state==='tickle')){
   const reason=c.age<this.rules.WORK_MIN_AGE?`Too young to work — ${c.name} is only ${c.age} 👶`:c.age>this.rules.WORK_MAX_AGE?`Retired at ${c.age}! Let them relax 🎉`:null;
   out.push({id:'work',label:'Go to work at the office desk 💼',detail:`$${this.workPay(c)} every ${this.rules.WORK_PAY_EVERY}s`,disabled:reason});
  }
  if(c.state==='wander'||c.state==='happy'||c.state==='tickle')out.push({id:'tickle',label:c.isPet?`Pet ${c.name} 🤗`:'Tickle 🤭'});
  return out;
 }
 act(c,id){
  if(!this.running||!c||c.dead)return {ok:false,message:'Nobody there.'};
  const action=this.actionsFor(c).find(a=>a.id===id);
  if(!action)return {ok:false,message:'Not right now.'};
  if(action.disabled){if(id==='serve'){this.sfx('broke');this.hooks.broke?.();}return {ok:false,message:action.disabled};}
  if(id==='sacrifice'){this.setVictim(c);return {ok:true};}
  if(id==='serve'){
   const zone=this.zoneFor(c),cost=c.need.id==='break'?0:this.needCost(c);
   const purpose=c.need.id==='break'?'break':'need';
   if(!this.send(c,zone,purpose))return {ok:false,message:`${c.name} can't find a way to the ${zone.label} right now.`};
   this.money-=cost;c.paid=cost;
   this.log(`${c.name} is heading to the ${zone.label} ${zone.emoji}`,'#1565c0');return {ok:true};
  }
  if(id==='work'){
   if(!this.send(c,ZONES.desk,'work'))return {ok:false,message:'The desk is full right now.'};
   this.log(`${c.name} is off to the office 💼`,'#1565c0');return {ok:true};
  }
  if(id==='stop'){this.stopWork(c);this.hooks.stop?.(c);return {ok:true};}
  if(id==='tickle'){this.tickle(c);return {ok:true};}
  return {ok:false,message:'Not right now.'};
 }

 // ---- zombie -------------------------------------------------------------
 spawnZombie(){
  if(!this.running||this.zombie||!this.alive.length)return false;
  this.zombie={phase:'entering',timer:0,victim:null,x:0,z:0,y:0,heading:0};
  this.sfx('zombie');this.log('🧟 A ZOMBIE is at the front door! Offer someone within 10s of its arrival — or it chooses!','#33691e');
  this.hooks.zombie?.('enter',this.zombie);return true;
 }
 zombieArrived(){if(this.zombie?.phase!=='entering')return;this.zombie.phase='choosing';this.zombie.timer=this.rules.ZOMBIE_CHOICE_TIME;this.log('🧟 "Mmm... family..." Find someone and offer them up! 10 seconds!','#33691e');this.hooks.zombie?.('choose',this.zombie);}
 setVictim(c){
  const z=this.zombie;if(!z||z.phase!=='choosing'||c.dead)return;
  z.victim=c;z.phase='walking';
  c.state='doomed';c.need=null;c.atDesk=false;c.destination=null;c.workTimer=0;c.workSession=0;c.wasWorking=false;
  if(c.paid){this.money+=c.paid;c.paid=0;}
  this.hooks.stop?.(c);this.sfx('zombie');this.log(`🧟 The zombie shambles toward ${c.name}... 😱`,'#33691e');this.hooks.zombie?.('hunt',z);
 }
 zombieReached(){const z=this.zombie;if(z?.phase!=='walking')return;z.phase='eating';z.timer=this.rules.ZOMBIE_EAT_TIME;this.sfx('chomp');this.hooks.zombie?.('eat',z);}
 zombieLeft(){if(this.zombie?.phase!=='leaving')return;this.zombie=null;if(this.running)this.log('The zombie left... for now. 🧟➡️🚪','#33691e');this.hooks.zombie?.('gone');}
 updateZombie(dt){
  const z=this.zombie;if(!z)return;
  if(z.phase==='choosing'){z.timer-=dt;if(z.timer<=0){const alive=this.alive;if(!alive.length){z.phase='leaving';this.hooks.zombie?.('leave',z);return;}this.setVictim(pick(alive,this.random));this.log(`🧟 Too slow! The zombie chose ${z.victim.name}!! 😱`,'#b71c1c');}}
  else if(z.phase==='walking'){if(!z.victim||z.victim.dead){z.victim=null;z.phase='leaving';this.hooks.zombie?.('leave',z);}}
  else if(z.phase==='eating'){z.timer-=dt;if(this.random()<dt*6)this.fx('shake',z,pick(['CHOMP!','🦴','NOM NOM','💥','😱'],this.random));
   if(z.timer<=0){const v=z.victim;z.victim=null;z.phase='leaving';this.sfx('death');this.log(`🧟 The zombie ate ${v.name} in front of everyone... only bones remain. 💀`,'#b71c1c');this.die(v,'eaten');this.hooks.zombie?.('leave',z);}}
 }

 // ---- simulation ---------------------------------------------------------
 update(dt){
  if(!this.running||this.paused||dt<=0)return;
  const r=this.rules;this.elapsed+=dt;this.hours+=dt*r.HOURS_PER_SECOND;
  this.score+=dt*this.humans.filter(c=>!c.dead).length;
  this.incomeT-=dt;if(this.incomeT<=0){this.incomeT+=r.INCOME_EVERY;this.money+=r.INCOME_AMT;this.fx('income',null,'+$'+r.INCOME_AMT,'#2e7d32');this.sfx('income');}
  this.updateZombie(dt);
  for(const c of this.chars){
   if(c.dead){if(c.ghostT>=0&&c.ghostT<4)c.ghostT+=dt;continue;}
   if(!c.isPet){c.ageT+=dt;if(c.ageT>=r.YEAR_EVERY){c.ageT-=r.YEAR_EVERY;c.age++;c.size=sizeForAge(c.age);if(c.age>r.MAX_AGE){this.peacefulDeath(c);continue;}if(c.age===r.MAX_AGE)this.log(`🎂 ${c.name} turned 100! What a life!`,'#7b1fa2');}}
   if(c.state==='doomed'||c.state==='going')continue;
   if(c.state==='tickle'){c.tickleT-=dt;if(c.tickleT<=0)c.state='wander';continue;}
   if(c.state==='happy'){c.happyT-=dt;if(c.happyT<=0){c.busy=null;if(c.wasWorking&&this.canWork(c)){if(!this.send(c,ZONES.desk,'resume')){c.wasWorking=false;c.state='wander';}}else{c.wasWorking=false;c.state='wander';}}continue;}
   if(c.state==='request'){c.reqT-=dt;if(c.reqT<=0)this.missRequest(c);continue;}
   if(c.state==='work'){
    c.workTimer+=dt;c.workSession+=dt;
    const prev=Math.floor(c.careerS/(r.YEAR_EVERY*r.WORK_RAISE_YEARS));c.careerS+=dt;const now=Math.floor(c.careerS/(r.YEAR_EVERY*r.WORK_RAISE_YEARS));
    if(now>prev){this.fx('cash',c,'🎉 RAISE! now $'+this.workPay(c),'#e0a800');this.sfx('cash');this.log(`🎉 ${c.name} got a $${r.RAISE_AMT} raise after ${now*r.WORK_RAISE_YEARS} years on the job! Now $${this.workPay(c)}/${r.WORK_PAY_EVERY}s`,'#e0a800');}
    if(c.workTimer>=r.WORK_PAY_EVERY){c.workTimer-=r.WORK_PAY_EVERY;const pay=this.workPay(c);this.money+=pay;this.earned+=pay;this.fx('cash',c,'💵 +$'+pay,'#1b5e20');this.sfx('cash');}
    if(c.workSession>=r.WORK_BREAK_AFTER){this.startRequest(c,BREAK_NEED);continue;}
    c.nextReq-=dt;if(c.nextReq<=0)this.startRequest(c);continue;
   }
   c.nextReq-=dt;if(c.nextReq<=0)this.startRequest(c);
  }
 }
 setPaused(p){if(!this.running)return;this.paused=p;}
 endGame(reason='lost'){
  this.running=false;this.paused=false;
  const humans=this.humans,pets=this.chars.filter(c=>c.isPet);
  this.result={reason,score:Math.floor(this.score),time:this.timeLabel(),served:this.served,earned:this.earned,money:this.money,alive:humans.filter(c=>!c.dead).length,family:humans.length,petsAlive:pets.filter(c=>!c.dead).length,pets:pets.length,oldest:Math.max(0,...humans.filter(c=>!c.dead).map(c=>c.age))};
  this.hooks.over?.(this.result);
 }
}
