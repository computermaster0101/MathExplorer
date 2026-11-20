import { ddAdd } from './double-double.js';

// ---------- exact big-integer fixed point for Extreme precision (416 bits, about 125 digits) ----------
export const FIXB=416, FIXN=416n, FIX_INV=Math.pow(2,-416), _dv=new DataView(new ArrayBuffer(8));
export function dblToFix(x){ if (!x) return 0n; _dv.setFloat64(0,x); const hi=_dv.getUint32(0), lo=_dv.getUint32(4), ex=(hi>>>20)&0x7ff;
  let m=(BigInt(hi&0xfffff)<<32n)|BigInt(lo), e; if (ex===0) e=-1074; else { m|=1n<<52n; e=ex-1075; } const sh=BigInt(e)+FIXN, r= sh>=0n ? m<<sh : m>>(-sh); return (hi>>>31) ? -r : r; }
export const fixToNum=b=>Number(b)*FIX_INV;
export function strToFix(x){ if (typeof x!=='string') return dblToFix(x); let t=x.trim(), neg=false; if (t[0]==='-'){ neg=true; t=t.slice(1); } const [i,f='']=t.split('.'); const v=(BigInt(i+f)<<FIXN)/(10n**BigInt(f.length)); return neg?-v:v; }

export function centreDiff(a,b){ if (a.bx!==undefined && b.bx!==undefined) return [fixToNum(a.bx-b.bx), fixToNum(a.by-b.by)];
  const x=ddAdd([a.cx,a.lx||0],[-b.cx,-(b.lx||0)]), y=ddAdd([a.cy,a.ly||0],[-b.cy,-(b.ly||0)]); return [x[0]+x[1], y[0]+y[1]]; }
// the reference orbit with exact integers; also runs inside a background worker
export function computeRefBig(q){ const F=BigInt(q.F), S=F-60n, K=Math.pow(2,60), t=q.t||0, n=q.n||2; let zr=BigInt(q.zr), zi=BigInt(q.zi); const ar=BigInt(q.ar), ai=BigInt(q.ai), cap=q.cap, d64=new Float64Array((cap+2)*2);
  const toD=x=>Number(x>>S)/K, A=x=>x<0n?-x:x, aux=(t===1||t===4)?new Float64Array(cap+2):null, fold=()=> t===1 ? toD((zr*zi)>>F) : toD((zr*zr-zi*zi)>>F);
  d64[0]=toD(zr); d64[1]=toD(zi); if (aux) aux[0]=fold(); let len=1;
  for (let i=1;i<=cap;i++){
    if (t===3){ let pr=zr, pi=zi; for (let k=1;k<n;k++){ const a=(pr*zr-pi*zi)>>F, b=(pr*zi+pi*zr)>>F; pr=a; pi=b; } zr=pr+ar; zi=pi+ai; }
    else { const r2=(zr*zr)>>F, i2=(zi*zi)>>F, ri=(zr*zi)>>(F-1n);
      if (t===1){ zr=r2-i2+ar; zi=A(ri)+ai; } else if (t===2){ zr=r2-i2+ar; zi=ai-ri; } else if (t===4){ zr=A(r2-i2)+ar; zi=ri+ai; } else { zr=r2-i2+ar; zi=ri+ai; } } const a=toD(zr), b=toD(zi); d64[2*i]=a; d64[2*i+1]=b; if (aux) aux[i]=fold(); len=i+1; if (a*a+b*b>1e4) break; }
  return {id:q.id, d64, len, aux}; }
