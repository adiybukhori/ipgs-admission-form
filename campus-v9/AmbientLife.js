import {BY_ID, STATIONS} from './config.js';

// Living Campus is a read-only, illustrative layer. Only NPC visitors walk
// recreationally; actual students and office staff stay at their ACC locations.
const TALK={
  admission:['Hai! 👋','Selamat datang!','Morning!'],
  sac:['Hi, semua!','Good morning!','Jom duduk dulu.'],
  ia:['Hai!','All the best!','Hello there!'],
  prerequisite:['Hello!','Jom belajar!'],
  offer:['Hai! 👋','Selamat datang!'],
  orientation:['Welcome! 🎓','Nice to meet you!'],
  services:['Hello there!','Hi! 👋'],
  handover:['Have a nice day!','Hello!'],
  lounge:['Jom lepak sini! ☕','Hai, apa khabar?','Dah lama tunggu?','Jom borak!','Hehe 😄']
};
const choose=arr=>arr[Math.floor(Math.random()*arr.length)];
const between=(min,max)=>min+Math.random()*(max-min);
const roomFor=a=>a.isStaff?STATIONS.find(s=>a.x>s.x&&a.x<s.x+s.w&&a.y>s.y&&a.y<s.y+s.h)?.id:a.station;
const publicArea=p=>p.x>275&&p.x<3510&&p.y>970&&p.y<1455
  &&!STATIONS.some(s=>p.x>s.x&&p.x<s.x+s.w&&p.y>s.y&&p.y<s.y+s.h);

