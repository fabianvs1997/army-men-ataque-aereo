const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('army-men-ataque-aereo.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function game(){
 const elements=new Map(),listeners={};
 const element=id=>{if(!elements.has(id))elements.set(id,{style:{},getContext:()=>({setTransform(){}}),getBoundingClientRect:()=>({width:360,height:640}),addEventListener(name,fn){this[name]=fn},setPointerCapture(){},setAttribute(){}});return elements.get(id)};
 const sandbox={document:{getElementById:element,addEventListener(name,fn){listeners[name]=fn}},navigator:{},devicePixelRatio:1,performance:{now:()=>0},requestAnimationFrame(){},addEventListener(name,fn){listeners[name]=fn},Math,setTimeout};
 vm.createContext(sandbox);vm.runInContext(source,sandbox);
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
