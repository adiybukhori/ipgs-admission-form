import {BY_ID, STATIONS} from './config.js';

// Presentation-only animation. Nothing here writes to ACC, updates a workflow
// status, or initiates a real admission action. Bubble phrases are fictional.
const TALK={
  admission:['Hai! 👋','Selamat datang!','Morning!','Jom tunggu sini.'],
  sac:['Hi, semua!','Good morning!','Jom duduk dulu.','Hello! 👋'],
  ia:['Hai!','All the best!','Hello there!'],
  prerequisite:['Hello!','Jom belajar!','Semangat!'],
  offer:['Hai! 👋','Selamat datang!','Good day!'],
  orientation:['Welcome! 🎓','Hai semua!','Nice to meet you!'],
  services:['Hello there!','Hi! 👋','Good morning!'],
  handover:['Hello!','Have a nice day!','Hi there!']
};
const STAFF_TALK=['Morning! ☕','Hai! 👋','Welcome!','Hello there!','Good day!'];
const choose=arr=>arr[Math.floor(Math.random()*arr.length)];
const between=(min,max)=>min+Math.random()*(max-min);
const roomFor=a=>a.isStaff?STATIONS.find(s=>a.x>s.x&&a.x<s.x+s.w&&a.y>s.y&&a.y<s.y+s.h)?.id:a.station;

// Choose a visible route entirely inside the current office's walkable tiles.
// The previous random +/-54px choice usually snapped to the same navigation
// tile, was invisible when zoomed out, or crossed furniture / exterior corridors.
function officeWalk(a,room,nav){
  if(!room||!nav?.blocked||!nav?.cols||!nav?.rows||!nav?.cell)return null;
  const inRoom=p=>p.x>room.x+32&&p.x<room.x+room.w-32&&p.y>room.y+38&&p.y<room.y+room.h-32;
  let start;
  try{start=nav.nearest(a);}catch(_){return null;}
  if(!inRoom(nav.point(start)))return null;
  const cols=nav.cols, total=nav.blocked.length, parent=new Int32Array(total).fill(-1);
  const queue=[start],candidates=[],fallback=[];
  parent[start]=start;
  let head=0;
  while(head<queue.length&&head<1150){
    const i=queue[head++],p=nav.point(i);
    const distance=Math.hypot(p.x-a.x,p.y-a.y);
    if(distance>=105&&distance<=215)candidates.push(i);
    else if(distance>=60&&distance<105)fallback.push(i);
    const col=i%cols;
    const neighbours=[col>0?i-1:-1,col<cols-1?i+1:-1,i-cols,i+cols];
    for(const n of neighbours){
      if(n<0||n>=total||parent[n]!==-1||nav.blocked[n])continue;
      if(!inRoom(nav.point(n)))continue;
      parent[n]=i;queue.push(n);
    }
  }
  // Try multiple reachable targets. Do not navigate through walls or furniture.
  for(const pool of [candidates,fallback]){
    if(!pool.length)continue;
    const attempts=Math.min(pool.length,14);
    for(let i=0;i<attempts;i++){
      const target=pool[Math.floor(Math.random()*pool.length)];
      const reversed=[];
      for(let pos=target;pos!==start;pos=parent[pos]){
        if(pos<0||reversed.length>90)break;
        reversed.push(nav.point(pos));
      }
      if(!reversed.length||reversed.length>90)continue;
      const route=reversed.reverse();
      const totalDistance=route.reduce((acc,p,j)=>acc+Math.hypot(p.x-(j?route[j-1].x:a.x),p.y-(j?route[j-1].y:a.y)),0);
      if(totalDistance>370||totalDistance<60)continue;
      // Keep the grid's guaranteed collision-safe route, but remove intermediate
      // points along straight sections to make walking smooth.
      const smooth=[];
      for(let j=0;j<route.length;j++){
        const p=route[j],before=route[j-1],after=route[j+1];
        if(!before||!after||Math.sign(p.x-before.x)!==Math.sign(after.x-p.x)||Math.sign(p.y-before.y)!==Math.sign(after.y-p.y)||j===route.length-1)
          smooth.push(p);
      }
      return smooth;
    }
  }
  return null;
}

