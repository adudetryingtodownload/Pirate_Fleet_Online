const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
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
const snap=(rm,p)=>({t:'room',code:rm.code,you:p.id,host:rm.host,cfg:rm.cfg,players:rm.ps.map(x=>({id:x.id,name:x.name}))});
const push=rm=>rm.ps.forEach(p=>send(p.ws,snap(rm,p)));
const bc=(rm,o)=>rm.ps.forEach(p=>send(p.ws,o));
function leave(p){const rm=p.room;if(!rm)return;p.room=null;rm.ps=rm.ps.filter(x=>x!==p);
 if(!rm.ps.length){rooms.delete(rm.code);return}
 if(rm.host==p.id)rm.host=rm.ps[0].id;
 bc(rm,{t:'sys',text:p.name+' left the room'});push(rm)}
wss.on('connection',ws=>{
 const p={id:nid++,name:'Captain',ws,room:null,last:0};ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
  if(m.t=='create'&&!p.room){if(rooms.size>=200)return send(ws,{t:'err',msg:'Server is full, try later'});
   p.name=clean(m.name,16)||'Captain';const rm={code:mkCode(),host:p.id,ps:[p],cfg:cf(m.cfg)};p.room=rm;rooms.set(rm.code,rm);push(rm)}
  else if(m.t=='join'&&!p.room){const rm=rooms.get(clean(m.code,4).toUpperCase());
   if(!rm)return send(ws,{t:'err',msg:'No room with that code'});
   if(rm.ps.length>=8)return send(ws,{t:'err',msg:'Room is full (8 players)'});
   p.name=clean(m.name,16)||'Captain';rm.ps.push(p);p.room=rm;bc(rm,{t:'sys',text:p.name+' joined'});push(rm)}
  else if(!p.room)return;
  else if(m.t=='cfg'&&p.room.host==p.id){p.room.cfg=cf(m.cfg);push(p.room)}
  else if(m.t=='chat'){const n=Date.now();if(n-p.last<400)return;p.last=n;const x=clean(m.text,160);if(x)bc(p.room,{t:'chat',from:p.name,text:x})}
  else if(m.t=='leave')leave(p)});
 ws.on('close',()=>leave(p))});
setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue}ws.isAlive=false;ws.ping()}},30000);
srv.listen(PORT,()=>console.log('Pirate Fleet server on :'+PORT));
