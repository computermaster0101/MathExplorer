import { shared } from '../shared.js';
import { $ } from '../util.js';
import { TYPES } from '../fractals/types.js';
import { st } from '../state.js';

export function notAvail(m=st.mode){ const T=TYPES[st.type];
  if (m==='d3' && shared.f3Err) return ['The 3D shapes couldn\'t be prepared here', 'This device\'s graphics driver gave up building the 3D program. The 2D modes still work. Restarting the browser sometimes helps; a recent Chrome or Edge on a computer usually works. ('+shared.f3Err.slice(0,120)+')'];
  if (m==='orbit' && T.noOrbit) return [`Orbit isn't available for the ${T.name}`, T.cpu ? 'The Buddhabrot is already a picture of millions of orbits at once. Try it in Explore.' : T.name.startsWith('Lyapunov') ? 'Each pixel here is a pair of growth rates, not a starting point with an orbit to follow. Try it in Explore.' : `Orbit tests escape with the circle of radius 2, which doesn't fit the ${T.name}'s formula. Try it in Explore, where it's drawn properly.`];
  if (m==='link' && T.noLink) return [`Julia link isn't available for the ${T.name}`, 'It has no Julia sets to link to. Try it in Explore.'];
  if (m==='link' && (T.newton||T.juliaOnly)) return [`Julia link isn't available for the ${T.name}`, T.newton ? 'Newton\'s method has no c to choose, so there is no map of Julia sets to link to. Try it in Explore or Orbit.' : 'The Phoenix is already a Julia-style set with its constants fixed, so there is no map to link it to. Try it in Explore or Orbit.'];
  return null; }
export function showNA(){ const r=notAvail(); $('na').hidden=!r; if (r){ $('na').querySelector('.naT').textContent=r[0]; $('na').querySelector('.naB').textContent=r[1]; } return !!r; }