export class AmbientLife{
  constructor(scene){
    this.scene=scene;
    this.enabled=true;
    this.autoFollow=false;
    this.chatIn=2;
    this.walkIn=.7;
    this.staffWalkIn=2.2;
    this.focusUntil=0;
    this.autoFocusActor=null;
    this.totalAmbientWalks=0;
  }
  reset(){
    this.chatIn=2;this.walkIn=.7;this.staffWalkIn=2.2;
    this.focusUntil=0;this.autoFocusActor=null;
    for(const a of [...this.scene.actors,...this.scene.staff]){
      if(a.bubbleKind==='ambient'){a.bubble='';a.bubbleUntil=0;}
      a.ambientWalk=false;
    }
  }
  setEnabled(enabled,engine){
    this.enabled=Boolean(enabled);
    if(!this.enabled){
      for(const a of [...(engine?.apps||[]),...this.scene.staff]){
        if(a.bubbleKind==='ambient'){a.bubble='';a.bubbleUntil=0;}
        if(a.ambientWalk){a.ambientWalk=false;a.path=[];a.onArrive=null;a.pose='idle';}
      }
    }else{
      this.walkIn=.2;this.staffWalkIn=.6;
    }
  }
  setAutoFollow(enabled){
    this.autoFollow=Boolean(enabled);
    if(!this.autoFollow){this.focusUntil=0;this.autoFocusActor=null;}
  }
  onMovements(moves,engine,hud){
    if(!moves?.length)return;
    for(const m of moves){
      const a=m.actor;
      if(a.bubble&&this.scene.time<a.bubbleUntil&&a.bubbleKind==='workflow')continue;
      a.say('→ '+(BY_ID[m.to]?.label||m.to),this.scene.time,'workflow');
    }
    if(this.autoFollow){
      const m=moves[0];
      this.autoFocusActor=m.actor;
      this.focusUntil=this.scene.time+10;
      hud?.select(m.actor);
      this.scene.focus(m.actor);
    }
  }
  update(dt,engine){
    if(!engine||engine.paused||dt<=0)return;
    if(this.focusUntil){
      if(!this.scene.follow){this.focusUntil=0;this.autoFocusActor=null;}
      else if(this.scene.time>=this.focusUntil&&!this.autoFocusActor?.path?.length){
        this.focusUntil=0;this.autoFocusActor=null;this.scene.fullMap();
      }
    }
    if(!this.enabled)return;
    this.chatIn-=dt;this.walkIn-=dt;this.staffWalkIn-=dt;
    if(this.chatIn<=0){this.chat(engine);this.chatIn=between(5.5,10);}
    if(this.walkIn<=0){
      // Multiple distinct walking avatars at any one time, noticeable on the
      // full campus view. This is NOT movement to a new workflow stage.
      for(let i=0;i<3;i++)this.wander(engine);
      this.walkIn=between(1.5,2.3);
    }
    if(this.staffWalkIn<=0){
      this.wander(engine,true);
      this.staffWalkIn=between(3.2,4.6);
    }
  }
  chat(engine){
    const now=this.scene.time;
    const people=[...(engine.apps||[]),...this.scene.staff];
    const active=people.filter(a=>a.bubble&&a.bubbleUntil>now).length;
    if(active>=3)return;
    const available=people.filter(a=>!a.path?.length&&(!a.bubble||a.bubbleUntil<=now));
    if(!available.length)return;
    const lead=choose(available);
    const room=roomFor(lead);
    if(!room)return;
    const nearby=available.filter(a=>a!==lead&&roomFor(a)===room&&Math.hypot(a.x-lead.x,a.y-lead.y)<185);
    lead.say(lead.isStaff?choose(STAFF_TALK):choose(TALK[room]||TALK.admission),now,'ambient');
    if(nearby.length&&active<=1&&Math.random()<.65){
      const other=choose(nearby);
      other.say(choose(['Hai! 👋','Hello!','Nice!','Hehe 😄']),now,'ambient');
      other.direction=lead.x>other.x?1:-1;
      lead.direction=other.x>lead.x?1:-1;
    }
  }
  wander(engine,staff=false){
    if(!engine?.live||!this.enabled)return false;
    const actors=staff?this.scene.staff:(engine.apps||[]);
    const maxActive=staff?2:8;
    if(actors.filter(a=>a.ambientWalk).length>=maxActive)return false;
    const busyRooms=new Map();
    for(const a of [...engine.apps,...this.scene.staff])if(a.ambientWalk){
      const office=roomFor(a);busyRooms.set(office,(busyRooms.get(office)||0)+1);
    }
    const eligible=actors.filter(a=>{
      const office=roomFor(a);
      return office&&office!=='orientation'&&BY_ID[office]&&!a.sitting&&!a.path?.length&&!a.ambientWalk&&!a.workflowMove&&(busyRooms.get(office)||0)<(staff?3:4);
    });
    // Try multiple candidates because furniture obstructs some workstations.
    while(eligible.length){
      const index=Math.floor(Math.random()*eligible.length),a=eligible.splice(index,1)[0];
      const room=BY_ID[roomFor(a)],route=officeWalk(a,room,this.scene.nav);
      if(!route)continue;
      // Keep the authoritative station and workflow status absolutely unchanged.
      const station=a.station,status=a.status;
      a.ambientWalk=true;a.sitting=false;a.pose='walking';
      a.path=route;a.distance=a.distance||0;a.onArrive=()=>{
        a.ambientWalk=false;a.pose='idle';a.lastAmbientWalk=this.scene.time;
      };
      a.ambientWalkStarted=this.scene.time;
      this.totalAmbientWalks++;
      if(a.station!==station||a.status!==status)throw Error('Ambient animation must not alter admission state');
      return true;
    }
    return false;
  }
}
