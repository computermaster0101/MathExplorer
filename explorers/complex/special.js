// Special complex functions for the Complex Functions explorer: Gamma (Lanczos, with reflection), Riemann zeta (Borwein's
// accelerated eta series, with the functional equation for Re s < ½) and Weierstrass ℘ (square lattice, from theta functions
// with an exact derivative). JS versions for the pointer readout and the print; matching GLSL in SPECIAL_GLSL. Checked against
// Γ(5) = 24, Γ(½) = √π, Γ(1+i), ζ(2) = π²/6, ζ(−1) = −1/12, the zero at ½ + 14.1347i, ζ(3+4i) by direct summation, ℘(½) = 6.875186.
const { PI, exp, log, cos, sin, cosh, sinh, sqrt, atan2, hypot } = Math;
export const C = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }, s: (k, z) => [k * z[0], k * z[1]],
  exp: z => [exp(z[0]) * cos(z[1]), exp(z[0]) * sin(z[1])], log: z => [log(hypot(z[0], z[1])), atan2(z[1], z[0])],
  sin: z => [sin(z[0]) * cosh(z[1]), cos(z[0]) * sinh(z[1])], cos: z => [cos(z[0]) * cosh(z[1]), -sin(z[0]) * sinh(z[1])] };
C.pow = (a, b) => C.exp(C.mul(b, C.log(a)));
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function gammaR(z) { z = C.sub(z, [1, 0]); let x = [LG[0], 0]; for (let i = 1; i < 9; i++) x = C.add(x, C.div([LG[i], 0], C.add(z, [i, 0]))); const t = C.add(z, [7.5, 0]);
  return C.s(sqrt(2 * PI), C.mul(C.mul(C.pow(t, C.add(z, [0.5, 0])), C.exp(C.s(-1, t))), x)); }
export function gamma(z) { if (z[0] < 0.5) return C.div([PI, 0], C.mul(C.sin(C.s(PI, z)), gammaR(C.sub([1, 0], z)))); return gammaR(z); }
// Borwein's coefficients for the eta series, normalised: e_k = (d_k - d_n)/d_n
export const NZ = 24; export const EK = (() => { const n = NZ, f = k => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; }, d = []; let acc = 0;
  for (let k = 0; k <= n; k++) { acc += f(n + k - 1) * 4 ** k / (f(n - k) * f(2 * k)); d.push(n * acc); } return d.slice(0, n).map(v => (v - d[n]) / d[n]); })();
function etaR(s) { let a = [0, 0]; for (let k = 0; k < NZ; k++) { const t = C.s((k % 2 ? -1 : 1) * EK[k], C.exp(C.s(-log(k + 1), s))); a = C.add(a, t); } return C.s(-1, a); }
const zetaR = s => C.div(etaR(s), C.sub([1, 0], C.exp(C.s(log(2), C.sub([1, 0], s)))));
export function zeta(s) { if (Math.hypot(s[0], s[1]) < 1e-9) return [-0.5, 0]; if (s[0] >= 0.5) return zetaR(s); const o = C.sub([1, 0], s);
  return C.mul(C.mul(C.mul(C.exp(C.s(log(2), s)), C.exp(C.s(log(PI), C.sub(s, [1, 0])))), C.sin(C.s(PI / 2, s))), C.mul(gamma(o), zetaR(o))); }
// Weierstrass ℘ for the square lattice (periods 1 and i), from theta functions with nome e^-π; exact derivative of ζ
export function wp(z) { z = [z[0] - Math.floor(z[0] + 0.5), z[1] - Math.floor(z[1] + 0.5)]; const v = C.s(PI, z), q = exp(-PI); let t = [0, 0], t1 = [0, 0], t2 = [0, 0];
  for (let n = 0; n < 6; n++) { const c = 2 * (n % 2 ? -1 : 1) * q ** ((n + 0.5) ** 2), k = 2 * n + 1, a = C.s(k, v); t = C.add(t, C.s(c, C.sin(a))); t1 = C.add(t1, C.s(c * k, C.cos(a))); t2 = C.add(t2, C.s(-c * k * k, C.sin(a))); }
  return C.sub([-PI, 0], C.s(PI * PI, C.div(C.sub(C.mul(t2, t), C.mul(t1, t1)), C.mul(t, t)))); }

export const SPECIAL_GLSL = `
const float LG[9] = float[9](0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7);
vec2 cgammaR(vec2 z){ z-=vec2(1.0,0.0); vec2 x=vec2(LG[0],0.0); for (int i=1;i<9;i++) x+=cdiv(vec2(LG[i],0.0), z+vec2(float(i),0.0)); vec2 t=z+vec2(7.5,0.0);
  return 2.5066283*cm(cm(cexp_(cm(z+vec2(0.5,0.0), clog_(t))), cexp_(-t)), x); }
vec2 cgamma(vec2 z){ if (z.x<0.5) return cdiv(vec2(3.14159265,0.0), cm(csin_(3.14159265*z), cgammaR(vec2(1.0,0.0)-z))); return cgammaR(z); }
const float EK[24] = float[24](-1.00000000, -1.00000000, -1.00000000, -1.00000000, -0.999999999, -0.999999985, -0.999999745, -0.999996897, -0.999971878, -0.999804430, -0.998931939, -0.995336218, -0.983480762, -0.951963489, -0.884092960, -0.765514563, -0.597687881, -0.406227852, -0.231786492, -0.106724691, -0.0377803657, -0.00959406764, -0.00154935254, -0.000119180964);
vec2 czetaR(vec2 s){ vec2 a=vec2(0.0); for (int k=0;k<24;k++){ float sg = (k%2==1) ? -1.0 : 1.0; a += sg*EK[k]*cexp_(-log(float(k+1))*s); }
  return cdiv(-a, vec2(1.0,0.0)-cexp_(0.69314718*(vec2(1.0,0.0)-s))); }
vec2 czeta(vec2 s){ if (s.x>=0.5) return czetaR(s); vec2 o=vec2(1.0,0.0)-s;
  return cm(cm(cm(cexp_(0.69314718*s), cexp_(1.14472989*(s-vec2(1.0,0.0)))), csin_(1.57079633*s)), cm(cgamma(o), czetaR(o))); }
vec2 cwp(vec2 z){ z-=floor(z+0.5); vec2 v=3.14159265*z, t=vec2(0.0), t1=vec2(0.0), t2=vec2(0.0);
  for (int n=0;n<6;n++){ float k=float(2*n+1), c=2.0*((n%2==1)?-1.0:1.0)*pow(0.0432139183,(float(n)+0.5)*(float(n)+0.5)); vec2 a=k*v; t+=c*csin_(a); t1+=c*k*ccos_(a); t2-=c*k*k*csin_(a); }
  return vec2(-3.14159265,0.0)-9.8696044*cdiv(cm(t2,t)-cm(t1,t1), cm(t,t)); }`;
