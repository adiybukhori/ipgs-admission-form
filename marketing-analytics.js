(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MarketingAnalytics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const zone='Asia/Kuala_Lumpur';
  function localDate(iso){
    if(!iso)return '';
    const d=new Date(iso);
    return Number.isNaN(d.getTime())?'':new Date(d.getTime()+28800000).toISOString().slice(0,10);
  }
  function formatDate(iso,withTime=true){
    if(!iso||!localDate(iso))return 'Date unavailable';
    return new Intl.DateTimeFormat('en-MY',{timeZone:zone,day:'numeric',month:'short',year:'numeric',...(withTime?{hour:'numeric',minute:'2-digit',hour12:true}:{})}).format(new Date(iso));
  }
  function events(candidate){
    return Array.isArray(candidate.registrationEvents)?candidate.registrationEvents:(candidate.registeredAt?[{registeredAt:candidate.registeredAt,sourceTab:candidate.sourceTab}]:[]);
  }
  function matchingEvents(candidate,filter={}){
    return events(candidate).filter(e=>{
      const day=localDate(e.registeredAt);
      if(filter.source&&e.sourceTab!==filter.source)return false;
      return !((filter.from||filter.to)&&!day)&&(!filter.from||day>=filter.from)&&(!filter.to||day<=filter.to);
    });
  }
  function matches(candidate,f={}){
    const q=(f.search||'').trim().toLowerCase();
    if(q&&![candidate.name,candidate.ic,candidate.email].some(x=>String(x||'').toLowerCase().includes(q)))return false;
    if(f.programme&&candidate.programme!==f.programme)return false;
    if(f.intake&&candidate.intake!==f.intake)return false;
    if(f.acc==='matched'&&!candidate.accFound||f.acc==='missing'&&candidate.accFound)return false;
    if(f.activation==='active'&&!candidate.activated||f.activation==='pending'&&candidate.activated)return false;
    if(f.category==='review'&&!(candidate.activated&&candidate.snapshotCategory!=='Internal'))return false;
    if(f.category==='pending'&&candidate.activated)return false;
    if(f.category&&f.category!=='review'&&f.category!=='pending'&&candidate.snapshotCategory!==f.category)return false;
    if((f.from||f.to||f.source)&&!matchingEvents(candidate,f).length)return false;
    return true;
  }
  function latest(candidate,f={}){
    const selected=f.from||f.to||f.source?matchingEvents(candidate,f):events(candidate);
    return selected.map(e=>e.registeredAt||'').sort().reverse()[0]||(!f.from&&!f.to&&!f.source?candidate.registeredAt:'')||'';
  }
  function filterCandidates(data,f={}){
    return data.filter(c=>matches(c,f)).sort((a,b)=>{
      if(f.sort==='name')return a.name.localeCompare(b.name);
      const at=latest(a,f),bt=latest(b,f);
      if(!at&&bt)return 1;if(at&&!bt)return -1;
      return (f.sort==='oldest'?at.localeCompare(bt):bt.localeCompare(at))||a.name.localeCompare(b.name);
    });
  }
  function stats(candidates,f={}){
    return {unique:candidates.length,submissions:candidates.reduce((sum,c)=>sum+matchingEvents(c,f).length,0),
      applied:candidates.filter(c=>c.accFound).length,active:candidates.filter(c=>c.activated).length,
      awaitingAcc:candidates.filter(c=>!c.accFound).length,
      awaitingActivation:candidates.filter(c=>!c.activated).length,
      unknownDate:candidates.filter(c=>!localDate(c.registeredAt)).length};
  }
  function days(data,f={}){
    const result={};
    for(const c of data.filter(c=>matches(c,{...f,from:'',to:''}))){
      const unique=new Set();
      for(const e of matchingEvents(c,{source:f.source})){
        const day=localDate(e.registeredAt);if(!day)continue;
        if(!result[day])result[day]={date:day,unique:0,submissions:0,applied:0,active:0};
        result[day].submissions++;
        if(!unique.has(day)){result[day].unique++;if(c.accFound)result[day].applied++;if(c.activated)result[day].active++;unique.add(day);}
      }
    }
    return result;
  }
  function categoryLabel(value){return value==='Internal'?'IPGS Sales & Marketing':value==='OE'?'Olympia Education Holding':value==='DSS'?'Doctorate Supervisory Scheme':value==='Unassigned'||value===''?'Category unassigned':value==null?'Not active in Snapshot':value;}
  return {zone,localDate,formatDate,events,matchingEvents,latest,matches,filterCandidates,stats,days,categoryLabel};
});
