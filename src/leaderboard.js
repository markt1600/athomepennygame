// Global top ten through the Vercel function, with a per-device fallback.
const LB_API='/api/leaderboard';
export const LS_BOARD='athome_penny_board',LS_BEST='athome_penny_best',LS_NAME='athome_penny_name';
let online=null;   // null = unknown, true = Vercel API, false = localStorage
const local=()=>{try{return JSON.parse(localStorage.getItem(LS_BOARD)||'[]');}catch{return [];}};
export const isOnline=()=>online;
export async function fetchBoard(){
 try{const r=await fetch(LB_API,{cache:'no-store'});if(!r.ok)throw 0;online=true;return await r.json();}
 catch{online=false;return local();}
}
export async function submitScore(entry){
 if(online!==false){
  try{const r=await fetch(LB_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)});if(r.ok){online=true;return;}}catch{}
  online=false;
 }
 const b=local();b.push(entry);b.sort((a,c)=>c.score-a.score);
 try{localStorage.setItem(LS_BOARD,JSON.stringify(b.slice(0,10)));}catch{}
}
export function renderBoard(el,list,highlightName){
 const ol=el.querySelector('ol'),src=el.querySelector('.src');ol.replaceChildren();
 if(!list.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No scores yet — be the first! ⭐';ol.append(empty);}
 else{
  const medals=['🥇','🥈','🥉'];
  list.slice(0,10).forEach((e,i)=>{
   const li=document.createElement('li');if(highlightName&&e.name===highlightName&&e.justSaved)li.className='me';
   const rk=document.createElement('span');rk.className='rk';rk.textContent=medals[i]||(i+1);
   const nm=document.createElement('span');nm.className='nm';nm.textContent=`${e.name}${e.time?' · '+e.time:''}`;
   const sc=document.createElement('span');sc.className='sc';sc.textContent='⭐'+e.score;
   li.append(rk,nm,sc);ol.append(li);
  });
 }
 src.textContent=online?'🌐 global leaderboard':'💾 saved on this device (add Upstash Redis on Vercel for a global board)';
}
