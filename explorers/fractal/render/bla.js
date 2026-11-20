import { PHX, TYPES } from '../fractals/types.js';
import { isExt, st } from '../state.js';
import { hexRGB } from '../color/palettes.js';
import { aux, auxCv, blaTex, draw2D, gl, glc, main, makeRef, refSlots, upRef } from './webgl.js';
import { bufScale, cssH, deepT, effIter, extT, refShift, requestExtRef, viewDescs } from '../view.js';

// ---------- BLA: shortcuts that skip many steps at once while a pixel stays close to the reference ----------
const BLA_EPS=Math.pow(2,-24);

function buildBLA(slot, cmax){
  const R=slot.d64, M=slot.len-1; if (!R || M<4){ slot.bla=null; return; }
  const jul=!!slot.julia; let Ar=new Float64Array(M), Ai=new Float64Array(M), Br=new Float64Array(M), Bi=new Float64Array(M), Rr=new Float64Array(M);
  for (let m=0;m<M;m++){ const zr=R[2*m], zi=R[2*m+1]; Ar[m]=2*zr; Ai[m]=2*zi; Br[m]=jul?0:1; Rr[m]=BLA_EPS*2*Math.hypot(zr,zi); }
  const levels=[]; let n=M;
  while (n>=2 && levels.length<17){ const h=n>>1, ar=new Float64Array(h), ai=new Float64Array(h), br=new Float64Array(h), bi=new Float64Array(h), rr=new Float64Array(h);
    for (let j=0;j<h;j++){ const x=2*j, y=x+1, axr=Ar[x], axi=Ai[x], ayr=Ar[y], ayi=Ai[y];
      ar[j]=ayr*axr-ayi*axi; ai[j]=ayr*axi+ayi*axr; br[j]=ayr*Br[x]-ayi*Bi[x]+Br[y]; bi[j]=ayr*Bi[x]+ayi*Br[x]+Bi[y];
      const ax=Math.hypot(axr,axi), lim=Rr[y]-Math.hypot(Br[x],Bi[x])*cmax; rr[j]=Math.min(Rr[x], lim<=0 ? 0 : (ax>0 ? lim/ax : Infinity)); }
    Ar=ar; Ai=ai; Br=br; Bi=bi; Rr=rr; n=h; levels.push({ar,ai,br,bi,rr,n:h}); }
  const off=new Int32Array(18); let total=0; levels.forEach((lv,i)=>{ off[i+1]=total; total+=lv.n; });
  const H=Math.max(1,Math.ceil(total/1024)), ab=new Float32Array(1024*H*4), rv=new Float32Array(1024*H).fill(-1e30);
  levels.forEach((lv,i)=>{ const o=off[i+1]; for (let j=0;j<lv.n;j++){ const k=o+j, A=Math.hypot(lv.ar[j],lv.ai[j]), B=Math.hypot(lv.br[j],lv.bi[j]);
    if (!(A<1e30) || !(B<1e30) || !(lv.rr[j]>0)) continue; ab[4*k]=lv.ar[j]; ab[4*k+1]=lv.ai[j]; ab[4*k+2]=lv.br[j]; ab[4*k+3]=lv.bi[j]; rv[k]=Math.log2(lv.rr[j]); } });
  blaTex(slot,'blaAB',gl.RGBA32F,gl.RGBA,1024,H,ab); blaTex(slot,'blaRt',gl.R32F,gl.RED,1024,H,rv);
  slot.bla={L:levels.length, off, cmax, ref:slot.refId}; }
