export const $ = id => document.getElementById(id);
export const lerpN = (a,b,t) => a.map((x,i)=>x+(b[i]-x)*t);
export const low = s => /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase()+s.slice(1) : s;
export const an = s => /^(8|11|18)\b|^(8|11|18)-|^[aeiou]/i.test(s) ? 'an '+s : 'a '+s;
export const clickData=(sel,attr,val)=>{ const b=document.querySelector(`${sel} [data-${attr}="${CSS.escape(val)}"]`); if (b) b.click(); };
export const setRange=(id,v,ev='input')=>{ const el=$(id); el.value=v; el.dispatchEvent(new Event(ev)); };
