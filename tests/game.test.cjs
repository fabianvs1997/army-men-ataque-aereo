const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('army-men-ataque-aereo.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function game(){
 const elements=new Map(),listeners={};
 const element=id=>{if(!elements.has(id))elements.set(id,{style:{},getContext:()=>new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})}),getBoundingClientRect:()=>({width:360,height:640}),addEventListener(name,fn){this[name]=fn},setPointerCapture(){},setAttribute(){}});return elements.get(id)};
 const sandbox={document:{getElementById:element,addEventListener(name,fn){listeners[name]=fn}},navigator:{},devicePixelRatio:1,performance:{now:()=>0},requestAnimationFrame(){},addEventListener(name,fn){listeners[name]=fn},Math,setTimeout};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync('toy-world.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('toy-missions.js','utf8'),sandbox);vm.runInContext(source,sandbox);
 return {run:s=>vm.runInContext(s,sandbox),listeners,element};
}
test('pause freezes state and clears held inputs; resume preserves mission',()=>{
 const g=game();g.run("start(2,true);keys.w=1;fire=true;mAsk=true;pauseGame()");
 assert.equal(g.run('st'),'paused');assert.equal(g.run('Object.keys(keys).length'),0);assert.equal(g.run('fire||mAsk'),false);
 g.run('resumeGame()');assert.equal(g.run('st'),'play');assert.equal(g.run('mis'),2);
});
test('blur pauses active mission',()=>{const g=game();g.run('start(1,true)');g.listeners.blur();assert.equal(g.run('st'),'paused')});
test('secondary pointer cannot steer or release active pilot pointer',()=>{
 const g=game();g.run('start(1,true)');const c=g.element('c');c.pointerdown({pointerId:1,clientX:20,clientY:30});c.pointerdown({pointerId:2,clientX:90,clientY:90});c.pointermove({pointerId:2,clientX:100,clientY:100});c.pointerup({pointerId:2});assert.equal(g.run('drag.id'),1);assert.equal(g.run('drag.x'),20);c.pointercancel({pointerId:1});assert.equal(g.run('drag'),null);
});
test('restart clears transient state and duplicate kills do not award twice',()=>{const g=game();g.run('start(1,true);t=99;shk=1;fire=true;start(1,true)');assert.equal(g.run('t+shk'),0);assert.equal(g.run('fire'),false);g.run("sfx.boom=()=>{};const enemy=E.find(e=>e.k==='base');kill(enemy);kill(enemy)");assert.equal(g.run('bd'),1);assert.equal(g.run('P.sc'),100)});
test('missile key repeat does not request another missile',()=>{const g=game();g.run('start(1,true)');g.listeners.keydown({key:'m',repeat:true,preventDefault(){}});assert.equal(g.run('mAsk'),false)});
test('screen-relative movement follows all four directions and holds position on release',()=>{
 for(const [key,axis,sign] of [['d',0,1],['a',0,-1],['w',1,-1],['s',1,1]]){const g=game();g.run('start(1,true);HY=H*.52');const before=g.run('P3(P.x,P.y,P.z)');g.run(`keys.${key}=1;upd(.05)`);const after=g.run('P3(P.x,P.y,P.z)');assert.ok((after[axis]-before[axis])*sign>0,key);g.run('clearInput()');const x=g.run('P.x'),z=g.run('P.z');g.run('upd(.05)');assert.equal(g.run('P.x'),x);assert.equal(g.run('P.z'),z)}
});
test('camera stays fixed in heading and projectiles follow the chosen heading',()=>{const g=game();g.run('start(1,true);keys.d=1;upd(.05);fire=true;upd(.05)');assert.equal(g.run('cam.yaw'),Math.PI/5);assert.ok(g.run('BL.length')>0);assert.ok(g.run('BL[0].vx*Math.sin(P.yaw)+BL[0].vz*Math.cos(P.yaw)')>129)});
test('orthographic scale stays constant across depth and viewport sizes',()=>{const g=game();for(const [w,h] of [[390,844],[844,390]]){g.run(`W=${w};H=${h};F=Math.min(W/SCALE_WIDTH,H/120)`);assert.equal(g.run('P3(0,0,0)[2]'),g.run('P3(0,0,80)[2]'));assert.ok(g.run('F*11/W')<.12)}});

test('ground enemies match terrain elevation and start clear of large props',()=>{const g=game();g.run('start(1,true)');assert.equal(g.run('E.every(e=>ToyWorld.clearOfLandmarks(e.x,e.z,10))'),true);assert.equal(g.run('E.every(e=>e.y===ToyWorld.height(e.x,e.z))'),true);g.run('upd(.05)');assert.equal(g.run("E.filter(e=>e.k!=='heli').every(e=>e.y===ToyWorld.height(e.x,e.z))"),true)});
test('destroying bases alone does not win; complete rescue and extraction awards once',()=>{const g=game();g.run("start(1,true);for(const e of E)kill(e);E=[];EB=[];airLeft=0;upd(.05)");assert.equal(g.run('st'),'play');g.run("for(const a of mission.allies){P.x=a.x;P.z=a.z;for(let i=0;i<30;i++)upd(.05)}");assert.equal(g.run('mission.rescued'),2);assert.equal(g.run('st'),'play');g.run('P.x=0;P.z=0;for(let i=0;i<40;i++)upd(.05)');assert.equal(g.run('st'),'win');const score=g.run('P.sc');g.run('upd(.05)');assert.equal(g.run('P.sc'),score)});
test('paused pickup cannot advance, lethal damage wins over extraction and retry stays on mission',()=>{const g=game();g.run("start(2,true);mission.release(0);P.x=mission.allies[0].x;P.z=mission.allies[0].z;E=[];pauseGame();for(let i=0;i<60;i++)upd(.05)");assert.equal(g.run('mission.rescued'),0);g.run('resumeGame();P.arm=1;P.inv=0;EB=[{x:P.x,y:P.y,z:P.z,vx:0,vy:0,vz:0,l:1}];upd(.05)');assert.equal(g.run('st'),'over');g.element('go').onclick();assert.equal(g.run('mis'),2);assert.equal(g.run('mission.rescued'),0);assert.equal(g.run('P.arm'),10)});
test('fast projectile damages only the nearest intersected target',()=>{const g=game();g.run("start(1,true);E=[];spawnE('inf',0,10);spawnE('inf',0,12);for(const e of E){e.y=0;e.cd=999}BL=[{x:0,y:1.5,z:0,vx:0,vy:0,vz:400,l:1}];upd(.05)");assert.equal(g.run('E[0].hp'),1);assert.equal(g.run('E[1].hp'),2)});
test('mission 3 ends campaign and play-again resets score and mission',()=>{const g=game();g.run("start(3,true);for(const e of E)kill(e);E=[];airLeft=0;for(const a of mission.allies){P.x=a.x;P.z=a.z;for(let i=0;i<30;i++)upd(.05)}P.x=0;P.z=0;for(let i=0;i<40;i++)upd(.05)");assert.equal(g.run('st'),'campaign');g.element('go').onclick();assert.equal(g.run('mis'),1);assert.equal(g.run('P.sc'),0)});

test('Canvas fallback renders mission infantry, waiting allies and extraction area',()=>{const g=game();assert.doesNotThrow(()=>g.run("draw();start(1,true);mission.release(0);draw();pauseGame();draw()"))});
