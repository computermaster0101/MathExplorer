'use strict';
export const $ = id => document.getElementById(id);
export const clamp=(x,a,b)=>x<a?a:x>b?b:x, smooth=x=>x*x*(3-2*x), lerp=(a,b,t)=>a+(b-a)*t;

export const clickIn=(id, attr, val)=>{ const b=document.querySelector(`#${id} [data-${attr}="${val}"]`); if (b) b.click(); };
export const setRange=(id,val)=>{ const e=$(id); if (!e || val==null) return; e.value=val; e.dispatchEvent(new Event('input')); };
export const setCheck=(id,val)=>{ const e=$(id); if (!e || val==null || e.checked===!!val) return; e.checked=!!val; e.dispatchEvent(new Event('change')); };
