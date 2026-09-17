import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,RULES} from '../src/game.js';
import {ZONES,NEEDS,BREAK_NEED} from '../src/zones.js';

// A deterministic random and a recording agent layer that "teleports" travel.
function harness({random,goResult=true}={}){
 let seed=42;const rng=random||(()=>{seed=(seed*16807)%2147483647;return seed/2147483647;});
 const events={logs:[],fx:[],sfx:[],go:[],stops:[],deaths:[],over:null,zombie:[]};
 const game=new Game({random:rng,hooks:{
  log:(m,c)=>events.logs.push(m),fx:(t,c,text)=>events.fx.push([t,c?.name,text]),sfx:n=>events.sfx.push(n),
  go:(c,zone,purpose)=>{events.go.push([c.name,zone.id,purpose]);return goResult;},
  stop:c=>events.stops.push(c.name),died:c=>events.deaths.push(c.name),over:r=>{events.over=r;},zombie:(k,z)=>events.zombie.push(k),
  place:c=>{c.x=1;c.z=1;},
 }});
 return {game,events};
}
const run=(game,seconds,step=.1)=>{for(let t=0;t<seconds;t+=step)game.update(Math.min(step,seconds-t));};

test('a new game seats the requested family and pets with PennyGame starting money',()=>{
 const {game}=harness();game.start({familySize:5,petCount:2});
 assert.equal(game.chars.length,7);assert.equal(game.money,RULES.START_MONEY);
 assert.deepEqual(game.chars.slice(0,5).map(c=>c.name),['Penny','Max','Lily','Sam','Rosie']);
 assert.equal(game.chars[2].age,0,'the first kid is a newborn');
 assert.deepEqual(game.chars.slice(5).map(c=>c.name),['Leo','Cyrus']);
 assert.ok(game.chars.every(c=>c.state==='wander'&&!c.dead));
 assert.ok(game.chars.every(c=>c.x===1&&c.z===1),'the agent layer placed everyone');
});

test('needs cost money, are served on arrival and heal, and prices rise every minute with a cap',()=>{
 const {game,events}=harness();game.start({familySize:3,petCount:1});
 const penny=game.chars[0];penny.health=50;
 game.startRequest(penny,NEEDS[0]);
 assert.equal(penny.state,'request');assert.equal(game.needCost(penny),5);
 const actions=game.actionsFor(penny);assert.ok(actions.some(a=>a.id==='serve'&&!a.disabled));
 assert.ok(game.act(penny,'serve').ok);
 assert.equal(penny.state,'going');assert.equal(game.money,95);assert.deepEqual(events.go.at(-1),['Penny','table','need']);
 run(game,100);assert.equal(penny.state,'going','timers pause while walking');
 game.arrived(penny);
 assert.equal(penny.state,'happy');assert.equal(penny.health,60);assert.equal(game.served,1);
 run(game,2);assert.equal(penny.state,'happy','a meal at the table takes a while');
 run(game,ZONES.table.stay);assert.equal(penny.state,'wander');
 game.elapsed=7*60;assert.equal(game.needCost(penny),10,'capped at $10');
 const pet=game.chars[3];assert.equal(game.needCost(pet),8);
 game.elapsed=90;assert.equal(game.needCost(pet),2);
});

test('you cannot send someone you cannot afford, and failed trips refund the fee',()=>{
 const {game,events}=harness();game.start({familySize:3,petCount:0});
 const max=game.chars[1];game.money=3;game.startRequest(max,NEEDS[2]);
 const serve=game.actionsFor(max).find(a=>a.id==='serve');assert.ok(serve.disabled);
 const result=game.act(max,'serve');assert.equal(result.ok,false);assert.match(result.message,/Not enough money/);
 assert.equal(max.state,'request');assert.ok(events.sfx.includes('broke'));
 game.money=20;assert.ok(game.act(max,'serve').ok);assert.equal(game.money,15);
 game.travelFailed(max);assert.equal(max.state,'request');assert.equal(game.money,20);
});

test('two missed needs kill a family member and losing everyone ends the game',()=>{
 const {game,events}=harness();game.start({familySize:3,petCount:0});
 const [penny,max,lily]=game.chars;
 for(const c of [max,lily]){c.dead=true;c.state='dead';}
 game.startRequest(penny,NEEDS[1]);run(game,RULES.REQUEST_TIME+.2);
 assert.equal(penny.misses,1);assert.equal(penny.health,50);assert.equal(penny.state,'wander');
 game.startRequest(penny,NEEDS[3]);run(game,RULES.REQUEST_TIME+.2);
 assert.ok(penny.dead);assert.equal(penny.deathType,'skeleton');assert.deepEqual(events.deaths,['Penny']);
 assert.ok(events.over);assert.equal(game.running,false);assert.equal(events.over.time,'1:30');
});

test('income arrives every thirty seconds and score counts living humans per second',()=>{
 const {game}=harness();game.start({familySize:4,petCount:1});
 for(const c of game.chars)c.nextReq=1e9;
 run(game,31);
 assert.equal(game.money,105);assert.ok(Math.abs(game.score-124)<1.5,`score ${game.score}`);
 assert.ok(game.hours>7.25+30/30&&game.hours<7.25+32/30,'the day advances');
});

