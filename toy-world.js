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
const landmarks=[{kind:'pencil',x:34,z:26,radius:21,yaw:.55},{kind:'spool',x:-45,z:-33,radius:10,yaw:0},{kind:'domino',x:70,z:-48,radius:12,yaw:-.45}];
const rocks=[];for(let i=0;i<65;i++){const x=Math.sin(i*12.989)*181,z=Math.cos(i*7.713)*181;if(Math.hypot(x,z)<24||Math.abs(x-roadX(z))<9||Math.abs(z-roadZ(x))<9||landmarks.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+5))continue;rocks.push({x,z,s:1.1+(i%4)*.4})}
function clearOfLandmarks(x,z,margin=8){return landmarks.every(p=>Math.hypot(x-p.x,z-p.z)>p.radius+margin)}
// A lightweight terrain view for devices without WebGL. Same height field and roads.
function drawGround(ctx,project,cam,W,H,F){
 const range=Math.hypot(W,H)/F*.65+18,step=8;
 for(let z=Math.max(-200,Math.floor((cam.z-range)/step)*step);z<Math.min(200,cam.z+range);z+=step)for(let x=Math.max(-200,Math.floor((cam.x-range)/step)*step);x<Math.min(200,cam.x+range);x+=step){
  const points=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]].map(([x,z])=>project(x,height(x,z),z));if(points.some(p=>!p))continue;
  const shade=Math.round(83+height(x,z)*5+6*Math.sin(x*.3+z*.2));ctx.fillStyle=`rgb(${shade},${shade+30},${shade-24})`;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();
 }
 for(const road of roads){if(Math.hypot(road.x-cam.x,road.z-cam.z)>range)continue;const c=Math.cos(road.yaw),s=Math.sin(road.yaw);const points=[[-5,-road.length],[5,-road.length],[5,road.length],[-5,road.length]].map(([x,z])=>project(road.x+x*c+z*s,.12,road.z-x*s+z*c));ctx.fillStyle='#aa9162';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();}
}
root.ToyWorld={height,mesh,roads,rocks,landmarks,clearOfLandmarks,drawGround};
})(globalThis);
