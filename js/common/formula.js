// ---------- custom formulas: parse once, compile to the graphics card (GLSL) and to JavaScript ----------
const CF_FUNCS={sin:1,cos:1,tan:1,sinh:1,cosh:1,tanh:1,exp:1,log:1,ln:1,sqrt:1,abs:1,conj:1,re:1,im:1,arg:1,pow:2};
function cfErr(msg,pos){ const e=new Error(msg); e.pos=pos; return e; }
export function parseFormula(src, allowZ=true){
  const s=src.replace(/\*\*/g,'^').replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/[−–]/g,'-').replace(/²/g,'^2').replace(/³/g,'^3'), toks=[]; let i=0;
  while (i<s.length){ const ch=s[i];
    if (/\s/.test(ch)){ i++; continue; }
    if (/[0-9.]/.test(ch)){ const m=s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i); if (!m) throw cfErr('That number looks wrong',i); toks.push({t:'n',v:parseFloat(m[0]),p:i}); i+=m[0].length; continue; }
    if (/[a-zA-Z_]/.test(ch)){ const m=s.slice(i).match(/^[a-zA-Z_][a-zA-Z_0-9]*/); toks.push({t:'id',v:m[0].toLowerCase(),p:i}); i+=m[0].length; continue; }
    if ('+-*/^(),|'.includes(ch)){ toks.push({t:ch,p:i}); i++; continue; }
    throw cfErr(`I don't know the symbol "${ch}"`, i); }
  if (!toks.length) throw cfErr('Type a formula first', 0);
  let k=0; const peek=()=>toks[k], next=()=>toks[k++];
  const expect=t=>{ const x=next(); if (!x || x.t!==t) throw cfErr(x ? `Expected "${t}" here` : `Missing "${t}" at the end`, x?x.p:s.length); return x; };
  const startsAtom=x=>x && (x.t==='n'||x.t==='id'||x.t==='(');
  function expr(){ let a=term(); while (peek() && (peek().t==='+'||peek().t==='-')){ const op=next().t; a={k:'bin',op,a,b:term()}; } return a; }
  function term(){ let a=unary(); for(;;){ const x=peek(); if (x && (x.t==='*'||x.t==='/')){ next(); a={k:'bin',op:x.t,a,b:unary()}; } else if (startsAtom(x)) a={k:'bin',op:'*',a,b:power()}; else break; } return a; }
  function unary(){ const x=peek(); if (x && x.t==='-'){ next(); return {k:'neg',a:unary()}; } if (x && x.t==='+'){ next(); return unary(); } return power(); }
  function power(){ const a=atom(); if (peek() && peek().t==='^'){ next(); return {k:'pow',a,b:unary()}; } return a; }
  function atom(){ const x=next(); if (!x) throw cfErr('The formula ends too early', s.length);
    if (x.t==='n') return {k:'num',v:x.v};
    if (x.t==='('){ const e=expr(); expect(')'); return e; }
    if (x.t==='|'){ const e=expr(); expect('|'); return {k:'fn',f:'abs',args:[e]}; }
    if (x.t==='id'){ const n=x.v;
      if (n==='z'){ if (!allowZ) throw cfErr('The starting value can use c, but not z', x.p); return {k:'var',n}; }
      if (n==='c') return {k:'var',n}; if (n==='i') return {k:'i'}; if (n==='pi') return {k:'num',v:Math.PI}; if (n==='e') return {k:'num',v:Math.E};
      if (CF_FUNCS[n]){ if (!peek() || peek().t!=='(') throw cfErr(`Put brackets after ${n}, like ${n}(z)`, x.p); next(); const args=[expr()]; while (peek() && peek().t===','){ next(); args.push(expr()); } expect(')');
        if (args.length!==CF_FUNCS[n]) throw cfErr(`${n}( ) takes ${CF_FUNCS[n]} input${CF_FUNCS[n]>1?'s':''}`, x.p); return {k:'fn',f:n==='ln'?'log':n,args}; }
      throw cfErr(`I don't know "${n}". Use z, c, i, pi, e or a function such as sin( )`, x.p); }
    throw cfErr(`"${x.t}" can't go here`, x.p); }
  const tree=expr(); if (k<toks.length){ const x=toks[k]; throw cfErr(`"${x.t==='id'||x.t==='n'?x.v:x.t}" can't go here`, x.p); }
  return tree; }
