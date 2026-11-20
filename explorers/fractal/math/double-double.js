// ---------- double-double numbers (about 32 digits) for deep zooms ----------
const twoSum=(a,b)=>{ const s=a+b, bb=s-a; return [s,(a-(s-bb))+(b-bb)]; };
const qSum=(a,b)=>{ const s=a+b; return [s, b-(s-a)]; };
const spl=a=>{ const t=134217729*a, h=t-(t-a); return [h,a-h]; };
const twoProd=(a,b)=>{ const p=a*b, [ah,al]=spl(a), [bh,bl]=spl(b); return [p,((ah*bh-p)+ah*bl+al*bh)+al*bl]; };
export const ddAdd=(a,b)=>{ const [s,e]=twoSum(a[0],b[0]); return qSum(s, e+a[1]+b[1]); };
export const ddMul=(a,b)=>{ const [p,e]=twoProd(a[0],b[0]); return qSum(p, e+a[0]*b[1]+a[1]*b[0]); };
export function ddFrom(x){ if (typeof x!=='string') return [x,0];
  const hi=Number(x), D=40, toBig=str=>{ let neg=str[0]==='-'; if (neg) str=str.slice(1); let [i,f='']=str.split('.'); f=(f+'0'.repeat(D)).slice(0,D); const v=BigInt(i+f); return neg?-v:v; };
  const diff=toBig(x)-toBig(hi.toFixed(D)); return [hi, Number(diff)/1e40]; }
