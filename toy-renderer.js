/* Dependency-free WebGL 1 renderer. World units and camera match the game. */
(function (root) {
'use strict';
const VS = `
attribute vec3 position; attribute vec3 normal;
uniform vec3 origin, size; uniform float yaw;
uniform vec2 camera, viewport; uniform float cameraYaw, pitch, scale, centerY;
varying mediump vec3 surfaceNormal;
void main(){
 float s=sin(yaw),c=cos(yaw); vec3 p=position*size;
 p=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c)+origin;
 vec3 n=normal/size; surfaceNormal=normalize(vec3(n.x*c+n.z*s,n.y,-n.x*s+n.z*c));
 vec2 d=p.xz-camera;float f=d.x*sin(cameraYaw)+d.y*cos(cameraYaw);
 float r=-d.x*cos(cameraYaw)+d.y*sin(cameraYaw);
 float u=p.y*cos(pitch)+f*sin(pitch);
 float depth=f*cos(pitch)-p.y*sin(pitch);
 gl_Position=vec4(r*scale*2.0/viewport.x,(viewport.y/2.0-centerY+u*scale)*2.0/viewport.y,depth/600.0,1.0);
}`;
const FS = `
precision mediump float;
uniform vec3 color;uniform float gloss;uniform vec3 eyeDirection;
varying mediump vec3 surfaceNormal;
void main(){
 vec3 n=normalize(surfaceNormal),light=normalize(vec3(-0.6,1.0,-0.4));
 float diffuse=max(dot(n,light),0.0);
 float highlight=max(dot(n,normalize(light+eyeDirection)),0.0);
 float shine=(pow(highlight,56.0)*0.75+pow(highlight,14.0)*0.12)*gloss;
 float rim=pow(1.0-max(dot(n,eyeDirection),0.0),3.0)*0.045*gloss;
 gl_FragColor=vec4(color*(0.48+0.52*diffuse)+vec3(shine+rim),1.0);
}`;
function geometry(kind) {
 const data=[];const vertex=(p,n)=>data.push(...p,...n);
 if(kind==='rounded'){
  // Project a subdivided cube onto a box with a rounded 0.16-unit edge.
  const rounded=p=>{const q=p.map(v=>Math.max(-.84,Math.min(.84,v))),delta=p.map((v,i)=>v-q[i]),len=Math.hypot(...delta),n=delta.map(v=>v/len);return [q.map((v,i)=>v+n[i]*.16),n]};
  for(let axis=0;axis<3;axis++)for(const side of [-1,1])for(let i=0;i<6;i++)for(let j=0;j<6;j++){
   const point=(u,v)=>{const p=[0,0,0];p[axis]=side;p[(axis+1)%3]=-1+u/3;p[(axis+2)%3]=-1+v/3;return rounded(p)};
   for(const [p,n] of [point(i,j),point(i+1,j),point(i+1,j+1),point(i,j),point(i+1,j+1),point(i,j+1)])vertex(p,n);
  }
 }else if(kind==='box'){
  for(const [n,a,b,c,d] of [
   [[0,1,0],[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],
   [[0,-1,0],[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]],
   [[1,0,0],[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],
   [[-1,0,0],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]],
   [[0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
   [[0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]
  ])for(const p of [a,b,c,a,c,d])vertex(p,n);
 }else{
  const point=(i,j)=>{const a=i*Math.PI/10,b=j*Math.PI*2/16;return [Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)]};
  for(let i=0;i<10;i++)for(let j=0;j<16;j++)for(const p of [point(i,j),point(i+1,j),point(i+1,j+1),point(i,j),point(i+1,j+1),point(i,j+1)])vertex(p,p);
 }
 return new Float32Array(data);
}
class ToyRenderer {
 constructor(canvas,onLost,onRestored){
  this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:false,antialias:true})||canvas.getContext('experimental-webgl',{alpha:false,antialias:false});
  if(!this.gl)throw new Error('WebGL no disponible');
  this.lost=false;this.init();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;onLost();});
  canvas.addEventListener('webglcontextrestored',()=>{try{this.init();this.lost=false;onRestored();}catch(e){onLost();}});
 }
 init(){
  const gl=this.gl;
  const shader=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(sh);gl.deleteShader(sh);throw Error(error)}return sh};
  const vs=shader(gl.VERTEX_SHADER,VS),fs=shader(gl.FRAGMENT_SHADER,FS),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  this.program=program;this.loc={};for(const name of ['origin','size','yaw','camera','viewport','cameraYaw','pitch','scale','centerY','color','gloss','eyeDirection'])this.loc[name]=gl.getUniformLocation(program,name);
  this.position=gl.getAttribLocation(program,'position');this.normal=gl.getAttribLocation(program,'normal');
  this.meshes={};for(const kind of ['box','sphere','rounded']){const data=geometry(kind),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);this.meshes[kind]={buffer,count:data.length/6}}
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(.27,.36,.23,1);
 }
 part(kind,x,y,z,sx,sy,sz,color,yaw=0,gloss=.6){
  const gl=this.gl,m=this.meshes[kind],u=this.loc;
  gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.enableVertexAttribArray(this.position);gl.enableVertexAttribArray(this.normal);gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(this.normal,3,gl.FLOAT,false,24,12);
  gl.uniform3f(u.origin,x,y,z);gl.uniform3f(u.size,sx,sy,sz);gl.uniform1f(u.yaw,yaw);gl.uniform3fv(u.color,color);gl.uniform1f(u.gloss,gloss);gl.drawArrays(gl.TRIANGLES,0,m.count);this.drawCalls++;
 }
 helicopter(x,y,z,yaw,rot,tan=false,flash=false){
  const col=flash?[1,1,1]:tan?[.76,.60,.32]:[.22,.59,.13],dark=tan?[.35,.27,.12]:[.10,.29,.07];
  const p=(kind,lx,ly,lz,sx,sy,sz,c=col,angle=0)=>this.part(kind,x+lx*Math.cos(yaw)+lz*Math.sin(yaw),y+ly,z-lx*Math.sin(yaw)+lz*Math.cos(yaw),sx,sy,sz,c,yaw+angle);
  this.part('sphere',x,.06,z,3.4,.04,2.5,[.23,.30,.18],yaw,0);
  p('sphere',0,0,0,1.7,1.35,2.6);
  // Raised center seam, engine vents and recessed screw caps read as molded toys.
  p('rounded',0,1.32,.35,.045,.035,1.4,dark);
  for(const side of [-1,1]){
   p('sphere',side*1.62,.1,-.4,.055,.16,.16,dark);
   p('box',side*1.68,.1,-.4,.018,.025,.095,col);
   for(let i=0;i<3;i++)p('rounded',side*.48,1.65,-1.05+i*.32,.26,.05,.06,dark);
  }p('sphere',0,.25,1.7,1.43,.95,1.15,[.08,.23,.25]);
  p('box',0,.5,2.25,.09,.8,.2);p('rounded',0,.15,-3.6,.23,.25,2.2);p('box',0,.7,-5.2,1.25,.12,.45);
  p('rounded',0,1.1,-5.5,.15,.9,.45);p('sphere',0,1.1,-.7,.8,.7,1.3);
  for(const side of [-1,1]){p('box',side*1.8,-1.4,0,.16,.14,2.5,dark);p('box',side*1.4,-.8,.8,.13,.7,.13,dark);p('box',side*1.4,-.8,-1.1,.13,.7,.13,dark);p('rounded',side*1.9,-.2,.8,.22,.25,1.4,dark)}
  p('box',0,2,0,.15,.6,.15,dark);p('box',0,2.6,0,5.6,.055,.17,dark,rot);p('box',0,2.6,0,.17,.055,5.6,dark,rot);
 }
 render(scene){
  if(this.lost)return false;
  const {W,H,F,HY,cam,PITCH,P,E,DC,BL,EB,MS,FX,PK,rot}=scene,gl=this.gl,u=this.loc;
  const d=Math.min(root.devicePixelRatio||1,1.75),width=Math.round(W*d),height=Math.round(H*d);
  if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height}
  gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);this.drawCalls=0;
  gl.uniform2f(u.camera,cam.x,cam.z);gl.uniform2f(u.viewport,W,H);gl.uniform1f(u.cameraYaw,cam.yaw);gl.uniform1f(u.pitch,PITCH);gl.uniform1f(u.scale,F);gl.uniform1f(u.centerY,HY);gl.uniform3f(u.eyeDirection,-Math.sin(cam.yaw)*Math.cos(PITCH),Math.sin(PITCH),-Math.cos(cam.yaw)*Math.cos(PITCH));
  this.part('box',0,-1,0,200,1,200,[.39,.49,.25],0,.02);
  // A compact practice clearing, roads and helipad. Ground remains flat for gameplay.
  this.part('box',0,.012,0,5,.01,200,[.57,.49,.32],0,0);this.part('box',0,.035,0,200,.01,4,[.57,.49,.32],0,0);
  this.part('box',0,.09,0,7,.05,7,[.34,.39,.29],0,.04);
  for(const side of [-1,1])this.part('box',side*2,.16,0,.35,.04,3,[.84,.80,.58],0,0);
  this.part('box',0,.16,0,2,.04,.35,[.84,.80,.58],0,0);
  for(const side of [-1,1]){this.part('box',side*200,1.5,0,.6,1.5,200,[.43,.34,.19]);this.part('box',0,1.5,side*200,200,1.5,.6,[.43,.34,.19])}
  const radius=Math.hypot(W,H)/(2*F)+24,visible=o=>Math.hypot(o.x-cam.x,o.z-cam.z)<radius;
  for(const d of DC){if(!visible(d))continue;
   if(d.t==='t'){this.part('sphere',d.x,.12,d.z,3,.12,3,[.20,.36,.12]);this.part('box',d.x,2,d.z,.5,2,.5,[.33,.28,.12]);this.part('sphere',d.x,5,d.z,2.7,3.7,2.7,[.18,.42,.12]);this.part('sphere',d.x-.4,7.5,d.z,1.9,2.8,1.9,[.26,.49,.15]);}
   else{const color=d.c==='#d9473f'?[.73,.24,.16]:d.c==='#3f7fd9'?[.20,.40,.65]:[.78,.62,.20];this.part('rounded',d.x,d.s/2,d.z,d.s/2,d.s/2,d.s/2,color);for(const side of [-1,1])this.part('sphere',d.x+side*d.s*.22,d.s,d.z,d.s*.16,.3,d.s*.16,color)}
  }
  for(const e of E){if(!visible(e))continue;const col=e.fl>0?[1,1,1]:[.76,.61,.36],dark=[.39,.31,.17],yaw=P?Math.atan2(P.x-e.x,P.z-e.z):0;
   if(e.k==='heli'){this.helicopter(e.x,e.y,e.z,yaw,rot,true,e.fl>0);continue}
   if(e.k!=='heli')this.part('sphere',e.x,.13,e.z,e.k==='base'?6.4:3.6,.16,e.k==='base'?5.6:4.1,col);
   if(e.k==='base'){this.part('rounded',e.x,2.5,e.z,5,2.5,4,col);this.part('box',e.x,5.4,e.z,5.5,.4,4.5,col);this.part('box',e.x,1.4,e.z+4.02,1.1,1.4,.08,dark);this.part('box',e.x+4,10,e.z,.13,5,.13,col);this.part('box',e.x+5,14,e.z,1,.65,.1,[.75,.22,.12]);}
   else{this.part('rounded',e.x,1,e.z,e.k==='tank'?2.5:1.7,1,3,col,yaw);this.part('sphere',e.x,2.5,e.z,1.4,.9,1.6,col,yaw);this.part('box',e.x+Math.sin(yaw)*2,2.7,e.z+Math.cos(yaw)*2,.22,.22,2,col,yaw);if(e.k==='tank')for(const side of [-1,1]){this.part('rounded',e.x+side*2.4*Math.cos(yaw),.65,e.z-side*2.4*Math.sin(yaw),.4,.65,3.1,dark,yaw);
    for(let tread=-2;tread<=2;tread++)this.part('rounded',e.x+side*2.4*Math.cos(yaw)+tread*Math.sin(yaw),1.28,e.z-side*2.4*Math.sin(yaw)+tread*Math.cos(yaw),.42,.06,.12,col,yaw);
   }}
  }
  for(const q of PK)if(visible(q))this.part('box',q.x,1.2,q.z,.9,.9,.9,q.ty==='a'?[.3,.8,.3]:[.8,.25,.15],0,.4);
  for(const [list,color,size] of [[BL,[1,.82,.20],.23],[EB,[1,.3,.10],.35],[MS,[.95,.95,.75],.5]])for(const b of list)if(visible(b))this.part('sphere',b.x,b.y,b.z,size,size,size*2,color,Math.atan2(b.vx,b.vz),0);
  for(const f of FX)if(visible(f)){const age=1-f.l/.5,sz=f.s*(.2+age*.6);this.part('sphere',f.x,f.y+age*3,f.z,sz,sz,sz,age>.65?[.36,.37,.29]:[1,.45,.08],0,0);if(age<.65)this.part('sphere',f.x,f.y+sz*.4,f.z,sz*.7,sz*.7,sz*.7,[1,.84,.27],0,0)}
  if(P)this.helicopter(P.x,P.y,P.z,P.yaw,rot,false,P.inv>0&&Math.floor(scene.t*20)%2===0);
  return true;
 }
}
ToyRenderer.geometry=geometry;root.ToyRenderer=ToyRenderer;
})(globalThis);