export const usesVar=(n,v)=> n.k==='var' ? n.n===v : (n.a&&usesVar(n.a,v))||(n.b&&usesVar(n.b,v))||(n.args&&n.args.some(a=>usesVar(a,v)));
function realConst(n){ if (n.k==='num') return n.v; if (n.k==='neg'){ const r=realConst(n.a); return r===null?null:-r; } return null; }
const glf=v=>{ if (!isFinite(v)) return '0.0'; let t=Number.isInteger(v)?v.toFixed(1):String(+v.toPrecision(9)); if (!/[.e]/.test(t)) t+='.0'; return t; };
export function toGLSL(n){ switch (n.k){
  case 'num': return `vec2(${glf(n.v)},0.0)`; case 'i': return 'vec2(0.0,1.0)'; case 'var': return n.n; case 'neg': return `(-${toGLSL(n.a)})`;
  case 'bin': { const a=toGLSL(n.a), b=toGLSL(n.b); return n.op==='+'?`(${a}+${b})`:n.op==='-'?`(${a}-${b})`:n.op==='*'?`cm(${a},${b})`:`cdiv(${a},${b})`; }
  case 'pow': { const r=realConst(n.b); if (r!==null) return Number.isInteger(r)&&Math.abs(r)<=255 ? `cpowi_(${toGLSL(n.a)},${r})` : `cpowr_(${toGLSL(n.a)},${glf(r)})`; return `cpow_(${toGLSL(n.a)},${toGLSL(n.b)})`; }
  case 'fn': { const a=toGLSL(n.args[0]); switch (n.f){
    case 'abs': return `vec2(length(${a}),0.0)`; case 'conj': return `(vec2(1.0,-1.0)*${a})`; case 're': return `vec2((${a}).x,0.0)`; case 'im': return `vec2((${a}).y,0.0)`; case 'arg': return `vec2(ang(${a}),0.0)`;
    case 'pow': return `cpow_(${a},${toGLSL(n.args[1])})`; default: return `c${n.f}_(${a})`; } } } }
// the same formula as JavaScript, for orbits, steering and Endless
const J={ mul:(a,b)=>[a[0]*b[0]-a[1]*b[1], a[0]*b[1]+a[1]*b[0]], div:(a,b)=>{ const d=Math.max(b[0]*b[0]+b[1]*b[1],1e-300); return [(a[0]*b[0]+a[1]*b[1])/d, (a[1]*b[0]-a[0]*b[1])/d]; },
  exp:a=>{ const e=Math.exp(a[0]); return [e*Math.cos(a[1]), e*Math.sin(a[1])]; }, log:a=>[0.5*Math.log(Math.max(a[0]*a[0]+a[1]*a[1],1e-300)), (a[0]||a[1])?Math.atan2(a[1],a[0]):0],
  sin:a=>[Math.sin(a[0])*Math.cosh(a[1]), Math.cos(a[0])*Math.sinh(a[1])], cos:a=>[Math.cos(a[0])*Math.cosh(a[1]), -Math.sin(a[0])*Math.sinh(a[1])],
  sinh:a=>[Math.sinh(a[0])*Math.cos(a[1]), Math.cosh(a[0])*Math.sin(a[1])], cosh:a=>[Math.cosh(a[0])*Math.cos(a[1]), Math.sinh(a[0])*Math.sin(a[1])],
  sqrt:a=>{ const r=Math.hypot(a[0],a[1]); return [Math.sqrt(Math.max(0,(r+a[0])/2)), (a[1]<0?-1:1)*Math.sqrt(Math.max(0,(r-a[0])/2))]; },
  powr:(a,p)=>{ const r=Math.hypot(a[0],a[1]); if (r<1e-300) return [0,0]; const t=Math.atan2(a[1],a[0])*p, q=Math.pow(r,p); return [q*Math.cos(t), q*Math.sin(t)]; },
  powi:(a,n)=>{ let m=Math.abs(n), r=[1,0], b=a; while (m){ if (m&1) r=J.mul(r,b); b=J.mul(b,b); m>>=1; } return n<0?J.div([1,0],r):r; },
  pow:(a,w)=> (a[0]||a[1]) ? J.exp(J.mul(w,J.log(a))) : [0,0] };
