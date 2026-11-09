(() => {
  'use strict';
  const canvas=document.querySelector('#flight'), status=document.querySelector('#status'), input=document.querySelector('#pak');
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true});
  if(!gl){status.textContent='Para volar se necesita WebGL. Activa la aceleración gráfica del navegador.';input.disabled=true;return;}
  const vertex=`attribute vec3 aPos;attribute vec2 aUV;uniform vec3 origin,eye;uniform float yaw,aspect;varying vec2 uv;
  void main(){float s=sin(yaw),c=cos(yaw);vec3 v=origin+vec3(c*aPos.x+s*aPos.z,aPos.y,-s*aPos.x+c*aPos.z)-eye;
  float depth=dot(v,normalize(vec3(0.,-22.,-28.)));float up=dot(v,normalize(vec3(0.,28.,-22.)));
  gl_Position=vec4(v.x*2.246/aspect,up*2.246,depth*1.0004-.20004,depth);uv=aUV;}`;
  const fragment='precision mediump float; varying vec2 uv; uniform sampler2D tex; void main(){gl_FragColor=texture2D(tex,uv);}';
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const program=gl.createProgram();
  try {
    gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  } catch(e){status.textContent='Error al iniciar el renderizador: '+e.message;input.disabled=true;return;}
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);
  const loc=n=>gl.getUniformLocation(program,n), pos=gl.getAttribLocation(program,'aPos'),uv=gl.getAttribLocation(program,'aUV');
  const eye=loc('eye'),angle=loc('yaw'),origin=loc('origin'),aspect=loc('aspect');
  gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(uv);
  function upload(m){
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,m.vertices,gl.STATIC_DRAW);
    let index=null;if(m.indices){index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,m.indices,gl.STATIC_DRAW);}
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
    for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,m.texture.w,m.texture.h,0,gl.RGBA,gl.UNSIGNED_BYTE,m.texture.rgba);
    return {buffer,index,texture,count:index?m.indices.length:m.vertices.length/5};
  }
  function draw(m,x,y,z,r){
    gl.uniform3f(origin,x,y,z);gl.uniform1f(angle,r);gl.bindTexture(gl.TEXTURE_2D,m.texture);
    gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,20,0);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,20,12);
    if(m.index){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.index);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);}
    else gl.drawArrays(gl.TRIANGLES,0,m.count);
  }
  let ground,ship,height,x=240,z=240,yaw=0,mouse=null,last=0,generation=0;
  const keys=new Set(),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  canvas.addEventListener('keydown',e=>{keys.add(e.code);});window.addEventListener('keyup',e=>keys.delete(e.code));
  function release(){keys.clear();mouse=null;}
  canvas.addEventListener('blur',release);window.addEventListener('blur',release);
  canvas.oncontextmenu=e=>e.preventDefault();
  canvas.onpointerdown=e=>{canvas.focus();if(e.button===2||e.pointerType==='touch'){mouse=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);}};
  canvas.onpointermove=e=>{if(mouse)mouse=[e.clientX,e.clientY];};
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>{mouse=null;};canvas.style.touchAction='none';
  input.onchange=async()=>{
    const id=++generation,f=input.files[0];if(!f)return;
    try{
      if(f.size>64000000)throw Error('Selecciona el PAK instalado, no la ISO.');
      const data=AirAttackPak.decode(new Uint8Array(await f.arrayBuffer()));if(id!==generation)return;
      for(const m of [ground,ship])if(m){gl.deleteBuffer(m.buffer);if(m.index)gl.deleteBuffer(m.index);gl.deleteTexture(m.texture);}
      height=data.ground.heights;ground=upload(data.ground);ship=upload(data.ship);x=z=240;yaw=0;release();
      status.textContent='Alpina 1 cargada · 16 641 alturas · '+data.ship.faces+' caras de fuselaje';canvas.focus();
    }catch(e){if(id===generation)status.textContent='No se pudo abrir el archivo. '+e.message;}
  };
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
    draw(ground,0,0,0,0);draw(ship,x,y,z,yaw);
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='Se perdió la conexión gráfica. Recarga la página y selecciona el PAK.';});
  requestAnimationFrame(frame);
})();
