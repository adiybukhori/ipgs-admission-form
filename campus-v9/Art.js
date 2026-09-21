export function round(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
export function text(c,t,x,y,size=18,color='#284b5a',align='center',font='sans-serif'){c.fillStyle=color;c.font=`${size}px ${font}`;c.textAlign=align;c.fillText(t,x,y);}
export function ellipse(c,x,y,w,h,fill){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,w/2,h/2,0,0,Math.PI*2);c.fill();}
function grad(c,y,h,a,b){let g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
let furnitureAtlas;
export function setFurnitureAtlas(image){furnitureAtlas=image;}
const crops={plant:[25,50,333,400],shelf:[462,30,268,423],sofa:[778,157,510,247],counter:[1320,70,440,370],table:[0,523,519,300],desk:[548,510,507,339],chair:[1124,505,269,333],lamp:[1505,466,158,374]};
export function prop(c,p,time=0){
 if(furnitureAtlas&&crops[p.type]){const [sx,sy,sw,sh]=crops[p.type];const w=p.type==='plant'?Math.max(88,p.w):p.type==='lamp'?59:p.w;const h=w*sh/sw;c.save();ellipse(c,p.x+4,p.y+3,w*.9,Math.min(30,w*.18),'#3b46362b');c.drawImage(furnitureAtlas,sx,sy,sw,sh,p.x-w/2,p.y-h,w,h);c.restore();return;}
let{x,y,w=100,h=70,type}=p;c.save();c.translate(x,y);c.globalAlpha=p.alpha??1;
 if(type==='plant'){
 ellipse(c,4,5,w*.9,24,'#28443124');round(c,-w*.3,-35,w*.6,39,7,grad(c,-35,40,'#fffef2','#b5b7a6'),'#a5aa97');round(c,-w*.34,-39,w*.68,10,4,'#e5e5d3');ellipse(c,0,-38,w*.56,10,'#5b6445');c.strokeStyle='#587744';c.lineWidth=3;
 for(let i=0;i<13;i++){let angle=i*2.39,dx=Math.cos(angle)*w*.33,dy=-54-(i%4)*16;c.beginPath();c.moveTo(0,-35);c.quadraticCurveTo(dx*.3,dy,dx,dy);c.stroke();c.save();c.translate(dx,dy);c.rotate(angle*.2+Math.sin(time*.6+i)*.025);ellipse(c,0,0,18+(i%3)*4,36,['#416c37','#6c9346','#87a557','#577f3e'][i%4]);c.strokeStyle='#a8bd76';c.lineWidth=1;c.beginPath();c.moveTo(0,-13);c.lineTo(0,13);c.stroke();c.restore();} }
 if(type==='desk'||type==='table'||type==='counter'){
 ellipse(c,6,8,w+14,30,'#38454422');round(c,-w/2+12,-12,12,30,3,'#745740');round(c,w/2-24,-12,12,30,3,'#745740');round(c,-w/2,-h*.56,w,h*.57,8,grad(c,-h*.56,h*.57,'#c49a68','#9c724e'),'#856848');round(c,-w/2-5,-h,w+10,h*.57,12,grad(c,-h,h*.57,'#f3d59a','#d0a96e'),'#b79462');c.strokeStyle='#ffe8b160';for(let i=0;i<5;i++){c.beginPath();c.moveTo(-w/2+8,-h+10+i*6);c.bezierCurveTo(-15,-h+15+i*6,30,-h+5+i*6,w/2-8,-h+10+i*6);c.stroke();}
 if(type==='counter'){round(c,-w*.38,-h*.4,w*.76,h*.32,3,'#f4e9cb');text(c,'IUC · IPGS',0,-h*.17,16,'#275474');}
 if(type==='desk'||type==='counter'){round(c,w*.2-10,-h+8,28,5,2,'#587279');round(c,w*.2,-h-17,4,27,1,'#4b6973');round(c,w*.2-25,-h-62,54,46,4,'#2b4655','#738d92');round(c,w*.2-21,-h-58,46,36,2,grad(c,-h-58,36,'#80c4ce','#2b6a8c'));round(c,w*.2-22,-h+19,50,14,3,'#e7e9dc','#a2afa7');for(let i=0;i<3;i++)round(c,-w*.3,-h+12-i*3,36,24,1,'#fffdf0','#d4c7a7');c.strokeStyle='#84a5ad';for(let i=0;i<3;i++){c.beginPath();c.moveTo(-w*.3+5,-h+12+i*5);c.lineTo(-w*.3+24,-h+12+i*5);c.stroke();}}
 }
 if(type==='sofa'||type==='chair'){
 let col=p.color||'#345b80';ellipse(c,4,10,w+8,26,'#28425625');round(c,-w/2+6,-5,8,22,2,'#735b3e');round(c,w/2-14,-5,8,22,2,'#735b3e');round(c,-w/2,-h,w,h,12,grad(c,-h,h,'#7396b0',col),'#30536b');round(c,-w/2+8,-h+9,w-16,h*.48,9,grad(c,-h,h,'#88aac2',col),'#658399');round(c,-w/2+8,-h*.44,w-16,h*.39,8,'#668ca9','#4a6e8d');if(w>90){for(let i=1;i<3;i++){c.strokeStyle='#365f7e';c.beginPath();c.moveTo(-w/2+i*w/3,-h+13);c.lineTo(-w/2+i*w/3,-9);c.stroke();}}round(c,-w/2-4,-h*.65,14,h*.64,6,col,'#557b96');round(c,w/2-10,-h*.65,14,h*.64,6,col,'#557b96');
 }
 if(type==='shelf'){
 round(c,-w/2+5,-h+7,w,h,3,'#796148');round(c,-w/2,-h,w,h,3,'#bd965f','#765c3b');for(let row=0;row<3;row++){round(c,-w/2+8,-h+8+row*h/3,w-16,h/3-12,1,'#786443');for(let i=0;i<Math.floor((w-20)/12);i++){let bh=20+(i*7+row*3)%18;round(c,-w/2+11+i*12,-h+(row+1)*h/3-bh-8,9,bh,1,['#397782','#d6bc75','#976158','#38608a','#efdeac'][((i+row)%5)]);c.fillStyle='#f2dfb5';c.fillRect(-w/2+13+i*12,-h+(row+1)*h/3-bh-2,5,2);}} }
 if(type==='lamp'){
 ellipse(c,2,3,30,12,'#9c927030');ellipse(c,0,0,24,8,'#9d844a');round(c,-3,-98,6,98,1,'#b09960');let g=c.createRadialGradient(0,-104,3,0,-104,85);g.addColorStop(0,'#ffe9a680');g.addColorStop(1,'#fff8cf00');c.fillStyle=g;c.fillRect(-85,-190,170,170);c.fillStyle='#fff1c1';c.beginPath();c.moveTo(-17,-131);c.lineTo(17,-131);c.lineTo(28,-95);c.lineTo(-28,-95);c.fill();c.strokeStyle='#d2b97c';c.stroke();ellipse(c,0,-96,54,10,'#efdca6'); }
 if(type==='screen'){
 round(c,-w/2+3,-h+4,w,h,5,'#a18c63');round(c,-w/2,-h,w,h,4,'#fff7dd','#baa478');round(c,-w/2+8,-h+8,w-16,h-16,2,p.color||'#24516d');text(c,p.title||'IUC · IPGS',0,-h*.58,Math.min(22,w/10),'#faf1cf');text(c,p.sub||'PEOPLE · PURPOSE · PROGRESS',0,-h*.31,Math.min(11,w/19),'#b9d6d8'); }
 if(type==='rug'){round(c,-w/2,-h,w,h,8,p.color||'#d6d1b7','#beb499');round(c,-w/2+10,-h+10,w-20,h-20,6,null,'#efe7c9');}
 if(type==='coffee'){prop(c,{type:'table',x:0,y:0,w:120,h:60});round(c,-27,-107,52,58,7,'#284453','#889995');round(c,-19,-99,36,17,3,'#adc5bc');round(c,-9,-77,18,17,3,'#f9efcf');text(c,'COFFEE',0,-53,9,'#ece3c1');}
 c.restore();}
export function drawActor(c,a,img,time){c.save();c.translate(a.x,a.y-(a.sitting?30:0));let selected=a.selected;ellipse(c,0,3,45,15,'#28465726');if(selected){c.strokeStyle='#d2a549';c.lineWidth=3;c.beginPath();c.ellipse(0,3,32,12,0,0,Math.PI*2);c.stroke();}
 const col=a.profile%4,row=Math.floor(a.profile/4)%2;const sw=img.width/4,sh=img.height/2;let bob=a.pose==='walking'?Math.sin(a.distance*.09)*2:Math.sin(time*1.2+a.profile)*.5;let width=78,height=112;
 // Separate upper/lower atlas regions so seated actors have compressed bent legs, not standing poses.
 if(a.sitting){c.drawImage(img,col*sw,row*sh,sw,sh*.76,-width/2,-height+22+bob,width,height*.76);c.drawImage(img,col*sw,row*sh+sh*.76,sw,sh*.24,-width/2,-5,width,height*.15);if(a.idleActivity==='phone'){round(c,12,-39,10,16,2,'#274458');round(c,13,-37,8,11,1,'#acd6da');}else{round(c,-18,-34,32,21,2,'#fff5df','#c4bca3');}}
 else{c.save();c.rotate(a.pose==='walking'?Math.sin(a.distance*.07)*.018:0);c.drawImage(img,col*sw,row*sh,sw,sh,-width/2,-height+bob,width,height);c.restore();}
 if(selected){round(c,-56,16,112,25,6,'#fffcf3ee','#cfbd8c');text(c,a.name,0,33,13,'#255064');}
 if(a.bubble&&time<a.bubbleUntil){c.font='14px sans-serif';const w=Math.min(330,c.measureText(a.bubble).width+26);round(c,-w/2,-151,w,30,9,'#fffff8f5','#d8ccb0');text(c,a.bubble,0,-131,14,'#27526a');}
 c.restore();}