J.tan=a=>J.div(J.sin(a),J.cos(a)); J.tanh=a=>J.div(J.sinh(a),J.cosh(a));
export function toJS(n){ switch (n.k){
  case 'num': { const v=[n.v,0]; return ()=>v; } case 'i': { const v=[0,1]; return ()=>v; }
  case 'var': return n.n==='z' ? (z,c)=>z : (z,c)=>c;
  case 'neg': { const f=toJS(n.a); return (z,c)=>{ const a=f(z,c); return [-a[0],-a[1]]; }; }
  case 'bin': { const f=toJS(n.a), g=toJS(n.b), op=n.op;
    if (op==='+') return (z,c)=>{ const a=f(z,c), b=g(z,c); return [a[0]+b[0],a[1]+b[1]]; }; if (op==='-') return (z,c)=>{ const a=f(z,c), b=g(z,c); return [a[0]-b[0],a[1]-b[1]]; };
    if (op==='*') return (z,c)=>J.mul(f(z,c),g(z,c)); return (z,c)=>J.div(f(z,c),g(z,c)); }
  case 'pow': { const f=toJS(n.a), r=realConst(n.b); if (r!==null) return Number.isInteger(r)&&Math.abs(r)<=255 ? (z,c)=>J.powi(f(z,c),r) : (z,c)=>J.powr(f(z,c),r); const g=toJS(n.b); return (z,c)=>J.pow(f(z,c),g(z,c)); }
  case 'fn': { const f=toJS(n.args[0]); switch (n.f){
    case 'abs': return (z,c)=>{ const a=f(z,c); return [Math.hypot(a[0],a[1]),0]; }; case 'conj': return (z,c)=>{ const a=f(z,c); return [a[0],-a[1]]; };
    case 're': return (z,c)=>[f(z,c)[0],0]; case 'im': return (z,c)=>[f(z,c)[1],0]; case 'arg': return (z,c)=>{ const a=f(z,c); return [(a[0]||a[1])?Math.atan2(a[1],a[0]):0,0]; };
    case 'pow': { const g=toJS(n.args[1]); return (z,c)=>J.pow(f(z,c),g(z,c)); } default: { const h=J[n.f]; return (z,c)=>h(f(z,c)); } } } } }

/** The complex-number GLSL that toGLSL output calls (cm, cdiv, cexp_, csin_ …). Paste it into a shader before the formula. */
export const FORMULA_GLSL=`vec2 cm(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
vec2 cdiv(vec2 a, vec2 b){ return vec2(a.x*b.x+a.y*b.y, a.y*b.x-a.x*b.y)/max(dot(b,b),1e-30); }
float ang(vec2 z){ return dot(z,z)>0.0 ? atan(z.y,z.x) : 0.0; }
vec2 cexp_(vec2 z){ return exp(z.x)*vec2(cos(z.y),sin(z.y)); }
vec2 clog_(vec2 z){ return vec2(0.5*log(max(dot(z,z),1e-37)), ang(z)); }
vec2 csin_(vec2 z){ return vec2(sin(z.x)*cosh(z.y), cos(z.x)*sinh(z.y)); }
vec2 ccos_(vec2 z){ return vec2(cos(z.x)*cosh(z.y), -sin(z.x)*sinh(z.y)); }
vec2 csinh_(vec2 z){ return vec2(sinh(z.x)*cos(z.y), cosh(z.x)*sin(z.y)); }
vec2 ccosh_(vec2 z){ return vec2(cosh(z.x)*cos(z.y), sinh(z.x)*sin(z.y)); }
vec2 ctan_(vec2 z){ return cdiv(csin_(z),ccos_(z)); }
vec2 ctanh_(vec2 z){ return cdiv(csinh_(z),ccosh_(z)); }
vec2 csqrt_(vec2 z){ float r=length(z); return vec2(sqrt(max(0.5*(r+z.x),0.0)), (z.y<0.0?-1.0:1.0)*sqrt(max(0.5*(r-z.x),0.0))); }
vec2 cpowr_(vec2 z, float p){ float r=length(z); if (r<1e-30) return vec2(0.0); float a=atan(z.y,z.x)*p; return pow(r,p)*vec2(cos(a),sin(a)); }
vec2 cpowi_(vec2 z, int n){ int m=n<0?-n:n; vec2 r=vec2(1.0,0.0), b=z; for (int k=0;k<8;k++){ if (m==0) break; if ((m&1)==1) r=cm(r,b); b=cm(b,b); m>>=1; } return n<0?cdiv(vec2(1.0,0.0),r):r; }
vec2 cpow_(vec2 z, vec2 w){ return dot(z,z)>0.0 ? cexp_(cm(w,clog_(z))) : vec2(0.0); }`;
