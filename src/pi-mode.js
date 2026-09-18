// Keep the display running without setup clicks or score submissions.
export function createPiAutoplay({ready,running,start,resume,auto,retry}){
 let started=false,restartAt=null,lastRetry=0;
 return now=>{
  if(!ready()){if(now-lastRetry>30000){lastRetry=now;retry();}return;}
  if(!running()){
   if(!started){start();started=true;}
   else {restartAt??=now+10000;if(now<restartAt)return;start();restartAt=null;}
  }
  resume();auto();
 };
}
