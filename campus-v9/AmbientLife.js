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

export class AmbientLife{
  constructor(scene){
    this.scene=scene;
    this.enabled=true;
    this.autoFollow=false;
    this.chatIn=2.5;
    this.walkIn=5.5;
    this.focusUntil=0;
    this.autoFocusActor=null;
  }
  reset(){
    this.chatIn=2.5;this.walkIn=5.5;this.focusUntil=0;this.autoFocusActor=null;
    for(const a of [...this.scene.actors,...this.scene.staff]){
      if(a.bubbleKind==='ambient'){a.bubble='';a.bubbleUntil=0;}
      // Do not cancel paths here: live workflow movement takes priority.
      a.ambientHome=null;
    }
  }
  setEnabled(enabled,engine){
    this.enabled=Boolean(enabled);
    if(!this.enabled){
      for(const a of [...(engine?.apps||[]),...this.scene.staff]){
        if(a.bubbleKind==='ambient'){a.bubble='';a.bubbleUntil=0;}
      }
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
    // Camera follow is optional so a BOD presentation is not interrupted.
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
    this.chatIn-=dt;this.walkIn-=dt;
    if(this.chatIn<=0){this.chat(engine);this.chatIn=between(5.5,10);}
    if(this.walkIn<=0){this.wander(engine);this.walkIn=between(5,9);}
  }
  chat(engine){
    const now=this.scene.time;
    const people=[...(engine.apps||[]),...this.scene.staff];
    const active=people.filter(a=>a.bubble&&a.bubbleUntil>now).length;
    // No more than three simultaneous bubbles, including real workflow alerts.
    if(active>=3)return;
    const available=people.filter(a=>!a.path?.length&&(!a.bubble||a.bubbleUntil<=now));
    if(!available.length)return;
    const lead=choose(available);
    const room=roomFor(lead);
    if(!room)return;
    const nearby=available.filter(a=>a!==lead&&roomFor(a)===room&&Math.hypot(a.x-lead.x,a.y-lead.y)<185);
    lead.say(lead.isStaff?choose(STAFF_TALK):choose(TALK[room]||TALK.admission),now,'ambient');
    // Occasionally a nearby avatar replies, but every line stays fictional.
    if(nearby.length&&active<=1&&Math.random()<.65){
      const other=choose(nearby);
      other.say(choose(['Hai! 👋','Hello!','Nice!','Hehe 😄']),now,'ambient');
      other.direction=lead.x>other.x?1:-1;
      lead.direction=other.x>lead.x?1:-1;
    }
  }
  wander(engine){
    // Move at most two students a short, collision-safe distance INSIDE
    // their current office; never walk between offices without an ACC event.
    const apps=engine.apps||[];
    if(apps.filter(a=>a.ambientWalk).length>=2)return;
    const eligible=apps.filter(a=>!a.path?.length&&!a.sitting&&!a.ambientWalk&&a.station!=='orientation'&&BY_ID[a.station]);
    if(!eligible.length)return;
    for(let i=0;i<Math.min(5,eligible.length);i++){
      const a=choose(eligible),room=BY_ID[a.station];
      const home=a.ambientHome||(a.ambientHome={x:a.x,y:a.y});
      const raw={x:home.x+between(-54,54),y:home.y+between(-33,33)};
      if(raw.x<room.x+40||raw.x>room.x+room.w-40||raw.y<room.y+42||raw.y>room.y+room.h-42)continue;
      try{
        const target=this.scene.nav.point(this.scene.nav.nearest(raw));
        const route=this.scene.nav.path(a,target);
        if(!route.length||route.some(p=>p.x<room.x+20||p.x>room.x+room.w-20||p.y<room.y+20||p.y>room.y+room.h-20))continue;
        if(Math.hypot(target.x-a.x,target.y-a.y)>130)continue;
        a.ambientWalk=true;
        a.moveTo(target,this.scene.nav,()=>{
          a.ambientWalk=false;
          a.pose='idle';
        });
        return;
      }catch(_){/* An occupied route is simply skipped; no workflow change. */}
    }
  }
}
