import {BY_ID} from './config.js';
import {publicWaitingArea} from './CampusOccupancy.js';

// Decorative dialogue is illustrative; every moving person is an actual
// V2_APPLICATIONS student in overflow, never a fabricated NPC.
const TALK=['Hai! 👋','Jom lepak sini!','Dah lama tunggu?','Hai, apa khabar?','Hehe 😄','Jom duduk dulu.'];
const REPLIES=['Hai! 👋','Hehe 😄','Hello!','Jom!'];
const choose=arr=>arr[Math.floor(Math.random()*arr.length)];
const between=(min,max)=>min+Math.random()*(max-min);

export class AmbientLife{
  constructor(scene){
    this.scene=scene;this.enabled=true;this.autoFollow=false;
    this.chatIn=2;this.walkIn=.7;this.focusUntil=0;
    this.autoFocusActor=null;this.totalAmbientWalks=0;
  }
  reset(){
    this.chatIn=2;this.walkIn=.7;this.focusUntil=0;this.autoFocusActor=null;
    for(const a of this.scene.actors){
      if(a.bubbleKind==='ambient'){a.bubble='';a.bubbleUntil=0;}
      if(a.ambientWalk){a.path=[];a.onArrive=null;a.ambientWalk=false;a.pose='idle';}
      a.ambientSeatIndex=null;
    }
  }
  setEnabled(enabled,engine){
    this.enabled=Boolean(enabled);
    if(!this.enabled)for(const a of engine?.apps||[]){
      if(a.bubbleKind==='ambient'){a.bubble='';a.bubbleUntil=0;}
      if(a.ambientWalk){
        a.ambientWalk=false;a.path=[];a.onArrive=null;
        if(!a.sitting)a.pose='idle';
        a.ambientSeatIndex=null;
      }
    }
    if(this.enabled)this.walkIn=.2;
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
      this.autoFocusActor=moves[0].actor;this.focusUntil=this.scene.time+10;
      hud?.select(this.autoFocusActor);this.scene.focus(this.autoFocusActor);
    }
  }
  route(a,destination){
    try{
      const nav=this.scene.nav,target=nav.point(nav.nearest(destination));
      if(!publicWaitingArea(a)||!publicWaitingArea(target))return null;
      const route=nav.path(a,target);
      if(!route.length||route.some(p=>!publicWaitingArea(p)))return null;
      const length=route.reduce((sum,p,i)=>sum+Math.hypot(
        p.x-(i?route[i-1].x:a.x),p.y-(i?route[i-1].y:a.y)),0);
      if(length<60||length>1050)return null;
      return route;
    }catch(_){return null;}
  }
  availableSeats(a,engine){
    const taken=new Set((engine.apps||[])
      .filter(p=>p!==a&&p.overflow&&p.ambientSeatIndex!=null)
      .map(p=>p.ambientSeatIndex));
    return (this.scene.loungeSeats||[]).map((seat,index)=>({seat,index}))
      .filter(({seat,index})=>!taken.has(index)&&Math.abs(seat.x-a.x)<670);
  }
  beginTrip(a,engine){
    if(!engine?.live||!this.enabled||!a.overflow||a.ambientWalk
      ||a.sitting||a.workflowMove||a.path?.length||!publicWaitingArea(a))return false;
    const seats=this.availableSeats(a,engine)
      .map(s=>({...s,dist:Math.hypot(s.seat.x-a.x,s.seat.y-a.y)}))
      .sort((x,y)=>x.dist-y.dist)
      .slice(0,10).map(s=>({type:'seat',...s}));
    const walks=[];
    for(let n=0;n<14;n++)walks.push({type:'walk',seat:{
      x:Math.max(315,Math.min(3470,a.x+between(-340,340))),
      y:between(1010,1490)
    }});
    const plans=Math.random()<.8?[...seats,...walks]:[...walks,...seats];
    for(const plan of plans){
      const route=this.route(a,plan.seat);
      if(!route)continue;
      a.ambientWalk=true;a.ambientPhase='walking';a.pose='walking';
      a.path=route;a.distance=a.distance||0;
      if(plan.type==='seat')a.ambientSeatIndex=plan.index;
      a.onArrive=()=>{
        a.ambientWalk=false;
        if(!a.overflow||a.workflowMove){a.ambientSeatIndex=null;return;}
        if(plan.type==='seat'){
          a.ambientPhase='seated';a.sit(Math.random()<.4?'phone':'reading');
          a.ambientNextAt=this.scene.time+between(9,17);
        }else{
          a.ambientPhase='idle';a.pose='idle';
          a.ambientNextAt=this.scene.time+between(2,4);
        }
      };
      this.totalAmbientWalks++;
      return true;
    }
    return false;
  }
  wander(engine){
    if(!engine?.live||!this.enabled)return false;
    const real=engine.apps||[];
    if(real.filter(a=>a.overflow&&a.ambientWalk).length>=5)return false;
    const eligible=real.filter(a=>a.overflow&&!a.ambientWalk&&!a.sitting
      &&!a.workflowMove&&!a.path?.length&&(a.ambientNextAt||0)<=this.scene.time);
    while(eligible.length){
      const i=Math.floor(Math.random()*eligible.length),a=eligible.splice(i,1)[0];
      if(this.beginTrip(a,engine))return true;
      a.ambientNextAt=this.scene.time+between(2,4);
    }
    return false;
  }
  chat(engine){
    const now=this.scene.time,all=engine.apps||[];
    const active=all.filter(a=>a.bubble&&a.bubbleUntil>now).length
      +this.scene.staff.filter(a=>a.bubble&&a.bubbleUntil>now).length;
    if(active>=3)return;
    const available=all.filter(a=>a.overflow&&!a.path?.length
      &&(!a.bubble||a.bubbleUntil<=now)&&publicWaitingArea(a));
    if(!available.length)return;
    const lead=choose(available);
    const nearby=available.filter(a=>a!==lead
      &&Math.hypot(a.x-lead.x,a.y-lead.y)<190);
    lead.say(choose(TALK),now,'ambient');
    if(nearby.length&&active<=1&&Math.random()<.85){
      const other=choose(nearby);other.say(choose(REPLIES),now,'ambient');
      other.direction=lead.x>other.x?1:-1;lead.direction=other.x>lead.x?1:-1;
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
    if(!this.enabled||!engine.live)return;
    // Movement is advanced by the normal engine.apps frame update. Do not
    // update students a second time or alter any application stage/status.
    for(const a of engine.apps||[]){
      if(!a.overflow||a.workflowMove)continue;
      if(a.ambientPhase==='seated'&&this.scene.time>=a.ambientNextAt){
        a.sitting=false;a.pose='idle';a.ambientPhase='idle';
        a.ambientSeatIndex=null;a.ambientNextAt=this.scene.time+between(1,3);
      }
    }
    this.chatIn-=dt;this.walkIn-=dt;
    if(this.chatIn<=0){this.chat(engine);this.chatIn=between(5,9);}
    if(this.walkIn<=0){
      for(let i=0;i<3;i++)this.wander(engine);
      this.walkIn=between(1,2);
    }
  }
}
