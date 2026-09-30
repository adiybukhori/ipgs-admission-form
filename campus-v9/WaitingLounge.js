export class WaitingLounge{
 constructor(seats){this.seats=seats.map((p,i)=>({...p,id:i,occupant:null}));}
 reserve(app){const old=this.seats.find(s=>s.occupant===app.id);if(old)return old;const seat=this.seats.find(s=>!s.occupant);if(seat)seat.occupant=app.id;return seat;}
 release(app){for(const s of this.seats)if(s.occupant===app.id)s.occupant=null;}
}
