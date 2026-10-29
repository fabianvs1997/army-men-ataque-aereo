const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../toy-world.js');
require('../toy-renderer.js');
const Renderer=globalThis.ToyRenderer;
function fixture(options={}){
 const listeners={},counts={draw:0,compile:0,viewport:[]};
 const gl=new Proxy({
  getShaderParameter:()=>!options.failShader,getProgramParameter:()=>!options.failLink,
  getShaderInfoLog:()=> 'shader failure',getProgramInfoLog:()=> 'link failure',
  createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),
  getUniformLocation:(_,name)=>name,getAttribLocation:(_,name)=>name==='position'?0:1,
  uniform3f:(name,...values)=>{assert.ok(values.every(Number.isFinite),name);if(name==='size')assert.ok(values.every(v=>v>0))},
  uniform3fv:(name,values)=>assert.ok(values.every(Number.isFinite),name),
  uniform2f:(name,...values)=>assert.ok(values.every(Number.isFinite),name),
  uniform1f:(name,value)=>assert.ok(Number.isFinite(value),name),
  bufferData:(_,data)=>assert.ok(data.every(Number.isFinite)),
  drawArrays:(_,first,count)=>{assert.equal(first,0);assert.ok(count>0);counts.draw++},
  compileShader:()=>counts.compile++,viewport:(...args)=>counts.viewport.push(args)
 },{get:(obj,key)=>key in obj?obj[key]:key.toUpperCase()===key?1:()=>{}});
 const canvas={width:0,height:0,getContext:()=>options.noWebGL?null:gl,addEventListener:(type,fn)=>listeners[type]=fn};
 return {gl,canvas,listeners,counts};
}
const scene=()=>({W:390,H:844,F:390/105,HY:844*.52,cam:{x:0,z:0,yaw:Math.PI/5},PITCH:Math.PI/3,P:{x:0,y:8,z:0,yaw:0,inv:0},E:['heli','tank','tur','base'].map((k,i)=>({k,x:i*8,y:k==='heli'?8:0,z:15,fl:0})),DC:[{t:'t',x:15,z:0},{t:'b',x:-15,z:0,s:5,c:'#d9473f'}],BL:[{x:0,y:8,z:4,vx:0,vz:130}],EB:[],MS:[],FX:[{x:0,y:2,z:8,l:.3,s:4}],PK:[{x:-8,z:-8,ty:'a'}],rot:1,t:0});
test('mesh positions and normals are finite, bounded and normalized',()=>{
 for(const kind of ['box','sphere','rounded']){const data=Renderer.geometry(kind);assert.equal(data.length%18,0);for(let i=0;i<data.length;i+=6){for(let j=0;j<3;j++)assert.ok(Math.abs(data[i+j])<=1.000001);assert.ok(Math.abs(Math.hypot(...data.slice(i+3,i+6))-1)<1e-6)}}
});
test('renderer draws all entity types and resizes across portrait/landscape',()=>{
 const f=fixture(),r=new Renderer(f.canvas,()=>{},()=>{});assert.equal(r.render(scene()),true);assert.ok(f.counts.draw>50);const second=scene();second.W=844;second.H=390;r.render(second);assert.deepEqual(f.counts.viewport.at(-1),[0,0,844,390]);
});
test('lost WebGL stops drawing and restoration rebuilds buffers/program',()=>{
 const f=fixture();let lost=0,restored=0,prevented=false;const r=new Renderer(f.canvas,()=>lost++,()=>restored++);f.listeners.webglcontextlost({preventDefault(){prevented=true}});assert.equal(r.render(scene()),false);assert.equal(f.counts.draw,0);assert.equal(lost,1);assert.equal(prevented,true);f.listeners.webglcontextrestored();assert.equal(restored,1);assert.equal(f.counts.compile,4);assert.equal(r.render(scene()),true);
});
test('unavailable WebGL and shader/link failures permit caller fallback',()=>{for(const option of ['noWebGL','failShader','failLink']){const f=fixture({[option]:true});assert.throws(()=>new Renderer(f.canvas,()=>{},()=>{}))}});
test('objects outside view are culled',()=>{const f=fixture(),r=new Renderer(f.canvas,()=>{},()=>{}),s=scene();r.render(s);const near=r.drawCalls;s.DC.forEach(d=>d.x=2000);s.E.forEach(d=>d.x=2000);r.render(s);assert.ok(r.drawCalls<near)});

test('both shaders declare matching varying precision for WebGL 1',()=>{const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../toy-renderer.js'),'utf8');assert.equal((source.match(/varying mediump vec3 surfaceNormal;/g)||[]).length,2)});
test('legacy WebGL alias is attempted if the standard context is unavailable',()=>{const f=fixture();const names=[];f.canvas.getContext=name=>{names.push(name);return name==='experimental-webgl'?f.gl:null};const r=new Renderer(f.canvas,()=>{},()=>{});assert.deepEqual(names,['webgl','experimental-webgl']);assert.equal(r.render(scene()),true)});