export function render2DAll(hq, strip){
  const g=gl, b=hexRGB(st.bg); g.viewport(0,0,glc.width,glc.height);
  if (strip){ g.enable(g.SCISSOR_TEST); g.scissor(0,strip[0],glc.width,strip[1]-strip[0]); } else { g.clearColor(b[0],b[1],b[2],1); g.clear(g.COLOR_BUFFER_BIT); }
  if (TYPES[st.type].cpu){ g.disable(g.SCISSOR_TEST); return; }
  for (const d of viewDescs()){
    const v=d.v, type=st.type, iter=effIter(v); let refLen=0, tex=null, ctex=null;
    let refOff=[0,0], exP=null, blaP=null; const ext=extT(type) && isExt() && d.v===st.vE, jul=d.julia||type===5, jcc=type===5?PHX:st.jc;
    if (deepT(type)){ const base=[type, type===3?Math.round(st.power):'', jul?1:0, jul?jcc.join():''].join('|'), key=base+(ext?'|x':'|s'), slot=refSlots[d.slot]; let sh=refShift(slot,v);
      if (slot.key!==key || !slot.c || (!slot.escaped && slot.maxIt<iter) || Math.hypot(sh[0],sh[1])>0.4*v.scale){
        const cap=Math.min(ext?100000:30000, Math.ceil(iter*1.5));
        if (ext){ requestExtRef(slot, key, base, v, d.julia, cap, type); if (slot.base!==base || !slot.c) continue; }   // keep using the last one until the new one arrives
        else { const ref=makeRef(jul, v, jcc, cap, type); upRef(slot.tex, ref, slot);
          Object.assign(slot, {key, base, len:ref.len, d64:ref.d64, julia:jul, c:{cx:v.cx,lx:v.lx||0,cy:v.cy,ly:v.ly||0,bx:v.bx,by:v.by}, maxIt:cap, escaped:ref.len<cap+1, refId:(slot.refId||0)+1}); } }
      refLen=slot.len; tex=slot.tex; ctex=(type===1||type===4)&&slot.aux?slot.ctex:null; refOff=refShift(slot,v);
      if (ext && v.scale<1e-25){ const E=Math.floor(Math.log2(v.scale)), k=Math.pow(2,-E); exP={M:v.scale*k, E, offS:[refOff[0]*k, refOff[1]*k]}; }
      if (type===0 && st.bla && st.cmode<=1 && v.scale<1e-9 && slot.d64){ const cmax=v.scale*Math.hypot(d.w/d.h,1)*1.05+Math.hypot(refOff[0],refOff[1]), B=slot.bla;
        if (!B || B.ref!==slot.refId || cmax>B.cmax || cmax<B.cmax/16) buildBLA(slot, cmax*2); blaP=slot.bla?slot:null; } }
    const s=bufScale, vp={x:Math.round(d.x*s), y:Math.round((cssH-d.y-d.h)*s), w:Math.round(d.w*s), h:Math.round(d.h*s)};
    const aa = hq ? (iter>2500 ? 1 : iter>1200 ? Math.min(2,st.aa) : st.aa) : 1;
    draw2D(main, vp, {cx:v.cx, cy:v.cy, scale:v.scale, rot:v.rot, c: type===5 ? PHX : st.jc, iter, type, julia:d.julia||type===5, aa, refLen, tex, ctex, refOff, ext:exP, bla:blaP, dim:d.dim});
  }
  g.disable(g.SCISSOR_TEST);
}
// keep the last picture on screen (stretched) while the sharp one is drawn strip by strip
const FSB=`#version 300 es
precision highp float; uniform sampler2D u_img; uniform vec2 u_res; out vec4 o; void main(){ o=texture(u_img, gl_FragCoord.xy/u_res); }`;
const blitTex=(()=>{ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); for (const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,k,v); return t; })();
let blitOK=false;
export function grabFrame(){ gl.bindTexture(gl.TEXTURE_2D,blitTex); gl.copyTexImage2D(gl.TEXTURE_2D,0,gl.RGB,0,0,glc.width,glc.height,0); blitOK=true; }
export function drawBlit(){ if (!blitOK) return; const P=main.prog('blit',FSB); gl.useProgram(P.p); gl.viewport(0,0,glc.width,glc.height); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,blitTex); gl.uniform1i(P.u('u_img'),0); gl.uniform2f(P.u('u_res'),glc.width,glc.height); gl.drawArrays(gl.TRIANGLES,0,3); }
export function auxRender(o, w, h){ if (auxCv.width!==w || auxCv.height!==h){ auxCv.width=w; auxCv.height=h; }
  draw2D(aux, {x:0,y:0,w,h}, Object.assign({rot:0, iter:220, aa:1, refLen:0, tex:null, c:st.jc}, o)); return auxCv; }
