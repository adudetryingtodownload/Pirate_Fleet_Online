const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const vm=require('vm');
const PORT=process.env.PORT||3000,PUB=path.join(__dirname,'public');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
const srv=http.createServer((q,r)=>{
 if(q.url=='/healthz'){r.end('ok');return}
 let u=decodeURIComponent(q.url.split('?')[0]);if(u=='/')u='/index.html';
 const f=path.normalize(path.join(PUB,u));
 if(!f.startsWith(PUB)){r.writeHead(403);r.end();return}
 fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end('Not found');return}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(d)})});
const wss=new WebSocketServer({server:srv,maxPayload:4096}),rooms=new Map();let nid=1;
const mkCode=()=>{let c;do{c=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random()*24|0]).join('')}while(rooms.has(c));return c};
const clean=(s,n)=>String(s||'').replace(/[<>]/g,'').trim().slice(0,n);
const cf=c=>{const o={};for(const k of['ai','diff','type','laps','lives','mins','goal'])if(Number.isFinite(+(c&&c[k])))o[k]=+c[k];return o};
const send=(ws,o)=>{if(ws.readyState==1)ws.send(JSON.stringify(o))};
const snap=(rm,p)=>({t:'room',code:rm.code,you:p.id,tok:p.tok,host:rm.host,cfg:rm.cfg,players:rm.ps.map(x=>({id:x.id,name:x.name}))});
const push=rm=>rm.ps.forEach(p=>send(p.ws,snap(rm,p)));
const bc=(rm,o)=>rm.ps.forEach(p=>send(p.ws,o));
function leave(p){const rm=p.room;if(!rm)return;p.room=null;rm.ps=rm.ps.filter(x=>x!==p);if(rm.game&&p.si!=null){rm.game.ctx.AIOF(p.si);rm.dc[p.tok]={si:p.si,name:p.name}}
 if(!rm.ps.length){if(rm.game)clearInterval(rm.game.timer);rooms.delete(rm.code);return}
 if(rm.host==p.id)rm.host=rm.ps[0].id;
 bc(rm,{t:'sys',text:p.name+' left the room'});push(rm)}
const SIM=fs.readFileSync(path.join(__dirname,'sim.js'),'utf8');
const stub=()=>new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>0:k==='length'?0:stub(),apply:()=>stub(),set:()=>true,construct:()=>stub()});
const CN=['Blue','Red','Green','Gold','Violet','Orange','Teal','Pink'],KEYS=['C','L','R','B','N','O','M','X',' ','TAB'];
function startGame(rm){
 const hum=rm.ps.length,ai=Math.max(hum<2?1:0,Math.min(rm.cfg.ai==null?3:rm.cfg.ai,8-hum)),ns=hum+ai,
  names=[...rm.ps.map(p=>p.name),...Array.from({length:ai},(_,i)=>'AI '+CN[hum+i])];
 const ctx=vm.createContext({document:{getElementById:stub,createElement:stub},innerWidth:1280,innerHeight:720,location:{search:'',protocol:'http:',host:'x',origin:'x'},requestAnimationFrame(){},Path2D:function(){},URLSearchParams,WebSocket:function(){}});
 vm.runInContext(SIM,ctx);
 vm.runInContext('Object.assign(cfg,'+JSON.stringify(rm.cfg)+');HUM='+hum+';NS='+ns+';NM='+JSON.stringify(names)+';start();started=true',ctx);
 rm.ps.forEach((p,i)=>{p.si=i;send(p.ws,{t:'start',me:i,hum,ns,cfg:rm.cfg,names})});
 let n=0;const g=rm.game={ctx};
 let nx=Date.now();rm.dc={};
 const tick=()=>{try{ctx.update(.05);n++;bc(rm,{t:'snap',n,d:ctx.SNAP()});
  for(const[i,t] of ctx.OUTQ.splice(0)){if(i<0)bc(rm,{t:'note',text:t});else{const q=rm.ps.find(x=>x.si===i);if(q)send(q.ws,{t:'note',text:t})}}
  if(vm.runInContext('over',ctx)){rm.game=null;rm.dc={};rm.ps.forEach(p=>p.si=null);return}
  nx+=50;if(Date.now()-nx>500)nx=Date.now();g.timer=setTimeout(tick,Math.max(0,nx-Date.now()))}
  catch(e){console.error(e);rm.game=null;bc(rm,{t:'sys',text:'Game crashed on the server'})}};
 g.timer=setTimeout(tick,50);g.info={hum,ns,cfg:rm.cfg,names}}
wss.on('connection',ws=>{
 const p={id:nid++,name:'Captain',ws,room:null,last:0,tok:Math.random().toString(36).slice(2)+Date.now().toString(36)};ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
  if(m.t=='rejoin'&&!p.room){const rm=rooms.get(clean(m.code,4).toUpperCase()),d=rm&&rm.game&&rm.dc[m.tok];
   if(!d)return send(ws,{t:'err',msg:'Cannot rejoin that game'});
   delete rm.dc[m.tok];p.tok=m.tok;p.name=d.name;p.si=d.si;p.room=rm;rm.ps.push(p);rm.game.ctx.AION(d.si);
   send(ws,{t:'start',me:d.si,...rm.game.info});bc(rm,{t:'sys',text:p.name+' reconnected'});push(rm)}
  else if(m.t=='create'&&!p.room){if(rooms.size>=200)return send(ws,{t:'err',msg:'Server is full, try later'});
   p.name=clean(m.name,16)||'Captain';const rm={code:mkCode(),host:p.id,ps:[p],cfg:cf(m.cfg),dc:{}};p.room=rm;rooms.set(rm.code,rm);push(rm)}
  else if(m.t=='join'&&!p.room){const rm=rooms.get(clean(m.code,4).toUpperCase());
   if(!rm)return send(ws,{t:'err',msg:'No room with that code'});
   if(rm.game)return send(ws,{t:'err',msg:'Game already in progress'});
   if(rm.ps.length>=8)return send(ws,{t:'err',msg:'Room is full (8 players)'});
   p.name=clean(m.name,16)||'Captain';rm.ps.push(p);p.room=rm;bc(rm,{t:'sys',text:p.name+' joined'});push(rm)}
  else if(!p.room)return;
  else if(m.t=='cfg'&&p.room.host==p.id){p.room.cfg=cf(m.cfg);push(p.room)}
  else if(m.t=='chat'){const n=Date.now();if(n-p.last<400)return;p.last=n;const x=clean(m.text,160);if(x)bc(p.room,{t:'chat',from:p.name,text:x})}
  else if(m.t=='start'&&p.room.host==p.id&&!p.room.game)startGame(p.room);
  else if(p.room.game&&p.si!=null){const x=p.room.game.ctx;let t='';
   if(m.t=='in')x.INP(p.si,m.k||{});
   else if(m.t=='key'&&KEYS.includes(m.k))t=x.CMD(p.si,{t:'key',k:m.k,pi:m.pi|0});
   else if(m.t=='rc'&&Number.isFinite(+m.x)&&Number.isFinite(+m.y))t=x.CMD(p.si,{t:'rc',x:+m.x,y:+m.y,pi:m.pi|0});
   if(t)send(p.ws,{t:'note',text:t})}
  else if(m.t=='leave')leave(p)});
 ws.on('close',()=>leave(p))});
setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue}ws.isAlive=false;ws.ping()}},30000);
srv.listen(PORT,()=>console.log('Pirate Fleet server on :'+PORT));
