export class ApplicantActor{
 constructor(record,x,y,profile=0){Object.assign(this,record);this.x=x;this.y=y;this.profile=profile;this.path=[];this.pose='idle';this.radius=17;this.bubble='';this.bubbleUntil=0;this.selected=false;this.station=record.station||'admission';this.direction=1;this.distance=0;this.onArrive=null;this.status=record.status||'WAITING_NEW_APPLICATION';}
 moveTo(target,nav,onArrive){this.path=nav.path(this,target);this.pose='walking';this.onArrive=onArrive;this.sitting=false;this.moveError=null;}
 say(text,now){this.bubble=text;this.bubbleUntil=now+4.5;}
 update(dt){if(!this.path.length)return;let allowance=95*dt;while(allowance>0&&this.path.length){let p=this.path[0],dx=p.x-this.x,dy=p.y-this.y,d=Math.hypot(dx,dy);if(dx)this.direction=dx<0?-1:1;let step=Math.min(d,allowance);if(d){this.x+=dx/d*step;this.y+=dy/d*step;this.distance+=step;}allowance-=step;if(d<=step+.001)this.path.shift();}if(!this.path.length){this.pose='arriving';const cb=this.onArrive;this.onArrive=null;cb?.();if(this.pose==='arriving')this.pose='idle';}}
 sit(activity='reading'){this.pose='sitting';this.sitting=true;this.idleActivity=activity;}
}
export class StaffActor extends ApplicantActor{constructor(id,x,y,profile){super({id,name:id,status:'WORKING'},x,y,profile);this.isStaff=true;this.home={x,y};}}