test('working pays at the desk, halves need costs, earns raises and demands a break after a minute',()=>{
 const {game,events}=harness();game.start({familySize:3,petCount:0});
 const max=game.chars[1],lily=game.chars[2];lily.age=5;
 assert.ok(game.actionsFor(lily).find(a=>a.id==='work').disabled,'kids cannot work');
 assert.ok(game.act(max,'work').ok);assert.deepEqual(events.go.at(-1),['Max','desk','work']);
 game.arrived(max);assert.equal(max.state,'work');max.nextReq=1e9;
 run(game,10.05);assert.equal(game.money,105);assert.equal(game.earned,5);
 max.careerS=RULES.YEAR_EVERY*RULES.WORK_RAISE_YEARS-.05;run(game,.2);assert.equal(game.workPay(max),6);
 game.startRequest(max,NEEDS[0]);assert.ok(max.wasWorking);assert.equal(game.needCost(max),2.5);
 game.act(max,'serve');game.arrived(max);assert.equal(max.state,'happy');
 run(game,ZONES.table.stay+.1);assert.equal(max.state,'going');assert.deepEqual(events.go.at(-1),['Max','desk','resume']);
 const sessionBefore=max.workSession;game.arrived(max);assert.equal(max.state,'work');assert.equal(max.workSession,sessionBefore,'the shift clock continues after a snack');
 max.workSession=RULES.WORK_BREAK_AFTER-.05;run(game,.2);
 assert.equal(max.state,'request');assert.equal(max.need.id,'break');
 const serve=game.actionsFor(max).find(a=>a.id==='serve');assert.equal(serve.detail,'free');
 const before=game.money;game.act(max,'serve');assert.equal(game.money,before);assert.deepEqual(events.go.at(-1),['Max','sofa','break']);
 game.arrived(max);run(game,ZONES.sofa.stay+.1);assert.equal(max.state,'wander');assert.equal(max.wasWorking,false);
});

test('everyone ages a year every ten seconds, grows, and passes peacefully at 100',()=>{
 const {game,events}=harness();game.start({familySize:3,petCount:1});
 const lily=game.chars[2],pet=game.chars[3];
 for(const c of game.chars)c.nextReq=1e9;
 run(game,10.1);assert.equal(lily.age,1);assert.ok(lily.size>.55);assert.equal(pet.age,0,'pets stay forever young');
 const penny=game.chars[0];penny.age=100;penny.ageT=RULES.YEAR_EVERY-.05;run(game,.2);
 assert.ok(penny.dead);assert.equal(penny.deathType,'sleep');assert.ok(events.logs.some(l=>l.includes('peacefully')));
});

test('a zombie picks its own victim after ten seconds, eats them and leaves',()=>{
 const {game,events}=harness();game.start({familySize:3,petCount:0});
 for(const c of game.chars)c.nextReq=1e9;
 assert.ok(game.spawnZombie());assert.equal(events.zombie.at(-1),'enter');
 assert.equal(game.spawnZombie(),false,'only one at a time');
 game.zombieArrived();assert.equal(game.zombie.phase,'choosing');
 assert.ok(game.actionsFor(game.chars[0]).some(a=>a.id==='sacrifice'));
 run(game,RULES.ZOMBIE_CHOICE_TIME+.2);
 assert.equal(game.zombie.phase,'walking');const victim=game.zombie.victim;assert.equal(victim.state,'doomed');
 assert.deepEqual(game.actionsFor(victim),[],'a doomed family member cannot be commanded');
 game.zombieReached();assert.equal(game.zombie.phase,'eating');
 run(game,RULES.ZOMBIE_EAT_TIME+.2);
 assert.ok(victim.dead);assert.equal(victim.deathType,'eaten');assert.equal(game.zombie.phase,'leaving');
 game.zombieLeft();assert.equal(game.zombie,null);
});

test('offering someone to the zombie refunds any fee they had paid and freezes them',()=>{
 const {game}=harness();game.start({familySize:3,petCount:0});
 const penny=game.chars[0];game.startRequest(penny,NEEDS[0]);game.act(penny,'serve');assert.equal(game.money,95);
 game.spawnZombie();game.zombieArrived();
 assert.ok(game.act(penny,'sacrifice').ok);
 assert.equal(penny.state,'doomed');assert.equal(game.money,100);assert.equal(game.zombie.victim,penny);
});

test('tickling is free fun for anyone without a need, including pets',()=>{
 const {game,events}=harness();game.start({familySize:3,petCount:3});
 const pebble=game.chars.find(c=>c.name==='Pebble');
 assert.ok(game.act(pebble,'tickle').ok);assert.equal(pebble.state,'tickle');
 run(game,RULES.TICKLE_TIME+.1);assert.equal(pebble.state,'wander');
 assert.ok(events.fx.some(([t,name])=>t==='float'&&name==='Pebble'));
 assert.equal(game.actionsFor(pebble).some(a=>a.id==='work'),false,'no jobs for pets');
});

test('kids sleep in the second bedroom and adults in the main bedroom',()=>{
 const {game,events}=harness();game.start({familySize:4,petCount:0});
 const penny=game.chars[0],sam=game.chars[3];sam.age=6;
 game.startRequest(penny,NEEDS[3]);game.act(penny,'serve');assert.deepEqual(events.go.at(-1),['Penny','bed','need']);
 game.startRequest(sam,NEEDS[3]);game.act(sam,'serve');assert.deepEqual(events.go.at(-1),['Sam','kidbed','need']);
 assert.equal(ZONES.kidbed.room,'guest');
 assert.equal(BREAK_NEED.zone,'sofa');
});