export class AmbientLife{
  constructor(scene){
    this.scene=scene;
    this.enabled=true;
    this.autoFollow=false;
    this.chatIn=2;
    this.walkIn=.5;
    this.focusUntil=0;
    this.autoFocusActor=null;
    this.totalAmbientWalks=0;
  }
  reset(){
    this.chatIn=2;this.walkIn=.5;this.focusUntil=0;this.autoFocusActor=null;
    // Guests are never in engine.apps or ACC. Do not reposition real students.
    for(const a of [...this.scene.actors,...this.scene.staff,...(this.scene.ambient||[])]){
      if(a.bubbleKind==='ambient'){a.bubble='';a.bubbleUntil=0;}
      if(a.ambientGuest&&a.ambientWalk){
        a.path=[];a.onArrive=null;a.ambientWalk=false;a.pose='idle';
        a.ambientPhase='idle';a.ambientSeatIndex=null;a.ambientNextAt=this.scene.time+.7;
      }
    }
  }
  setEnabled(enabled,engine){
    this.enabled=Boolean(enabled);
    if(!this.enabled){
      for(const a of [...(engine?.apps||[]),...this.scene.staff,...(this.scene.ambient||[])]){
        if(a.bubbleKind==='ambient'){a.bubble='';a.bubbleUntil=0;}
        if(a.ambientGuest&&a.ambientWalk){
          a.path=[];a.onArrive=null;a.ambientWalk=false;a.pose='idle';
          a.ambientPhase='idle';a.ambientSeatIndex=null;
        }
      }
    }else this.walkIn=.2;
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
      this.autoFocusActor=moves[0].actor;
      this.focusUntil=this.scene.time+10;
      hud?.select(this.autoFocusActor);
      this.scene.focus(this.autoFocusActor);
    }
  }
  // Walking routes must remain in the public lounge/corridor and use the
  // existing collision-aware pathfinder. No routes through office walls.
  route(a,destination){
    try{
      const nav=this.scene.nav,target=nav.point(nav.nearest(destination));
      if(!publicArea(a)||!publicArea(target))return null;
      const route=nav.path(a,target);
      if(!route.length||route.some(p=>!publicArea(p)))return null;
      const distance=route.reduce((d,p,i)=>d+Math.hypot(
        p.x-(i?route[i-1].x:a.x),p.y-(i?route[i-1].y:a.y)),0);
      if(distance<65||distance>1100)return null;
      return route;
    }catch(_){return null;}
  }
  // Optional public seating: a seat is reserved by only one guest at a time.
  availableSeats(a){
    const taken=new Set(this.scene.ambient.filter(g=>g!==a&&g.ambientSeatIndex!=null).map(g=>g.ambientSeatIndex));
    return (this.scene.loungeSeats||[]).map((seat,index)=>({seat,index}))
      .filter(({seat,index})=>!taken.has(index)&&Math.abs(seat.x-a.x)<610);
  }
  beginTrip(a){
    if(!a.ambientGuest||!this.enabled||a.ambientWalk||a.sitting||a.workflowMove)return false;
    if(!publicArea(a))return false;
    const seats=this.availableSeats(a);
    const ideas=[];
    if(seats.length){
      // Bias visitors towards chairs and sofas so we actually see them sit.
      const sorted=seats.map(({seat,index})=>({seat,index,d:Math.hypot(seat.x-a.x,seat.y-a.y)}))
        .sort((x,y)=>x.d-y.d);
      for(const option of sorted.slice(0,10))ideas.push({kind:'seat',...option});
    }
    for(let i=0;i<9;i++){
      ideas.push({kind:'roam',seat:{
        x:Math.min(3450,Math.max(330,a.x+between(-420,420))),
        y:between(1050,1415)
      }});
    }
    // Try a few seats before random corridor wandering.
    const candidates=Math.random()<.7?ideas:[...ideas.filter(i=>i.kind==='roam'),...ideas.filter(i=>i.kind==='seat')];
    for(const idea of candidates){
      const route=this.route(a,idea.seat);
      if(!route)continue;
      a.ambientWalk=true;a.ambientPhase='walking';a.sitting=false;a.pose='walking';
      a.path=route;a.distance=a.distance||0;
      if(idea.kind==='seat')a.ambientSeatIndex=idea.index;
      a.onArrive=()=>{
        a.ambientWalk=false;
        if(idea.kind==='seat'){
          a.ambientPhase='seated';
          a.sit(Math.random()<.4?'phone':'reading');
          a.ambientNextAt=this.scene.time+between(9,17);
        }else{
          a.ambientPhase='idle';a.pose='idle';
          a.ambientNextAt=this.scene.time+between(1.5,4);
        }
      };
      this.totalAmbientWalks++;
      return true;
    }
    return false;
  }
  // Ambient walkers are visitors outside offices, NEVER students/staff inside.
  wander(engine){
    if(!this.enabled)return false;
    const guests=this.scene.ambient||[];
    if(guests.filter(a=>a.ambientWalk).length>=5)return false;
    const eligible=guests.filter(a=>a.ambientGuest&&!a.ambientWalk&&!a.sitting
      &&!a.path?.length&&(a.ambientNextAt||0)<=this.scene.time);
    for(let tries=0;tries<eligible.length;tries++){
      const index=Math.floor(Math.random()*eligible.length),a=eligible.splice(index,1)[0];
      if(this.beginTrip(a))return true;
      a.ambientNextAt=this.scene.time+between(2,4);
    }
    return false;
  }
  chat(engine){
    const now=this.scene.time;
    const guests=this.scene.ambient||[];
    const people=[...(engine.apps||[]),...this.scene.staff,...guests];
    const active=people.filter(a=>a.bubble&&a.bubbleUntil>now).length;
    if(active>=3)return;
    const available=people.filter(a=>!a.path?.length&&(!a.bubble||a.bubbleUntil<=now));
    if(!available.length)return;
    const guestOptions=available.filter(a=>a.ambientGuest);
    const lead=guestOptions.length&&Math.random()<.85?choose(guestOptions):choose(available);
    const room=lead.ambientGuest?'lounge':roomFor(lead);
    if(!room)return;
    const nearby=available.filter(a=>a!==lead
      &&(a.ambientGuest?'lounge':roomFor(a))===room
      &&Math.hypot(a.x-lead.x,a.y-lead.y)<190);
    lead.say(choose(TALK[room]||TALK.lounge),now,'ambient');
    if(nearby.length&&active<=1&&Math.random()<.85){
      const other=choose(nearby);
      other.say(choose(['Hai! 👋','Hello!','Jom!','Hehe 😄']),now,'ambient');
      other.direction=lead.x>other.x?1:-1;
      lead.direction=other.x>lead.x?1:-1;
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
    for(const a of (this.scene.ambient||[])){
      if(!a.ambientGuest)continue;
      a.update(dt*.78);
      if(a.ambientPhase==='seated'&&this.scene.time>=a.ambientNextAt){
        a.sitting=false;a.pose='idle';a.ambientPhase='idle';
        a.ambientSeatIndex=null;a.ambientNextAt=this.scene.time+between(.8,2.3);
      }
    }
    this.chatIn-=dt;this.walkIn-=dt;
    if(this.chatIn<=0){this.chat(engine);this.chatIn=between(5,8.5);}
    if(this.walkIn<=0){
      for(let i=0;i<3;i++)this.wander(engine);
      this.walkIn=between(1,2);
    }
  }
}
