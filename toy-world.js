/* Shared deterministic terrain for WebGL and the Canvas fallback. */
(function(root){
'use strict';
const LIMIT=200,STEP=4,COUNT=101;
const roadX=z=>16*Math.sin(z/55),roadZ=x=>12*Math.sin(x/48);
function rawHeight(x,z){
 const road=Math.min(Math.abs(x-roadX(z)),Math.abs(z-roadZ(x)));
 const clear=Math.min(1,Math.max(0,(Math.hypot(x,z)-17)/14),Math.max(0,(road-7)/8));
 const edge=Math.max(0,(Math.max(Math.abs(x),Math.abs(z))-145)/55);
 return clear*(.6+1.1*(1+Math.sin(x/24)*Math.cos(z/29))+edge*1.8);
}
const heights=new Float32Array(COUNT*COUNT);
for(let z=0;z<COUNT;z++)for(let x=0;x<COUNT;x++)heights[z*COUNT+x]=rawHeight(x*STEP-LIMIT,z*STEP-LIMIT);
function height(x,z){
 const gx=(Math.max(-LIMIT,Math.min(LIMIT,x))+LIMIT)/STEP,gz=(Math.max(-LIMIT,Math.min(LIMIT,z))+LIMIT)/STEP;
 const ix=Math.min(COUNT-2,Math.floor(gx)),iz=Math.min(COUNT-2,Math.floor(gz)),u=gx-ix,v=gz-iz;
 const a=heights[iz*COUNT+ix],b=heights[iz*COUNT+ix+1],c=heights[(iz+1)*COUNT+ix+1],d=heights[(iz+1)*COUNT+ix];
 return u>=v?a+(b-a)*u+(c-b)*v:a+(c-d)*u+(d-a)*v;
}
function mesh(){
 const data=[];for(let z=-LIMIT;z<LIMIT;z+=STEP)for(let x=-LIMIT;x<LIMIT;x+=STEP){
 const a=[x,height(x,z),z],b=[x+STEP,height(x+STEP,z),z],c=[x+STEP,height(x+STEP,z+STEP),z+STEP],d=[x,height(x,z+STEP),z+STEP];
 for(const tri of [[a,c,b],[a,d,c]]){const u=tri[1].map((v,i)=>v-tri[0][i]),v=tri[2].map((v,i)=>v-tri[0][i]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);for(const p of tri)data.push(...p,...n.map(v=>v/length))}
 }return new Float32Array(data);
}
const roads=[];for(let q=-196;q<200;q+=8){for(const axis of [0,1]){const a=axis?[q,roadZ(q)]:[roadX(q),q],b=axis?[q+8,roadZ(q+8)]:[roadX(q+8),q+8];roads.push({x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,y:.1,yaw:Math.atan2(b[0]-a[0],b[1]-a[1]),length:Math.hypot(b[0]-a[0],b[1]-a[1])/2+.2})}}
// Household props share footprints and geometry between both renderers.
const landmarks=[{kind:'planter',x:34,z:26,radius:21,yaw:0},{kind:'watering',x:-45,z:-33,radius:10,yaw:0},{kind:'bench',x:70,z:-48,radius:12,yaw:0}];
const yard=[];
function part(kind,x,y,z,sx,sy,sz,color,yaw=0){yard.push({kind,x,y,z,sx,sy,sz,color,yaw})}
const wood=[.43,.29,.17],clay=[.65,.29,.16],leaf=[.24,.39,.12];
// Individual weathered fence boards and horizontal rails surround the lawn.
for(let q=-196;q<=196;q+=8)for(const side of [-1,1]){
 if(side<0||Math.abs(q)>112)part('box',q,10,side*200,3.8,10,.7,[.46+(q%3)*.015,.33,.21]);
 part('box',side*200,10,q,.7,10,3.8,wood);
}
for(const side of [-1,1])for(const y of [5,14]){for(const x of [-156,156])part('box',x,y,side*198,44,.6,.8,wood);if(side<0)part('box',0,y,side*198,112,.6,.8,wood);part('box',side*198,y,0,.8,.6,200,wood)}
// House wall, back door, windows and a paved terrace at the far end.
part('box',0,24,214,110,24,12,[.76,.70,.58]);
part('box',0,2,180,104,2,18,[.60,.59,.53]);
for(let x=-96;x<=96;x+=16)part('box',x,4.03,180,.10,.025,18,[.40,.40,.36]);
for(const z of [190,178,166])part('box',0,4.04,z,104,.025,.10,[.40,.40,.36]);
part('box',-12,17,201.5,10,17,.35,[.31,.37,.32]);
part('box',-12,23,201,7,9,.15,[.31,.48,.49]);
for(const x of [-60,48]){part('box',x,28,201,18,12,.5,[.89,.86,.76]);part('box',x,28,200.3,15,9,.2,[.32,.48,.50]);part('box',x,28,199.9,.5,9,.2,[.85,.83,.73]);part('box',x,28,199.8,15,.5,.2,[.85,.83,.73])}
part('box',0,47,200,112,1.1,2,[.39,.34,.28]);
// Rectangular terracotta planter: rim, soil and low leafy plants.
let h=height(34,26);
part('box',34,h+3,26,15,3,7,clay);part('box',34,h+6,26,16,.8,8,[.73,.37,.22]);part('box',34,h+6.85,26,14,.08,6,[.20,.16,.10]);
for(let i=0;i<5;i++){const x=23+i*5;part('sphere',x,h+8,26,3,2.8,3,leaf);part('sphere',x-1,h+10,25,1.8,1.7,1.8,[.37,.49,.18]);}
// Galvanized watering can with raised loop handle and a long spout.
h=height(-45,-33);part('rounded',-45,h+4,-33,5,4,4,[.44,.54,.48]);part('box',-45,h+8.2,-33,4,.4,3,[.62,.67,.58]);
for(const x of [-49,-41])part('box',x,h+11,-33,.45,3,.45,[.38,.46,.40]);part('box',-45,h+14,-33,4,.45,.45,[.38,.46,.40]);
part('box',-39,h+4,-29,.65,.65,5,[.48,.56,.48],.8);part('sphere',-35,h+4,-25,1.6,1,1.6,[.61,.64,.54]);
// Garden bench with separate wooden slats and dark metal legs.
h=height(70,-48);
for(const x of [62,78])for(const z of [-51,-45])part('box',x,h+3,z,.6,3,.6,[.19,.23,.20]);
for(const z of [-51,-48,-45])part('box',70,h+6.4,z,11,.6,1.2,[.55,.37,.20]);
for(const y of [9,12])part('box',70,h+y,-52,11,1,.5,[.52,.34,.18]);
// A hose winds beside the can; stone slabs break up the dirt path.
for(let i=0;i<36;i++){const a=i*.18,b=(i+1)*.18,x=-45+Math.cos(a)*16,z=-33+Math.sin(a)*14,nx=-45+Math.cos(b)*16,nz=-33+Math.sin(b)*14;part('box',(x+nx)/2,height(x,z)+.3,(z+nz)/2,.4,.3,Math.hypot(nx-x,nz-z)/2+.15,[.19,.31,.19],Math.atan2(nx-x,nz-z))}
for(let z=-148;z<160;z+=16){const x=roadX(z);if(Math.hypot(x,z)<18)continue;part('box',x,.22,z,4,.12,5,[.58,.58,.51],Math.sin(z)*.08)}
// Deterministic natural shrubs replace the scattered toy building blocks.
const shrubs=[];for(let i=0;i<90;i++){const x=Math.sin(i*7.12)*182,z=Math.cos(i*11.79)*180;if(Math.hypot(x,z)<24||!clearOfLandmarks(x,z,7)||Math.abs(x-roadX(z))<10||Math.abs(z-roadZ(x))<10||z>156)continue;shrubs.push({t:'shrub',x,z,s:2+(i%4)*.6})}
const rocks=[];for(let i=0;i<65;i++){const x=Math.sin(i*12.989)*181,z=Math.cos(i*7.713)*181;if(Math.hypot(x,z)<24||Math.abs(x-roadX(z))<9||Math.abs(z-roadZ(x))<9||landmarks.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+5))continue;rocks.push({x,z,s:1.1+(i%4)*.4})}
function clearOfLandmarks(x,z,margin=8){return z<156-margin&&landmarks.every(p=>Math.hypot(x-p.x,z-p.z)>p.radius+margin)}
// A lightweight terrain view for devices without WebGL. Same height field and roads.
function grassColor(x,z){const patch=Math.sin(x*.047+Math.sin(z*.031))*Math.cos(z*.061),shade=Math.round(71+height(x,z)*3+12*patch);return `rgb(${shade+5},${shade+32},${shade-27})`}
function drawGround(ctx,project,cam,W,H,F){
 const range=Math.hypot(W,H)/F*.65+18,step=8;
 for(let z=Math.max(-200,Math.floor((cam.z-range)/step)*step);z<Math.min(200,cam.z+range);z+=step)for(let x=Math.max(-200,Math.floor((cam.x-range)/step)*step);x<Math.min(200,cam.x+range);x+=step){
  const points=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]].map(([x,z])=>project(x,height(x,z),z));if(points.some(p=>!p))continue;
  if(ctx.createLinearGradient){const g=ctx.createLinearGradient(points[0][0],points[0][1],points[2][0],points[2][1]);g.addColorStop(0,grassColor(x,z));g.addColorStop(1,grassColor(x+step,z+step));ctx.fillStyle=g}else ctx.fillStyle=grassColor(x,z);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();
 }
 // Fine grass marks break up the smooth lawn without randomizing each frame.
 for(let i=0;i<2200;i++){const x=Math.sin(i*12.989)*196,z=Math.cos(i*7.71)*196;if(Math.hypot(x-cam.x,z-cam.z)>range)continue;const y=height(x,z)+.03,a=project(x,y,z),b=project(x+.28,y,z+.65),c=project(x+.5,y,z);ctx.fillStyle=i%3?'#627c38':'#8b9251';ctx.beginPath();ctx.moveTo(...a.slice(0,2));ctx.lineTo(...b.slice(0,2));ctx.lineTo(...c.slice(0,2));ctx.closePath();ctx.fill()}
 for(const road of roads){if(Math.hypot(road.x-cam.x,road.z-cam.z)>range)continue;const c=Math.cos(road.yaw),s=Math.sin(road.yaw);const points=[[-5,-road.length],[5,-road.length],[5,road.length],[-5,road.length]].map(([x,z])=>project(road.x+x*c+z*s,.12,road.z-x*s+z*c));ctx.fillStyle='#aa9162';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();}
 const pad=(corners,color,y)=>{const points=corners.map(([x,z])=>project(x,y,z));ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill()};
 pad([[-7,-7],[7,-7],[7,7],[-7,7]],'#566449',.27);
 for(const side of [-1,1])pad([[side*2-.35,-3],[side*2+.35,-3],[side*2+.35,3],[side*2-.35,3]],'#dfd39e',.36);
 pad([[-2,-.35],[2,-.35],[2,.35],[-2,.35]],'#dfd39e',.36);

}
root.ToyWorld={height,mesh,roads,rocks,landmarks,yard,shrubs,clearOfLandmarks,drawGround};
})(globalThis);
