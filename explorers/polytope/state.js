// ---------- state ----------
export const BASE_R = 0.05;

export const st = { mode:'explore', edges:'straight', palette:'aurora', cmode:'body', finish:'satin', bg:'#0b0d12', shape:8, proj:'persp',
  packView:'balls',   // the Apollonian packing: 'balls' or 'net' (the touching points joined up)
  xy:0, xw:0, yw:0, zw:0, spin:true, spinStyle:'tumble', speed:0.6, turn:0, thk:0.4, conf:true, mm:80,
  hl:false, cell:0, hdA:0, cousin:true, shadow2d:true, sliceview:true, flat2d:true, sliceSpin:false, sliceFill:true, faceFill:false, knife:0, knifeU:0, sweep:true, sweepT:0,
  palRev:false, cycle:0, cycleSpeed:0, density:1, build:{t:0, playing:true}, unf:{u:0, f:0, t:0, playing:true}, ping:{start:-1, t:0, playing:true, auto:true, step:0.6, style:'stay', back:true} };
