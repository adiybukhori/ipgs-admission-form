import {BY_ID,STATIONS} from './config.js';

// These are DISPLAY capacities, not official admissions/SAC capacity limits.
// Applicants keep their actual ACC workflow stage even when physically waiting
// outside because the room cannot show any more avatars without crowding.
export const OFFICE_DISPLAY_CAPACITY={
  admission:10,document:8,screening:8,sac:12,ia:10,
  prerequisite:10,offer:12,orientation:30,services:16,handover:10
};
export const publicWaitingArea=p=>Boolean(p)
  &&p.x>=295&&p.x<=3485&&p.y>=970&&p.y<=1515
  &&!STATIONS.some(s=>p.x>s.x&&p.x<s.x+s.w&&p.y>s.y&&p.y<s.y+s.h);

export class CampusOccupancy{
  constructor(scene){this.scene=scene;this.spots=this.createWaitingSpots();}
  createWaitingSpots(){
    const nav=this.scene.nav,spots=[],used=new Set();
    // Use actual, free navigation cells; no chairs/desks, plants or walls.
    for(let y=997;y<=1506;y+=55)for(let x=328;x<=3450;x+=56){
      const p=nav.point(nav.index({x,y})),index=nav.index(p);
      if(used.has(index)||nav.blocked[index]||!publicWaitingArea(p))continue;
      used.add(index);spots.push(p);
    }
    return spots;
  }
  assign(records){
    const assigned=new Map(),groups=new Map(),used=new Set();
    for(const row of records){
      if(!groups.has(row.station))groups.set(row.station,[]);
      groups.get(row.station).push(row);
    }
    // Deterministic sorting means refresh does not reshuffle old students
    // if the ACC API changes its row order.
    for(const [station,group] of groups){
      const s=BY_ID[station]||BY_ID.admission;
      group.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
      const limit=OFFICE_DISPLAY_CAPACITY[station]||8;
      for(let i=0;i<group.length;i++){
        const row=group[i];
        if(i<limit){
          assigned.set(row.id,{overflow:false,slot:i,station});
          continue;
        }
        // Students spill into the adjacent *public* waiting lounge, not
        // another office. All overflow remain real ACC applicants.
        const point=this.spots
          .filter(p=>!used.has(this.scene.nav.index(p)))
          .sort((a,b)=>{
            const score=p=>Math.abs(p.x-s.door.x)
              +Math.abs(p.y-(s.y<1000?1090:1410))*.7;
            return score(a)-score(b);
          })[0];
        if(!point)throw Error('Public waiting area cannot fit all live applicants safely');
        used.add(this.scene.nav.index(point));
        assigned.set(row.id,{overflow:true,slot:i-limit,station,point});
      }
    }
    return assigned;
  }
}
