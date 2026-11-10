(() => {
  'use strict';
  const canvas=document.querySelector('#flight'), status=document.querySelector('#status');
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true});
  if(!gl){status.textContent='Para volar se necesita WebGL. Activa la aceleración gráfica del navegador.';return;}
  const vertex=`attribute vec3 aPos;attribute vec2 aUV;uniform vec3 origin,eye;uniform float yaw,aspect;attribute float aLight; varying float light; varying vec3 point; varying vec2 uv;
  void main(){float s=sin(yaw),c=cos(yaw);vec3 v=origin+vec3(c*aPos.x+s*aPos.z,aPos.y,-s*aPos.x+c*aPos.z)-eye;
  light=aLight;point=v+eye;float depth=dot(v,normalize(vec3(0.,-22.,-28.)));float up=dot(v,normalize(vec3(0.,28.,-22.)));
  gl_Position=vec4(v.x*2.246/aspect,up*2.246,depth*1.0004-.20004,depth);uv=aUV;}`;
  const fragment=`precision highp float;
  varying vec2 uv; varying float light; varying vec3 point;
  uniform sampler2D tex,detailMap; uniform float groundPass; uniform vec2 aircraft;
  void main(){
    vec4 sampleColor=texture2D(tex,uv);
    if(sampleColor.a<0.30)discard;
    vec3 rgb=sampleColor.rgb*light;
    if(groundPass>0.5){
      rgb*=.88+.24*texture2D(detailMap,point.xz/10.).r;
      vec2 shadow=(point.xz-aircraft-vec2(1.4,1.8))/vec2(2.8,4.);
      rgb*=1.-.26*exp(-dot(shadow,shadow));
    }else{rgb=pow(rgb,vec3(.80));}
    gl_FragColor=vec4(rgb,1.);
  }`;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const program=gl.createProgram();
  try {
    gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  } catch(e){status.textContent='Error al iniciar el renderizador: '+e.message;return;}
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);
  const loc=n=>gl.getUniformLocation(program,n), pos=gl.getAttribLocation(program,'aPos'),uv=gl.getAttribLocation(program,'aUV');
  const eye=loc('eye'),angle=loc('yaw'),origin=loc('origin'),aspect=loc('aspect');
  gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(uv);
  const lightAttr=gl.getAttribLocation(program,'aLight'), groundPass=loc('groundPass'), aircraft=loc('aircraft');
  gl.enableVertexAttribArray(lightAttr);
  function upload(m){
    const lights=new Float32Array(m.vertices.length/5).fill(1.08);
    if(m.heights){
      for(let z=0;z<129;z++)for(let x=0;x<129;x++){
        const h=(u,v)=>m.heights[Math.min(128,Math.max(0,v))*129+Math.min(128,Math.max(0,u))];
        const nx=(h(x-1,z)-h(x+1,z))/8,nz=(h(x,z-1)-h(x,z+1))/8;
        lights[z*129+x]=.72+.55*Math.max(0,(-.52*nx+.75-.40*nz)/Math.hypot(nx,1,nz));
      }
    }
    const lightBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,lightBuffer);gl.bufferData(gl.ARRAY_BUFFER,lights,gl.STATIC_DRAW);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,m.vertices,gl.STATIC_DRAW);
    let index=null;if(m.indices){index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.indices,gl.STATIC_DRAW);}
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
    for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,m.texture.w,m.texture.h,0,gl.RGBA,gl.UNSIGNED_BYTE,m.texture.rgba);
    return {buffer,index,texture,lightBuffer,count:index?m.indices.length:m.vertices.length/5};
  }
  function draw(m,x,y,z,r){
    gl.uniform1f(groundPass,m===ground?1:0);gl.bindBuffer(gl.ARRAY_BUFFER,m.lightBuffer);gl.vertexAttribPointer(lightAttr,1,gl.FLOAT,false,4,0);
    gl.uniform3f(origin,x,y,z);gl.uniform1f(angle,r);gl.bindTexture(gl.TEXTURE_2D,m.texture);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,20,0);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,20,12);
    if(m.index){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.index);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);}
    else gl.drawArrays(gl.TRIANGLES,0,m.count);
  }
  let ground,ship,height,x=240,z=240,yaw=0,mouse=null,last=0;
  const keys=new Set(),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  canvas.addEventListener('keydown',e=>{keys.add(e.code);});window.addEventListener('keyup',e=>keys.delete(e.code));
  function release(){keys.clear();mouse=null;}
  canvas.addEventListener('blur',release);window.addEventListener('blur',release);
  canvas.oncontextmenu=e=>e.preventDefault();
  canvas.onpointerdown=e=>{canvas.focus();if(e.button===2||e.pointerType==='touch'){mouse=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);}};
  canvas.onpointermove=e=>{if(mouse)mouse=[e.clientX,e.clientY];};
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>{mouse=null;};canvas.style.touchAction='none';
  const radar=document.querySelector('#radar').getContext('2d');
  const chart=document.createElement('canvas');
  let rotor,spin=0;
  function paintRadar(){
    if(!radar)return;
    radar.drawImage(chart,0,0,144,144);
    radar.save();radar.translate(x*144/512,z*144/512);radar.rotate(-yaw);
    radar.beginPath();radar.moveTo(0,-8);radar.lineTo(5,5);radar.lineTo(0,3);radar.lineTo(-5,5);radar.closePath();
    radar.fillStyle='#ffe36a';radar.fill();radar.strokeStyle='#18251d';radar.lineWidth=2;radar.stroke();radar.restore();
  }
  try {
    const data=AirAttackPak.unpackScene(globalThis.AlpineScene);
    height=data.ground.heights;
    ground=upload(data.ground);
    ship=upload(data.ship);
    // A mipmapped repeat adds nearby surface detail without flickering at distance.
    const detail=gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,detail);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,64,64,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,Uint8Array.from(atob(AlpineMaterials.detail),c=>c.charCodeAt(0)));
    gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.uniform1i(loc('detailMap'),1);gl.activeTexture(gl.TEXTURE0);
    const map=data.ground.texture;
    chart.width=map.w;chart.height=map.h;
    chart.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(map.rgba),map.w,map.h),0,0);
    // The blade is on the right edge of ROTOR0.TIM. Rotate a narrow strip
    // around the mast instead of drawing the entire atlas as one billboard.
    const blades=[],indices=[];
    for(let arm=0;arm<4;arm++){
      const r=arm*Math.PI/2,s=Math.sin(r),c=Math.cos(r);
      for(const [across,along,u,v] of [[-.14,0,.90,.93],[.14,0,.975,.93],[-.19,5.1,.90,.05],[.12,5.1,.975,.05]]){
        blades.push(across*c+along*s,0,along*c-across*s,u,v);
      }
      const n=4*arm;indices.push(n,n+1,n+2,n+2,n+1,n+3);
    }
    rotor=upload({vertices:new Float32Array(blades),indices:new Uint16Array(indices),
      texture:{w:32,h:32,rgba:Uint8Array.from(atob(AlpineMaterials.rotor),c=>c.charCodeAt(0))}});
    status.textContent='';
  } catch(e) {
    status.textContent='No se pudo iniciar el vuelo. Recarga la página. '+e.message;
    return;
  }
  function frame(time){
    requestAnimationFrame(frame);const dt=Math.min((time-last)/1000,0.05);last=time;if(!ship)return;
    const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio,2);
    const w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);gl.uniform1f(aspect,w/h);
    yaw+=(keys.has('KeyA')-keys.has('KeyD'))*dt*2.2;
    let forward=keys.has('KeyW')-keys.has('KeyS'),side=keys.has('KeyE')-keys.has('KeyQ');
    if(mouse){const sx=(2*(mouse[0]-rect.left)/rect.width-1)*w/h/2.246,sy=(1-2*(mouse[1]-rect.top)/rect.height)/2.246;
      const length=Math.hypot(22,28),ry=(-22+28*sy)/length,rz=(-28-22*sy)/length;
      if(ry<0){const t=-22/ry,mx=t*sx,mz=28+t*rz;if(Math.hypot(mx,mz)>1){const d=Math.atan2(-mx,-mz)-yaw;yaw+=clamp(Math.atan2(Math.sin(d),Math.cos(d)),-2.2*dt,2.2*dt);forward=1;}}}
    const speed=24*dt/Math.max(1,Math.hypot(forward,side));
    x=clamp(x+(side*Math.cos(yaw)-forward*Math.sin(yaw))*speed,1,511);z=clamp(z+(-side*Math.sin(yaw)-forward*Math.cos(yaw))*speed,1,511);
    const i=Math.floor(x/4)+129*Math.floor(z/4),u=x/4%1,v=z/4%1;
    const y=9+(height[i]*(1-u)+height[i+1]*u)*(1-v)+(height[i+129]*(1-u)+height[i+130]*u)*v;
    gl.uniform3f(eye,x,y+22,z+28);gl.clearColor(.46,.60,.70,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(aircraft,x,z);
    draw(ground,0,0,0,0);draw(ship,x,y,z,yaw);
    spin=(spin+dt*17)%(2*Math.PI);
    draw(rotor,x,y+.55,z,spin+yaw);
    paintRadar();
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='Se perdió la conexión gráfica. Recarga la página.';});
  requestAnimationFrame(frame);
})();
