import { shared } from '../shared.js';
import { $ } from '../util.js';
import { ddAdd, ddMul } from '../math/double-double.js';
import { effDensity, st } from '../state.js';
import { flash } from '../../../js/shell/audio/react.js';
import { RAMP, hexRGB } from '../color/palettes.js';

// ---------- WebGL ----------
const VS=`#version 300 es
in vec2 a; void main(){ gl_Position=vec4(a,0.0,1.0); }`;
const FS2=`#version 300 es
precision highp float; precision highp int;
uniform vec2 u_res, u_org, u_center, u_c, u_refOff;
uniform float u_scale, u_rot, u_power, u_density, u_cycle, u_flash;
uniform int u_iter, u_type, u_julia, u_cmode, u_inside, u_aa, u_refLen, u_dim, u_seq, u_seqLen, u_ext, u_scaleE;
uniform float u_scaleM, u_bail; uniform vec2 u_refOffS;
uniform int u_blaOn, u_blaL; uniform int u_blaOff[18]; uniform sampler2D u_blaAB, u_blaR;
uniform sampler2D u_ref, u_refC;
uniform vec3 u_pal[8]; uniform int u_npal; uniform vec3 u_inC, u_bg;
out vec4 outC;
const float BAIL=1e4;
vec2 cm(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
float p2(int e){ return e<-126 ? 0.0 : (e>127 ? 1.0e38 : intBitsToFloat((e+127)<<23)); }
vec2 ldx(vec2 v, int e){ if (e>=-126) return v*p2(e); int h=e/2; return v*p2(h)*p2(e-h); }
// |c+d| - |c|, worked out without cancelling digits (the fold in the Burning Ship and Celtic)
float dabs_(float c, float d){ if (c>=0.0) return (c+d>=0.0) ? d : -(2.0*c+d); return (c+d>0.0) ? 2.0*c+d : -d; }
float scl_(float c, int e){ if (c==0.0) return 0.0; float lg=log2(abs(c))+float(e); if (lg>120.0) return sign(c)*1e36; if (lg<-120.0) return 0.0; int a=e/3, b=(e-a)/2; return c*p2(a)*p2(b)*p2(e-a-b); }
vec2 cpn_(vec2 Z, int n){ vec2 r=vec2(1.0,0.0); for (int k=0;k<12;k++){ if (k>=n) break; r=cm(r,Z); } return r; }
// (Z+d)^n − Z^n = d·Σ (Z+d)^k Z^(n−1−k): no cancellation, so tiny d keeps all its digits
vec2 pdiff_(vec2 Z, vec2 d, int n){ vec2 a=Z+d, acc=vec2(1.0,0.0), bp=vec2(1.0,0.0); for (int j=1;j<12;j++){ if (j>=n) break; bp=cm(bp,Z); acc=cm(acc,a)+bp; } return cm(d,acc); }
// one step of a pixel's difference d from the reference point Z, for each family that can dive deep
vec2 dstep_(vec2 Z, vec2 d, vec2 dc, int n, float c1){
  float X=Z.x, Y=Z.y, x=d.x, y=d.y;
  if (u_type==1) return vec2(2.0*(X*x-Y*y)+x*x-y*y, 2.0*dabs_(c1, X*y+x*Y+x*y))+dc;
  if (u_type==2){ vec2 t=2.0*cm(Z,d)+cm(d,d); return vec2(t.x,-t.y)+dc; }
  if (u_type==3) return pdiff_(Z,d,n)+dc;
  if (u_type==4) return vec2(dabs_(c1, 2.0*(X*x-Y*y)+x*x-y*y), 2.0*(X*y+x*Y+x*y))+dc;
  return 2.0*cm(Z,d)+cm(d,d)+dc; }
// the same, for a difference stored as w·2^kw (Extreme, far below what a float can hold); the d² part is far too small to matter
vec2 dstepS_(vec2 Z, vec2 w, vec2 cS, int kw, int n, float c1){
  float X=Z.x, Y=Z.y, x=w.x, y=w.y;
  if (u_type==1) return vec2(2.0*(X*x-Y*y), 2.0*dabs_(scl_(c1,-kw), X*y+x*Y))+cS;
  if (u_type==2){ vec2 t=2.0*cm(Z,w); return vec2(t.x,-t.y)+cS; }
  if (u_type==3) return float(n)*cm(cpn_(Z,n-1),w)+cS;
  if (u_type==4) return vec2(dabs_(scl_(c1,-kw), 2.0*(X*x-Y*y)), 2.0*(X*y+x*Y))+cS;
  return 2.0*cm(Z,w)+cS; }
vec2 cdiv(vec2 a, vec2 b){ return vec2(a.x*b.x+a.y*b.y, a.y*b.x-a.x*b.y)/max(dot(b,b),1e-30); }
vec2 R(int i){ return texelFetch(u_ref, ivec2(i&1023, i>>10), 0).xy; }
// the fold value (X·Y or X²−Y²) at each reference step, worked out at full precision on the CPU
float RC(int i){ return (u_type==1||u_type==4) ? texelFetch(u_refC, ivec2(i&1023, i>>10), 0).x : 0.0; }
// BLA: a table of shortcuts. Entry (l, j) jumps 2^l steps from step j*2^l as dz -> A*dz + B*dc, valid while log2|dz| < its stored radius.
vec4 BAB(int k){ return texelFetch(u_blaAB, ivec2(k&1023, k>>10), 0); }
int blaFind(int ri, float lg){ int t=0, x=ri; for (int q=0;q<17;q++){ if ((x&1)!=0) break; x>>=1; t++; }
  for (int q=0;q<17;q++){ int l=min(t,u_blaL)-q; if (l<1) break; int sz=1<<l; if (ri+sz>u_refLen-1) continue;
    int k=u_blaOff[l]+(ri>>l); if (lg<texelFetch(u_blaR, ivec2(k&1023, k>>10), 0).x) return l; }
  return 0; }
vec3 pal(float t){ t=fract(t); float s=1.0-abs(2.0*t-1.0); float x=s*float(u_npal-1); int i=min(int(x),u_npal-2); return mix(u_pal[i],u_pal[i+1],x-float(i)); }
float ang(vec2 z){ return dot(z,z)>0.0 ? atan(z.y,z.x) : 0.0; }
// complex functions for custom formulas
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
vec2 cpow_(vec2 z, vec2 w){ return dot(z,z)>0.0 ? cexp_(cm(w,clog_(z))) : vec2(0.0); }
vec2 customF(vec2 z, vec2 c){ return CUSTOM_EXPR; }
vec2 customZ0(vec2 c){ vec2 z=vec2(0.0); return CUSTOM_Z0; }
vec3 sampleAt(vec2 px){
  vec2 p=(px-0.5*u_res)/(0.5*u_res.y);
  float cr=cos(u_rot), sr=sin(u_rot);
  vec2 pr=vec2(cr*p.x-sr*p.y, sr*p.x+cr*p.y); p=pr*u_scale;
  float pix=u_scale/(0.5*u_res.y);
  if (u_type==6){
    vec2 z=u_center+p; int root=-1; float n=0.0;
    for (int i=0;i<u_iter;i++){
      vec2 z2=cm(z,z); vec2 num=cm(z2,z)-vec2(1.0,0.0); vec2 den=3.0*z2; float dd=dot(den,den);
      if (dd<1e-30) break;
      z-=vec2(num.x*den.x+num.y*den.y, num.y*den.x-num.x*den.y)/dd; n=float(i);
      vec2 a=z-vec2(1.0,0.0), b=z-vec2(-0.5,0.8660254), c=z-vec2(-0.5,-0.8660254);
      if (dot(a,a)<1e-7){root=0;break;} if (dot(b,b)<1e-7){root=1;break;} if (dot(c,c)<1e-7){root=2;break;}
    }
    if (root<0) return u_inC;
    return pal(float(root)/6.0+u_cycle)*(0.22+0.9*exp(-n*0.085/u_density));
  }
  if (u_type==9){   // Lyapunov: a across, b up
    vec2 q=u_center+p; float x=0.5, lam=0.0; int N=clamp(u_iter,60,1500);
    if (q.x<=0.0 || q.x>4.0 || q.y<=0.0 || q.y>4.0) return u_bg;   // growth rates outside 0–4: the population explodes, so there's no order or chaos to show
    for (int i=0;i<1600;i++){ if (i>=N+50) break; float r=((u_seq>>(i%u_seqLen))&1)==1 ? q.y : q.x;
      if (i>=50) lam+=log(abs(r*(1.0-2.0*x))+1e-12); x=r*x*(1.0-x); if (abs(x)>1e6){ lam=1e3*float(N); break; } }
    lam/=float(N);
    if (lam<0.0) return pal(clamp(-lam,0.0,3.0)*0.22*u_density+u_cycle)*(0.18+0.82*exp(lam*0.9));
    return mix(u_inC, pal(u_cycle+0.02)*0.3, clamp(lam*0.9,0.0,1.0));
  }
  if (u_type==7 || u_type==8){   // Magnet and Nova
    vec2 q=u_center+p, z, c; if (u_julia==1){ z=q; c=u_c; } else { c=q; z=(u_type==8)?vec2(1.0,0.0):vec2(0.0); }
    float n=0.0, dl=1.0; int mode=0;
    for (int i=0;i<u_iter;i++){ vec2 zp=z;
      if (u_type==7){ vec2 w=cdiv(cm(z,z)+c-vec2(1.0,0.0), 2.0*z+c-vec2(2.0,0.0)); z=cm(w,w);
        if (dot(z,z)>1e4){ mode=1; n=float(i); break; } vec2 d=z-vec2(1.0,0.0); if (dot(d,d)<1e-10){ mode=2; n=float(i); dl=max(length(z-zp),1e-30); break; } }
      else { vec2 z2=cm(z,z); z=z-cdiv(cm(z2,z)-vec2(1.0,0.0),3.0*z2)+c; float d=length(z-zp);
        if (d<1e-6){ mode=2; n=float(i); dl=max(d,1e-30); break; } if (dot(z,z)>1e8){ mode=1; n=float(i); break; } } }
    if (mode==0) return u_inC;
    if (mode==1){ float lz=0.5*log(dot(z,z)), nu=n+1.0-log(max(lz,1e-6))/log(2.0); return mix(u_bg, pal(sqrt(max(nu,0.0))*0.18*u_density+u_cycle), 0.18+0.82*smoothstep(1.0,9.0,nu)); }
    float nu=max(0.0, n-log2(max(log(dl)/log(1e-6),1e-6)));
    return pal(sqrt(nu)*0.2*u_density+u_cycle+0.25)*(0.3+0.7*exp(-nu*0.02));
  }
  float cLp=log(2.0);
  int pn=int(u_power+0.5);
  vec2 z=vec2(0.0), der=vec2(0.0); bool esc=false; int it=0; float trap=1e20, sa=0.0, sp=0.0; bool hasDer=(u_type==0);
  vec2 dadd=(u_julia==1)?vec2(0.0):vec2(1.0,0.0);
  if (u_refLen>0 && u_ext==1){
    // Extreme: each pixel's offset is a mantissa w with its own power-of-two exponent kw, so it never underflows.
    // Once the offset grows big enough to hold in a plain float, it carries on as usual.
    hasDer=false; vec2 R0=R(0), wc=pr*u_scaleM+u_refOffS; if (u_type==1) wc.y=-wc.y; vec2 w=(u_julia==1)?wc:vec2(0.0), wcc=(u_julia==1)?vec2(0.0):wc, dz=vec2(0.0);
    int kw=u_scaleE, ri=0, i=0; bool sc=true;
    for (int s=0;s<u_iter;s++){ if (i>=u_iter) break;
      vec2 Z=R(ri);
      if (sc){
        z=Z+ldx(w,kw);
        if (dot(z,z)>BAIL){ esc=true; it=i; break; }
        float m=max(abs(w.x),abs(w.y)); bool jumped=false;
        if (u_blaOn==1 && ri>0){ int l=blaFind(ri, log2(max(m,1e-37))+float(kw));
          if (l>0){ int e=int(ceil(log2(max(m,1e-30)))); w=ldx(w,-e); kw+=e; vec4 ab=BAB(u_blaOff[l]+(ri>>l));
            w=cm(ab.xy,w)+cm(ab.zw,ldx(wcc,u_scaleE-kw)); ri+=1<<l; i+=1<<l; jumped=true; } }
        if (!jumped){ trap=min(trap,min(abs(z.x),abs(z.y))); sp=sa; sa+=0.5+0.5*sin(4.0*ang(z)); w=dstepS_(Z,w,ldx(wcc,u_scaleE-kw),kw,pn,RC(ri)); ri++; i++; }
        m=max(abs(w.x),abs(w.y)); if (m>4.0e18){ int e=int(ceil(log2(m)))-2; w=ldx(w,-e); kw+=e; m=max(abs(w.x),abs(w.y)); }
        if (float(kw)+log2(max(m,1e-30))>-90.0){ dz=ldx(w,kw); sc=false; }
        if (ri>=u_refLen-1){ dz=R(ri)+ldx(w,kw)-R0; ri=0; sc=false; }
      } else {
        z=Z+dz;
        if (dot(z,z)>BAIL){ esc=true; it=i; break; }
        vec2 dcx=ldx(wcc,u_scaleE);
        if (u_blaOn==1 && ri>0){ int l=blaFind(ri, log2(max(max(abs(dz.x),abs(dz.y)),1e-37)));
          if (l>0){ vec4 ab=BAB(u_blaOff[l]+(ri>>l)); dz=cm(ab.xy,dz)+cm(ab.zw,dcx); ri+=1<<l; i+=1<<l; continue; } }
        trap=min(trap,min(abs(z.x),abs(z.y))); sp=sa; sa+=0.5+0.5*sin(4.0*ang(z));
        dz=dstep_(Z,dz,dcx,pn,RC(ri)); ri++; i++;
        vec2 d0=R(ri)+dz-R0; if (ri>=u_refLen-1 || dot(d0,d0)<dot(dz,dz)){ dz=d0; ri=0; }
      }
    }
  } else if (u_refLen>0){
    vec2 R0=R(0);
    vec2 po=p+u_refOff; if (u_type==1) po.y=-po.y; vec2 dp=vec2(0.0), dz=(u_julia==1)?po:vec2(0.0), dc=(u_julia==1)?vec2(0.0):po;
    der=(u_julia==1)?vec2(1.0,0.0):vec2(0.0);
    int ri=0, i=0;
    for (int s=0;s<u_iter;s++){ if (i>=u_iter) break;
      vec2 Z=R(ri); z=Z+dz;
      if (dot(z,z)>BAIL){ esc=true; it=i; break; }
      if (u_blaOn==1 && ri>0){ int l=blaFind(ri, log2(max(max(abs(dz.x),abs(dz.y)),1e-37)));
        if (l>0){ vec4 ab=BAB(u_blaOff[l]+(ri>>l)); dz=cm(ab.xy,dz)+cm(ab.zw,dc); ri+=1<<l; i+=1<<l; continue; } }
      trap=min(trap,min(abs(z.x),abs(z.y)));
      sp=sa; sa+=0.5+0.5*sin(4.0*ang(z));
      if (u_type==0) der=2.0*cm(z,der)+dadd;
      if (u_type==5){   // Phoenix remembers the step before, so it tracks two differences
        vec2 nd=dstep_(Z,dz,dc,pn,0.0)+u_c.y*dp; dp=dz; dz=nd; ri++; i++;
        if (ri>1){ vec2 d1=R(ri)+dz-R(1); if (ri>=u_refLen-1 || dot(d1,d1)<dot(dz,dz)){ dp=R(ri-1)+dp-R0; dz=d1; ri=1; } }
        continue; }
      dz=dstep_(Z,dz,dc,pn,RC(ri));
      ri++; i++;
      vec2 d0=R(ri)+dz-R0;
      if (ri>=u_refLen-1 || dot(d0,d0)<dot(dz,dz)){ dz=d0; ri=0; }   // rebase: keeps the reference orbit honest
    }
  } else {
    vec2 q=u_center+p; if (u_type==1) q.y=-q.y;
    vec2 c; if (u_julia==1 || u_type==5){ z=q; c=u_c; } else { z=(u_type==11)?customZ0(q):vec2(0.0); c=q; }
    vec2 zp=vec2(0.0), zl=z; der=(u_julia==1)?vec2(1.0,0.0):vec2(0.0); float B2=(u_type==11)?u_bail*u_bail:BAIL;
    for (int i=0;i<u_iter;i++){
      if (dot(z,z)>B2){ esc=true; it=i; break; }
      if (u_type==11 && (isnan(z.x)||isnan(z.y)||isinf(z.x)||isinf(z.y))){ esc=true; it=i; z=zl; break; }
      zl=z;
      trap=min(trap,min(abs(z.x),abs(z.y)));
      sp=sa; sa+=0.5+0.5*sin(4.0*ang(z));
      if (u_type==0){ der=2.0*cm(z,der)+dadd; z=cm(z,z)+c; }
      else if (u_type==1){ vec2 a=abs(z); z=vec2(a.x*a.x-a.y*a.y, 2.0*a.x*a.y)+c; }
      else if (u_type==2){ z=vec2(z.x*z.x-z.y*z.y, -2.0*z.x*z.y)+c; }
      else if (u_type==3){ float r=length(z); if (r<1e-20) z=c; else { float th=atan(z.y,z.x)*u_power; z=pow(r,u_power)*vec2(cos(th),sin(th))+c; } }
      else if (u_type==4){ z=vec2(abs(z.x*z.x-z.y*z.y), 2.0*z.x*z.y)+c; }
      else if (u_type==11){ z=customF(z,c); }
      else { vec2 zn=cm(z,z)+vec2(c.x,0.0)+c.y*zp; zp=z; z=zn; }
    }
    if (u_type==11 && esc){ float l1=0.5*log(max(dot(z,z),1.0001)), l0=0.5*log(max(dot(zl,zl),1.0001)); cLp=log(clamp(l1/max(l0,0.05),1.05,64.0)); }
  }
  if (!esc){
    if (u_inside==1) return pal(-log(trap+1e-12)*0.09*u_density+u_cycle)*0.6+u_inC*0.3;
    return u_inC;
  }
  float lz=0.5*log(dot(z,z));
  float lp=(u_type==3)?log(max(u_power,1.01)):(u_type==11?cLp:log(2.0));
  float nu=float(it)+1.0-log(max(lz,1e-6))/lp;
  float ts=sqrt(max(nu,0.0))*0.18*u_density+u_cycle;
  vec3 col;
  if (u_cmode==1){ float b=floor(nu); col=pal(b*0.045*u_density+u_cycle)*(0.84+0.16*mod(b,2.0)); }
  else if (u_cmode==2){ float f=fract(nu); float a1=sa/float(max(it,1)), a0=sp/float(max(it-1,1)); float s=mix(a0,a1,f); col=pal(ts)*(0.22+1.05*s*s); }
  else if (u_cmode==3){ col=pal(-log(trap+1e-12)*0.12*u_density+u_cycle)*(0.55+0.45*exp(-trap*3.0)); }
  else if (u_cmode==4 && hasDer){ float r=sqrt(dot(z,z)); float de=r*log(r)/max(length(der),1e-30); float d=de/pix;
    float g=clamp(1.0-log(1.0+d)/log(90.0),0.0,1.0); col=pal(ts)*(0.07+1.05*g)+vec3(0.28)*g*g*g; }
  else col=pal(ts);
  return mix(u_bg, col, 0.18+0.82*smoothstep(1.0, 9.0, nu));
}
void main(){
  vec2 px=gl_FragCoord.xy-u_org; vec3 c=vec3(0.0); int N=max(u_aa,1);
  for (int a=0;a<3;a++){ if (a>=N) break; for (int b=0;b<3;b++){ if (b>=N) break; c+=sampleAt(px-0.5+(vec2(float(a),float(b))+0.5)/float(N)); } }
  c/=float(N*N);
  if (u_dim==1) c=mix(u_bg,c,0.42);
  c=c*(1.0+0.35*u_flash)+0.05*u_flash;   // the music's beat flash
  outC=vec4(clamp(c,0.0,1.0),1.0);
}`;
export const FS3=`#version 300 es
precision highp float; precision highp int;
uniform vec2 u_res; uniform vec3 u_cam; uniform mat3 u_rotM; uniform float u_fov;
uniform int u_s3, u_it3, u_hq; uniform float u_power, u_boxS, u_w, u_density, u_cycle, u_bound, u_twist, u_view, u_flash;
uniform vec4 u_qc; uniform vec3 u_pal[8]; uniform int u_npal; uniform vec3 u_bg;
uniform mat4 u_r4; uniform vec2 u_rg; uniform int u_nest0, u_nestM; uniform mat3 u_rot3; uniform float u_tw, u_twS; uniform int u_cut; uniform vec4 u_cutP; uniform int u_glass;
uniform mat3 u_hN; uniform vec3 u_hC; uniform vec4 u_hE; uniform float u_hR; uniform int u_hW;
out vec4 outC;
// a point of the 3D picture, placed in 4D: the knife sits at W = u_w, turned by u_r4
vec4 to4(vec3 p){ return u_r4*vec4(p,u_w); }
vec2 cm2(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
vec3 pal(float t){ t=fract(t); float s=1.0-abs(2.0*t-1.0); float x=s*float(u_npal-1); int i=min(int(x),u_npal-2); return mix(u_pal[i],u_pal[i+1],x-float(i)); }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
vec3 rotYv(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x+s*p.z, p.y, -s*p.x+c*p.z); }
float mDE2(vec2 c, out float tr){ vec2 z=vec2(0.0), dz=vec2(0.0); tr=1e9;
  for (int i=0;i<48;i++){ if (i>=u_it3) break; dz=2.0*cm2(z,dz)+vec2(1.0,0.0); z=cm2(z,z)+c; float m=dot(z,z); tr=min(tr,m); if (m>1e4){ float r=sqrt(m); return 0.5*r*log(r)/max(length(dz),1e-30); } }
  return 0.0; }
float deBulb(vec3 p, out float trap){
  p=p.xzy; vec3 z=p; float dr=1.0, r=0.0; trap=1e9;
  for (int i=0;i<16;i++){ if (i>=u_it3) break;
    r=length(z); if (r>2.0) break; trap=min(trap,r);
    float th=acos(clamp(z.z/max(r,1e-9),-1.0,1.0))*u_power, ph=atan(z.y,z.x+1e-12)*u_power;
    dr=pow(r,u_power-1.0)*abs(u_power)*dr+1.0;
    z=pow(r,u_power)*vec3(sin(th)*cos(ph), sin(th)*sin(ph), cos(th))+p; }
  r=max(r,1e-9); return 0.5*log(r)*r/dr;
}
float deBox(vec3 p, out float trap){
  vec3 z=p; float dr=1.0; trap=1e9;
  for (int i=0;i<20;i++){ if (i>=u_it3) break;
    z=clamp(z,-1.0,1.0)*2.0-z; float r2=dot(z,z); trap=min(trap,r2);
    if (r2<0.25){ z*=4.0; dr*=4.0; } else if (r2<1.0){ z/=r2; dr/=r2; }
    z=z*u_boxS+p; dr=dr*abs(u_boxS)+1.0; }
  return length(z)/abs(dr);
}
float deMenger(vec3 p, out float trap){
  float d=sdBox(p,vec3(1.0)); float s=1.0; trap=0.0;
  for (int m=0;m<12;m++){ if (m>=u_it3) break;
    vec3 a=mod(p*s,2.0)-1.0; s*=3.0; vec3 r=abs(1.0-3.0*abs(a));
    float da=max(r.x,r.y), db=max(r.y,r.z), dc=max(r.z,r.x), c=(min(da,min(db,dc))-1.0)/s;
    if (c>d){ d=c; trap=float(m+1); } }
  return d;
}
float deTet(vec3 z, out float trap){
  int n=0; trap=1e9;
  for (int i=0;i<20;i++){ if (i>=u_it3) break;
    if (z.x+z.y<0.0) z.xy=-z.yx; if (z.x+z.z<0.0) z.xz=-z.zx; if (z.y+z.z<0.0) z.zy=-z.yz;
    z=z*2.0-vec3(1.0); trap=min(trap,dot(z,z)); n++; }
  return (length(z)-1.2)*pow(2.0,-float(n));
}
vec4 qmul(vec4 a, vec4 b){ return vec4(a.x*b.x-dot(a.yzw,b.yzw), a.x*b.yzw+b.x*a.yzw+cross(a.yzw,b.yzw)); }
float deQJ(vec3 p, out float trap){
  vec4 z=to4(p), dz=vec4(1.0,0.0,0.0,0.0); trap=1e9; float m=dot(z,z);
  for (int i=0;i<16;i++){ if (i>=u_it3) break; dz=2.0*qmul(z,dz); z=qmul(z,z)+u_qc; m=dot(z,z); trap=min(trap,m); if (m>16.0) break; }
  return 0.25*log(max(m,1e-12))*sqrt(m)/length(dz);
}
float deApo(vec3 p, out float trap){
  vec3 q=p; float s=1.0; trap=1e9;
  for (int i=0;i<20;i++){ if (i>=u_it3) break; q=-1.0+2.0*fract(0.5*q+0.5); float r2=dot(q,q); trap=min(trap,r2); float k=1.2/max(r2,1e-9); q*=k; s*=k; }
  return max(0.25*abs(q.y)/s, length(p)-1.45);
}
float deKIFS(vec3 z, out float trap){
  float ca=cos(u_twist), sa=sin(u_twist), cb=cos(u_twist*0.7), sb=sin(u_twist*0.7); int n=0; trap=1e9;
  for (int i=0;i<20;i++){ if (i>=u_it3) break;
    z=abs(z); if (z.x<z.y) z.xy=z.yx; if (z.x<z.z) z.xz=z.zx; if (z.y<z.z) z.yz=z.zy;
    z.xy=vec2(ca*z.x-sa*z.y, sa*z.x+ca*z.y); z.yz=vec2(cb*z.y-sb*z.z, sb*z.y+cb*z.z);
    z=z*2.0-vec3(1.0); trap=min(trap,dot(z,z)); n++; }
  return (length(z)-1.0)*pow(2.0,-float(n));
}
// ---- 4D shapes: each works on the 4D point to4(p); a 4D distance is a safe step inside the 3D slice too ----
float deMJ(vec3 p, out float trap){   // x, y = c and z, w = the starting z of z -> z^2 + c
  vec4 q=to4(p); vec2 c=q.xy, z=q.zw, a=vec2(1.0,0.0), b=vec2(0.0); trap=1e9; float cut=length(c)-2.0;
  for (int i=0;i<48;i++){ if (i>=u_it3) break; a=2.0*cm2(z,a); b=2.0*cm2(z,b)+vec2(1.0,0.0); z=cm2(z,z)+c; float m=dot(z,z); trap=min(trap,m);
    if (m>1e4){ float r=sqrt(m); return max(0.5*r*log(r)/max(sqrt(dot(a,a)+dot(b,b)),1e-30), cut); } }
  return max(0.0,cut); }
float deTetra(vec3 p, out float trap){   // bicomplex z^2 + c splits into two ordinary Mandelbrot sets
  vec4 q=to4(p); float t1, t2; float a=mDE2(vec2(q.x+q.w, q.y-q.z), t1), b=mDE2(vec2(q.x-q.w, q.y+q.z), t2); trap=min(t1,t2); return max(a,b)*0.70710678; }
const vec4 V5_0=vec4(1.0,1.0,1.0,-0.4472136), V5_1=vec4(1.0,-1.0,-1.0,-0.4472136), V5_2=vec4(-1.0,1.0,-1.0,-0.4472136), V5_3=vec4(-1.0,-1.0,1.0,-0.4472136), V5_4=vec4(0.0,0.0,0.0,1.7888544);
float deSier5(vec3 p, out float trap){
  vec4 z=to4(p); int n=0; trap=1e9;
  for (int i=0;i<12;i++){ if (i>=u_it3) break; vec4 v=V5_0; float bd=dot(z-V5_0,z-V5_0), d;
    d=dot(z-V5_1,z-V5_1); if (d<bd){ bd=d; v=V5_1; } d=dot(z-V5_2,z-V5_2); if (d<bd){ bd=d; v=V5_2; } d=dot(z-V5_3,z-V5_3); if (d<bd){ bd=d; v=V5_3; } d=dot(z-V5_4,z-V5_4); if (d<bd){ bd=d; v=V5_4; }
    z=2.0*z-v; trap=min(trap,dot(z,z)); n++; }
  return (length(z)-1.8)*pow(2.0,-float(n)); }
float sdBox4(vec4 q){ vec4 a=abs(q)-1.0; return length(max(a,0.0))+min(max(max(a.x,a.y),max(a.z,a.w)),0.0); }
float deMenger4(vec3 p, out float trap){
  vec4 q=to4(p); float d=sdBox4(q), s=1.0; trap=0.0;
  for (int m=0;m<10;m++){ if (m>=u_it3) break; vec4 a=mod(q*s,2.0)-1.0; s*=3.0; vec4 r=abs(1.0-3.0*abs(a));
    float mn=max(max(max(min(r.x,r.y),min(r.x,r.z)),max(min(r.x,r.w),min(r.y,r.z))),max(min(r.y,r.w),min(r.z,r.w))), c=(mn-1.0)/s;   // the second-biggest r: carve where two or more coordinates are in a middle third
    if (c>d){ d=c; trap=float(m+1); } }
  return d; }
float deKIFS4(vec3 p, out float trap){
  vec4 z=to4(p); float ca=cos(u_twist), sa=sin(u_twist), cb=cos(u_twist*0.7), sb=sin(u_twist*0.7); int n=0; trap=1e9;
  for (int i=0;i<20;i++){ if (i>=u_it3) break; z=abs(z);
    if (z.x<z.y) z.xy=z.yx; if (z.z<z.w) z.zw=z.wz; if (z.x<z.z) z.xz=z.zx; if (z.y<z.w) z.yw=z.wy; if (z.y<z.z) z.yz=z.zy;
    z.xy=vec2(ca*z.x-sa*z.y, sa*z.x+ca*z.y); z.zw=vec2(cb*z.z-sb*z.w, sb*z.z+cb*z.w);
    z=z*2.0-vec4(1.0); trap=min(trap,dot(z,z)); n++; }
  return (length(z)-1.0)*pow(2.0,-float(n)); }
// ---- spheres inside spheres, pearls, halls, flakes and sponges ----
// a hollow sphere with six round windows; layer k is half the size of layer k-1 and turned 45° about the vertical
float nestShell(vec3 q){ float sh=abs(length(q)-1.0)-0.035, h=min(length(q.yz),min(length(q.xz),length(q.xy)))-0.55; return max(sh,-h); }
float deNest(vec3 p, out float trap){
  float r=max(length(p),1e-30), kf=floor(-log2(r)), d=1e9; trap=0.0;
  for (int j=0;j<2;j++){ float k=max(kf,float(u_nest0))+float(j), sc=exp2(-k); float e=nestShell(rotYv(p,-k*0.78539816)/sc)*sc; if (e<d){ d=e; trap=fract((k+float(u_nestM))*0.23+0.5); } }
  return d; }
// Kleinian pearls: seven separate spheres (six round the middle, one small one in the centre); each turns space inside out
const vec3 KC[7]=vec3[7](vec3(1.0,0.0,0.0),vec3(-1.0,0.0,0.0),vec3(0.0,1.0,0.0),vec3(0.0,-1.0,0.0),vec3(0.0,0.0,1.0),vec3(0.0,0.0,-1.0),vec3(0.0));
const float KR[7]=float[7](0.68,0.68,0.68,0.68,0.68,0.68,0.3);
float deKlein(vec3 p, out float trap){ float ds=1.0, w=1.0; trap=0.0; int last=-1;
  for (int n=0;n<24;n++){ if (n>=u_it3) break; int hit=-1;
    for (int i=0;i<7;i++){ if (i==last) continue; vec3 v=p-KC[i]; if (dot(v,v)<KR[i]*KR[i]){ hit=i; break; } }
    if (hit<0){   // in a gap: everything deeper sits inside the child spheres (each sphere's inside-out copies of the others)
      float m=1e9; for (int a=0;a<7;a++){ if (a==last) continue; for (int b=0;b<7;b++){ if (b==a) continue; vec3 e=KC[b]-KC[a]; float q=KR[a]*KR[a]/(dot(e,e)-KR[b]*KR[b]); m=min(m, length(p-KC[a]-e*q)-abs(q)*KR[b]); } }
      trap=fract(trap); return m/ds; }
    vec3 v=p-KC[hit]; float f=KR[hit]*KR[hit]/max(dot(v,v),1e-30); p=KC[hit]+v*f; ds*=f; last=hit; trap+=(float(hit)+0.5)/7.0*w; w*=0.45; }
  float m=1e9; for (int i=0;i<7;i++) if (i!=last) m=min(m, length(p-KC[i])-KR[i]); trap=fract(trap); return m/ds; }   // the pearls at the deepest level
// Apollonian sphere packing: five balls that all touch (the outer sphere and four inside it), every gap filled with the
// biggest ball that fits, forever. A point is flipped (inverted) through five partner spheres, each crossing four of the five
// at right angles, until it lands beside one of the five. Each sphere is also kept as five numbers (co-curvature, curvature,
// curvature × centre); a flip through sphere d changes them linearly, x -> x - 2<x,d> d. So the chain of flips (M, five rows)
// gives every nearby ball's real centre and size exactly: balls smaller than rmin are left out whole, distances are exact
// (no seams between flips), and the outer sphere drops out by itself (its curvature is negative until a flip turns it into a ball).
const float SDA=0.317837245;
// The five numbers of each starting ball (co-curvature, curvature, curvature × centre): the four big balls, the middle
// ball (the outer sphere turned inside out) and the outer sphere (curvature −1: solid outside it).
const vec4 SB0=vec4(0.22474487,2.22474487,0.7071067804,0.7071067804); const float SE0=0.7071067804;
const vec4 SB1=vec4(0.22474487,2.22474487,0.7071067804,-0.7071067804); const float SE1=-0.7071067804;
const vec4 SB2=vec4(0.22474487,2.22474487,-0.7071067804,0.7071067804); const float SE2=-0.7071067804;
const vec4 SB3=vec4(0.22474487,2.22474487,-0.7071067804,-0.7071067804); const float SE3=0.7071067804;
const vec4 SB4=vec4(-0.1010205143,9.898979498,0.0,0.0); const vec4 SB5=vec4(1.0,-1.0,0.0,0.0);
// The flip chain is kept as four named rows (curvature and curvature × centre; the co-curvature row is never needed) and
// the partner sphere's numbers are chosen with ifs: arrays picked by index while the shader runs are very slow on some
// graphics cards, and this shape once took 2.8 s a frame because of it.
#define SDCAND(BA,BE) { float k=dot(r1,BA)+e1*(BE); if (k>0.0 && k*rmin<=1.0){ vec3 c=vec3(dot(r2,BA)+e2*(BE), dot(r3,BA)+e3*(BE), dot(r4,BA)+e4*(BE))/k; float e=length(p0-c)-1.0/k; if (e<best){ best=e; kb=k; } } }
float deSoddy(vec3 p, out float trap){ vec3 p0=p; float L0=length(p0); trap=0.0;
  if (L0>1.05) return L0-1.0;   // outside the whole packing
  float ds=1.0, best=1e9, kb=1.0, rmin=0.025*pow(0.55,float(u_it3-5)); int last=-1;
  vec4 r1=vec4(0.0,1.0,0.0,0.0), r2=vec4(0.0,0.0,1.0,0.0), r3=vec4(0.0,0.0,0.0,1.0), r4=vec4(0.0); float e1=0.0, e2=0.0, e3=0.0, e4=1.0;
  SDCAND(SB0,SE0) SDCAND(SB1,SE1) SDCAND(SB2,SE2) SDCAND(SB3,SE3) SDCAND(SB4,0.0)
  for (int n=0;n<48;n++){
    if (best<0.0 || ds*rmin>4.0) break;   // inside a ball, or everything deeper is too small to draw
    vec3 c=vec3(0.0); float R2=8.0, de=0.6123724357; vec4 da=vec4(0.3535533906,0.3535533906,0.6123724357,0.6123724357), ga=vec4(-0.1767766953,-0.1767766953,0.6123724357,0.6123724357); int hit=-1;
    if (last!=0 && dot(p,p)<SDA*SDA){ hit=0; R2=SDA*SDA; da=vec4(-0.317837245,3.146264372,0.0,0.0); ga=vec4(-1.573132186,0.1589186225,0.0,0.0); de=0.0; }
    else if (last!=1 && dot(p+vec3(1.732050808),p+vec3(1.732050808))<8.0){ hit=1; c=vec3(-1.732050808); da.zw=-da.zw; ga.zw=-ga.zw; de=-de; }
    else if (last!=2 && dot(p-vec3(-1.732050808,1.732050808,1.732050808),p-vec3(-1.732050808,1.732050808,1.732050808))<8.0){ hit=2; c=vec3(-1.732050808,1.732050808,1.732050808); da.z=-da.z; ga.z=-ga.z; }
    else if (last!=3 && dot(p-vec3(1.732050808,-1.732050808,1.732050808),p-vec3(1.732050808,-1.732050808,1.732050808))<8.0){ hit=3; c=vec3(1.732050808,-1.732050808,1.732050808); da.w=-da.w; ga.w=-ga.w; }
    else if (last!=4 && dot(p-vec3(1.732050808,1.732050808,-1.732050808),p-vec3(1.732050808,1.732050808,-1.732050808))<8.0){ hit=4; c=vec3(1.732050808,1.732050808,-1.732050808); de=-de; }
    if (hit<0) break;   // outside every partner sphere: beside one of the five
    vec3 v=p-c; float f=R2/max(dot(v,v),1e-30); p=c+v*f; ds*=f; last=hit;
    float s=2.0*(dot(r1,da)+e1*de); r1-=s*ga; e1-=s*de; s=2.0*(dot(r2,da)+e2*de); r2-=s*ga; e2-=s*de;
    s=2.0*(dot(r3,da)+e3*de); r3-=s*ga; e3-=s*de; s=2.0*(dot(r4,da)+e4*de); r4-=s*ga; e4-=s*de;
    // a flip leaves every ball it crosses at right angles where it was, so only the ball it replaces and the middle ball are new
    // (the middle partner sphere just swaps the middle ball and the outer sphere, both already seen)
    if (hit==1){ SDCAND(SB0,SE0) SDCAND(SB4,0.0) } else if (hit==2){ SDCAND(SB1,SE1) SDCAND(SB4,0.0) }
    else if (hit==3){ SDCAND(SB2,SE2) SDCAND(SB4,0.0) } else if (hit==4){ SDCAND(SB3,SE3) SDCAND(SB4,0.0) }
    else { SDCAND(SB5,0.0) } }
  trap=fract(0.3*log2(kb));   // colour by size
  return max(best, L0-1.0); }
// Hyperbolic honeycomb {p,q,r} in the Poincaré ball: cells {p,q}, r of them round every edge. Four mirrors: three planes
// through the centre (u_hN, the symmetry planes of one cell) and a sphere (centre u_hC, radius u_hR) that meets the ball's
// edge at right angles: one face of the central cell. Folding a point with them until it stops moving brings it into the
// central cell; there, an edge is the circle u_hE where the face sphere meets the third plane. Every flip through the sphere
// shrinks things (ds), so cells get smaller towards the rim; cells smaller than 1/dsMax of the central one aren't opened up.
float deHyp(vec3 p, out float trap){ vec3 p0=p; float ds=1.0, dsMax=4.0*pow(1.5,float(u_it3-5)); int inv=0;
  for (int n=0;n<64;n++){ bool moved=false;
    for (int j=0;j<3;j++){ float d=dot(p,u_hN[j]); if (d<0.0){ p-=2.0*d*u_hN[j]; moved=true; } }
    vec3 v=p-u_hC; float r2=dot(v,v);
    if (r2<u_hR*u_hR && ds<dsMax){ float f=u_hR*u_hR/r2; p=u_hC+v*f; ds*=f; inv++; moved=true; }
    if (!moved) break; }
  trap=fract(float(inv)*0.17+0.05);
  vec3 n2=u_hN[2]; float h=dot(p,n2); vec3 q=p-h*n2;
  float d=length(vec2(h, length(q-u_hE.xyz)-u_hE.w))-0.012;            // the edges, as tubes
  if (u_hW==1 && ds<2.5) d=min(d, abs(length(p-u_hC)-u_hR)-0.004);     // the walls of the middle cell and its neighbours, as thin films
  return max(d/ds, length(p0)-0.985); }
// pseudo-Kleinian (Knighty, 2011): fold into a box, invert through a ball, repeat; a round chunk of its endless halls
float dePK(vec3 p, out float trap){ const vec3 CS=vec3(0.92436,0.90756,0.92436); vec3 q=p*1.6; float df=1.0, mr=1e9;
  for (int i=0;i<20;i++){ if (i>=u_it3) break; q=2.0*clamp(q,-CS,CS)-q; float r2=dot(q,q); mr=min(mr,r2); float k=max(1.0/max(r2,1e-12),1.0); q*=k; df*=k; }
  float rxy=length(q.xy); trap=sqrt(mr); return max(max(rxy-0.92784, abs(rxy*q.z)/max(length(q),1e-12))/(df*1.6), length(p)-1.9); }
// sphereflake (Eric Haines, 1987): nine spheres a third the size on every sphere, never touching the parent's own parent
vec3 FD(int j){ if (j<6){ float a=float(j)*1.0471976; return vec3(cos(a),0.0,sin(a)); } float b=0.5235988+float(j-6)*2.0943951; return vec3(0.5*cos(b),0.8660254,0.5*sin(b)); }
float deFlake(vec3 p, out float trap){ float sc=1.0, d=length(p)-1.0, w=1.0; trap=0.0;
  for (int n=0;n<10;n++){ if (n>=u_it3) break; int bj=0; float bb=1e9, b[9];
    for (int j=0;j<9;j++){ b[j]=length(p-FD(j)*1.3333333)-0.6666667; if (b[j]<bb){ bb=b[j]; bj=j; } }
    for (int j=0;j<9;j++) if (j!=bj) d=min(d,b[j]/sc);
    if (bb/sc>d) break;
    vec3 u=FD(bj), a=abs(u.y)<0.9?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0), x=normalize(cross(a,u)), z=cross(u,x), v=p-u*1.3333333;
    p=vec3(dot(v,x),dot(v,u),dot(v,z))*3.0; sc*=3.0; d=min(d,(length(p)-1.0)/sc); trap+=(float(bj)+0.5)/9.0*w; w*=0.4; }
  trap=fract(trap); return d; }
// Jerusalem cube: 8 corner cubes (√2 − 1 the size) and 12 edge cubes ((√2 − 1)² the size), each a Jerusalem cube
float deJcube(vec3 p, out float trap){ const float K=0.41421356, K2=0.17157288; float sc=1.0, d=1e9, w=0.5; trap=0.0;
  for (int n=0;n<12;n++){ if (n>=u_it3) break;
    p=abs(p); if (p.x<p.y) p.xy=p.yx; if (p.x<p.z) p.xz=p.zx; if (p.y<p.z) p.yz=p.zy;
    vec3 ca=vec3(1.0-K), cb=vec3(1.0-K2,1.0-K2,0.0); float ba=sdBox(p-ca,vec3(K)), bb=sdBox(p-cb,vec3(K2));
    if (min(ba,bb)/sc>d) return d;
    if (ba<=bb){ d=min(d,bb/sc); p=(p-ca)/K; sc/=K; } else { d=min(d,ba/sc); p=(p-cb)/K2; sc/=K2; trap+=w; } w*=0.5; }
  return min(d, sdBox(p,vec3(1.0))/sc); }
// Mosely snowflake: cut a cube into 27, throw away the 8 corners and the middle, keep 18, repeat
float deMosely(vec3 p, out float trap){ const float T=0.33333333; float sc=1.0, d=1e9, w=0.5; trap=0.0;
  for (int n=0;n<10;n++){ if (n>=u_it3) break;
    p=abs(p); if (p.x<p.y) p.xy=p.yx; if (p.x<p.z) p.xz=p.zx; if (p.y<p.z) p.yz=p.zy;
    vec3 cf=vec3(2.0*T,0.0,0.0), ce=vec3(2.0*T,2.0*T,0.0); float bf=sdBox(p-cf,vec3(T)), be=sdBox(p-ce,vec3(T));
    if (min(bf,be)/sc>d) return d;
    if (bf<=be){ d=min(d,be/sc); p=(p-cf)*3.0; } else { d=min(d,bf/sc); p=(p-ce)*3.0; trap+=w; } sc*=3.0; w*=0.5; }
  return min(d, sdBox(p,vec3(1.0))/sc); }
float mapRaw(vec3 p, out float tr){ if (u_s3==0) return deBulb(p,tr); if (u_s3==1) return deBox(p,tr); if (u_s3==2) return deMenger(p,tr); if (u_s3==3) return deTet(p,tr); if (u_s3==4) return deQJ(p,tr); if (u_s3==5) return deApo(p,tr); if (u_s3==6) return deKIFS(p,tr);
  if (u_s3==7) return deMJ(p,tr); if (u_s3==8) return deTetra(p,tr); if (u_s3==9) return deSier5(p,tr); if (u_s3==10) return deMenger4(p,tr); if (u_s3==11) return deKIFS4(p,tr);
  if (u_s3==12) return deNest(p,tr); if (u_s3==13) return deKlein(p,tr); if (u_s3==14) return dePK(p,tr); if (u_s3==15) return deFlake(p,tr); if (u_s3==16) return deJcube(p,tr); if (u_s3==18) return deSoddy(p,tr); if (u_s3==19) return deHyp(p,tr); return deMosely(p,tr); }
// the same controls for every shape: turn it, twist it round its vertical axis, and (3D shapes) cut it with a flat knife
float map(vec3 p, out float tr){ vec3 q=u_rot3*p; bool tw=u_tw!=0.0;
  float d=mapRaw(tw ? rotYv(q,u_tw*q.y) : q, tr)*(tw ? u_twS : 1.0);   // one call: a twist stretches distances, so steps shrink to stay safe
  if (u_cut==1) d=max(d, dot(q,u_cutP.xyz)-u_cutP.w);
  return d; }
float mapD(vec3 p){ float t; return map(p,t); }
#define ZERO min(u_it3,0)
vec3 calcN(vec3 p, float e){ vec3 n=vec3(0.0); for (int i=ZERO;i<4;i++){ vec3 k=2.0*vec3(float(((i+3)>>1)&1), float((i>>1)&1), float(i&1))-1.0; n+=k*mapD(p+k*e); } return normalize(n); }
float shadowRay(vec3 ro, vec3 rd){ float L=min(u_bound,u_view), res=1.0, t=0.002*L; for (int i=ZERO;i<56;i++){ float h=mapD(ro+rd*t); res=min(res,10.0*h/t); t+=clamp(h,0.002*L,0.12*L); if (res<0.02 || t>2.5*L) break; } return clamp(res,0.0,1.0); }
float calcAO(vec3 p, vec3 n){ float o=0.0, s=1.0, u=min(u_bound,u_view)*0.04; for (int i=ZERO+1;i<=5;i++){ float h=u*float(i); o+=(h-mapD(p+n*h))*s; s*=0.6; } return clamp(1.0-1.6*o/u,0.0,1.0); }
// each shape's orbit-trap value stretched over the whole palette (ranges measured from typical views)
vec3 baseCol(vec3 p, float tr){
  float ct= u_s3==0 ? tr*0.75 : u_s3==1 ? sqrt(tr)*0.3 : u_s3==3 ? sqrt(tr)*0.16 : u_s3==4 ? sqrt(tr)*0.32 : u_s3==5 ? sqrt(tr)*0.45 : sqrt(tr)*0.14;
  vec2 rg = u_s3==0 ? vec2(0.76-0.37/u_power)+vec2(-0.5,0.5)*min(0.5,2.0/u_power) : u_s3==1 ? vec2(0.04,0.27) : u_s3==3 ? vec2(0.09,0.18) : u_s3==4 ? vec2(0.15,0.36) : u_s3==5 ? vec2(0.15,0.48) : vec2(0.199,0.24);
  if (u_s3>=7){ ct=u_s3>=12?tr:sqrt(tr); rg=u_rg; }
  float tn = (u_s3==2||u_s3==10) ? 0.6*clamp(0.5+0.5*p.y/u_bound*1.4,0.0,1.0)+0.4*clamp(tr/max(1.0,float(u_it3)),0.0,1.0) : clamp((ct-rg.x)/(rg.y-rg.x),0.0,1.0);
  return pal(tn*0.5*u_density+u_cycle); }
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  vec3 rd=normalize(u_rotM*vec3(uv,-u_fov)), ro=u_cam;
  vec3 bgc=u_bg*(1.0+0.35*(0.45-length(uv)))+vec3(0.012);
  float b=dot(ro,rd), c=dot(ro,ro)-u_bound*u_bound, h=b*b-c;
  if (h<0.0){ outC=vec4(bgc,1.0); return; }
  h=sqrt(h); float t=max(0.0,-b-h), tmax=-b+h;
  float pixA=1.0/(u_res.y*u_fov), tr=0.0; bool hit=false;
  float k=(u_s3==1)?0.7:(u_s3==0?(u_power<0.0?0.22:clamp(5.0/u_power,0.3,0.8)):(u_s3==5?0.8:(u_s3==4?0.7:0.92)));
  if (u_s3>=7) k=(u_s3==7||u_s3==8)?0.7:0.9;
  if (u_s3>=12) k=(u_s3==13||u_s3==18)?0.6:u_s3==19?0.8:(u_s3==14?0.8:(u_s3==15?0.85:0.9));
#ifdef GLASS
  if (u_glass==1){
    // See-through: every surface the ray crosses is a soap film, nearly clear face-on and bright at a slant, with a
    // thin film's rainbow sheen. Films are blended front to back and the ray carries on through, up to six crossings
    // (each ball is crossed twice, so it reads as a bubble). Marching on |distance| also finds the way out of a solid.
    vec3 acc=vec3(0.0); float A=0.0; vec3 L=normalize(u_rotM*vec3(0.35,0.75,0.55));
    for (int layer=0;layer<6;layer++){
      float t0=t; hit=false;
      for (int i=0;i<300;i++){ float d=abs(map(ro+rd*t,tr)); if (d<pixA*t*0.8 && t>t0){ hit=true; break; } t+=max(d*k, pixA*t*0.25); if (t>tmax) break; }
      if (!hit) break;
      vec3 p=ro+rd*t, n=calcN(p,max(pixA*t*0.5,1e-6)), nf=dot(n,rd)<0.0?n:-n;
      float c=abs(dot(n,rd)), fr=pow(1.0-c,2.5), th=1.15/max(c,0.12)+0.35*dot(n,u_rotM*vec3(0.3,0.8,0.2));
      vec3 film=0.55+0.45*cos(6.2831*(th+vec3(0.0,0.33,0.67)));
      float sp=pow(max(dot(nf,normalize(L-rd)),0.0),90.0);
      vec3 col=mix(baseCol(p,tr), film, 0.5)*(0.25+1.1*fr)*(1.0+0.4*u_flash)+vec3(sp);
      float a=clamp(0.07+0.8*fr+sp,0.0,1.0);
      acc+=(1.0-A)*a*col; A+=(1.0-A)*a; if (A>0.97) break;
      t+=pixA*t*3.0; }   // step through the film before looking for the next one
    outC=vec4(clamp(acc+(1.0-A)*bgc,0.0,1.0),1.0); return; }
#endif
  for (int i=0;i<500;i++){ float d=map(ro+rd*t,tr); if (d<pixA*t*0.8){ hit=true; break; } t+=d*k; if (t>tmax) break; }
  if (!hit){ outC=vec4(bgc,1.0); return; }
  vec3 p=ro+rd*t, n=calcN(p,max(pixA*t*0.5,1e-6));
  vec3 base=baseCol(p,tr);
  vec3 L=normalize(u_rotM*vec3(0.55,0.7,0.5));
  float dif=clamp(dot(n,L),0.0,1.0), sh=(u_hq==1 && dif>0.0)?shadowRay(p+n*pixA*t*3.0,L):1.0, ao=calcAO(p,n);
  float spec=pow(clamp(dot(n,normalize(L-rd)),0.0,1.0),40.0)*dif*sh, sky=0.5+0.5*dot(n,u_rotM*vec3(0.0,1.0,0.0));
  float fres=pow(1.0-clamp(dot(n,-rd),0.0,1.0),3.0);
  float lit=(0.38+0.22*sky)*mix(0.6,1.0,ao) + 0.8*dif*sh*mix(0.75,1.0,ao);
  vec3 col=(base*lit + vec3(spec*0.35) + fres*0.3*ao*base)*(1.0+0.4*u_flash) + fres*0.3*u_flash*base;   // beat flash: brighter, with a glow at the rim
  outC=vec4(clamp(col,0.0,1.0),1.0);
}`;
// The 3D program is put together per shape: the shared header, that one shape's code (with the constants and helpers just
// above it), a mapRaw that calls it, and the shared drawing code; the see-through part only when it's on. One program with
// every shape in it took the graphics card a long time to build (Windows' shader compiler is slow on long loops), and could
// fail outright. FS3 itself is never compiled; it's the source the pieces are cut from.
const DE3=['deBulb','deBox','deMenger','deTet','deQJ','deApo','deKIFS','deMJ','deTetra','deSier5','deMenger4','deKIFS4','deNest','deKlein','dePK','deFlake','deJcube','deMosely','deSoddy','deHyp'];   // in SH3's order
const FS3P=(()=>{ const a=FS3.indexOf('float deBulb('), z=FS3.indexOf('float mapRaw('), head=FS3.slice(0,a).replace('#version 300 es\n',''), tail=FS3.slice(FS3.indexOf('// the same controls for every shape'));
  const body=FS3.slice(a,z), ends=[], starts=DE3.map(n=>body.indexOf('float '+n+'('));
  if (starts.some(i=>i<0)) throw new Error('3D shader: a shape function is missing');
  // where each function ends: its closing brace (skipping // comments), then the rest of that line
  const endOf=i=>{ let d=0, j=body.indexOf('{',i); for (;j<body.length;j++){ const ch=body[j]; if (ch==='/' && body[j+1]==='/'){ j=body.indexOf('\n',j); continue; } if (ch==='{') d++; else if (ch==='}' && --d===0) break; } const nl=body.indexOf('\n',j); return nl<0 ? body.length : nl+1; };
  const order=DE3.map((n,k)=>({n,k,s:starts[k]})).sort((x,y)=>x.s-y.s), chunks={}; let prev=0;
  for (const o of order){ const e=endOf(o.s); chunks[o.n]=body.slice(prev,e); prev=e; }
  return {head, tail, chunks}; })();
const fs3Cache={};
/** The 3D fragment shader for one shape (its index in SH3), with or without the see-through part. */
export function fs3For(i, glass){ const k=i+(glass?'g':''); if (fs3Cache[k]) return fs3Cache[k]; const n=DE3[i]||'deBulb';
  return fs3Cache[k]='#version 300 es\n'+(glass?'#define GLASS\n':'')+FS3P.head+FS3P.chunks[n]+'float mapRaw(vec3 p, out float tr){ return '+n+'(p,tr); }\n'+FS3P.tail; }
function mkCtx(cv){
  const g=cv.getContext('webgl2',{antialias:false, preserveDrawingBuffer:true, alpha:false}); if (!g) return null;
  const buf=g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER,buf); g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);
  g.enableVertexAttribArray(0); g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);
  const C={g, progs:{}};
  C.prog=(name,fs)=>{ if (C.progs[name]) return C.progs[name];
    const p=g.createProgram();
    for (const [t,s] of [[g.VERTEX_SHADER,VS],[g.FRAGMENT_SHADER,fs]]){ const sh=g.createShader(t); g.shaderSource(sh,s); g.compileShader(sh);
      if (!g.getShaderParameter(sh,g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(sh)); g.attachShader(p,sh); }
    g.bindAttribLocation(p,0,'a'); g.linkProgram(p); if (!g.getProgramParameter(p,g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
    const loc={}; return C.progs[name]={p, u:n=> n in loc ? loc[n] : (loc[n]=g.getUniformLocation(p,n))}; };
  // build a program in the background where the browser can (KHR_parallel_shader_compile): returns null until it's ready
  C.pcs=g.getExtension('KHR_parallel_shader_compile'); C.pend={};
  C.progAsync=(name,fs)=>{ if (C.progs[name]) return C.progs[name]; let Q=C.pend[name];
    if (!Q){ const p=g.createProgram(), shs=[]; for (const [t,src] of [[g.VERTEX_SHADER,VS],[g.FRAGMENT_SHADER,fs]]){ const sh=g.createShader(t); g.shaderSource(sh,src); g.compileShader(sh); g.attachShader(p,sh); shs.push(sh); }
      g.bindAttribLocation(p,0,'a'); g.linkProgram(p); Q=C.pend[name]={p, shs, t0:performance.now()}; if (C.pcs) return null; }
    if (C.pcs && !g.getProgramParameter(Q.p, C.pcs.COMPLETION_STATUS_KHR)) return null;
    delete C.pend[name]; for (const sh of Q.shs){ g.detachShader(Q.p,sh); g.deleteShader(sh); }
    if (!g.getProgramParameter(Q.p, g.LINK_STATUS)){ const log=Q.shs.map(sh=>g.getShaderInfoLog(sh)).join(' ')+' '+g.getProgramInfoLog(Q.p); throw new Error(log.trim()||'the graphics driver gave up building it'); }
    const loc={}; return C.progs[name]={p:Q.p, u:n=> n in loc ? loc[n] : (loc[n]=g.getUniformLocation(Q.p,n)), ms:Math.round(performance.now()-Q.t0)}; };
  C.drop=name=>{ const P=C.progs[name]; if (P){ g.deleteProgram(P.p); delete C.progs[name]; } const Q=C.pend[name]; if (Q){ g.deleteProgram(Q.p); delete C.pend[name]; } };
  C.newTex=()=>{ const t=g.createTexture(); g.bindTexture(g.TEXTURE_2D,t);
    for (const [k,v] of [[g.TEXTURE_MIN_FILTER,g.NEAREST],[g.TEXTURE_MAG_FILTER,g.NEAREST],[g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE],[g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D,k,v);
    g.texImage2D(g.TEXTURE_2D,0,g.RG32F,1,1,0,g.RG,g.FLOAT,new Float32Array(2)); return t; };
  C.dummy=C.newTex();
  C.dummyR=g.createTexture(); g.bindTexture(g.TEXTURE_2D,C.dummyR); for (const k of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER]) g.texParameteri(g.TEXTURE_2D,k,g.NEAREST); g.texImage2D(g.TEXTURE_2D,0,g.R32F,1,1,0,g.RED,g.FLOAT,new Float32Array(1));
  return C;
}
export const glc=$('gl'), ovc=$('ov'), octx=ovc.getContext('2d');
export const main=mkCtx(glc);
export const auxCv=document.createElement('canvas'); auxCv.width=auxCv.height=8; export const aux=main ? mkCtx(auxCv) : null;
if (!main){ $('na').hidden=false; $('na').querySelector('.naT').textContent='This needs WebGL 2';
  $('na').querySelector('.naB').textContent='Your browser or device didn\'t give this page a WebGL 2 context, which the fractals are drawn with. Try a recent Chrome, Edge, Firefox or Safari.'; throw Object.assign(new Error('WebGL 2 is not available'), {shown:true}); }
export const gl=main.g;
export const F2SRC_BASE=FS2; shared.F2KEY = 'f2:default'; shared.F2SRC = FS2.replace('CUSTOM_EXPR','(cpowi_(z,3)+csin_(z)+c)').replace('CUSTOM_Z0','vec2(0.0,0.0)');
try { main.prog(shared.F2KEY,shared.F2SRC); aux.prog(shared.F2KEY,shared.F2SRC); }
catch(e){ $('na').hidden=false; $('na').querySelector('.naT').textContent='The graphics shader didn\'t compile'; $('na').querySelector('.naB').textContent=String(e.message||e).slice(0,300); throw Object.assign(new Error('Shader did not compile'), {shown:true, cause:e}); }
export let ctxLost=false;
glc.addEventListener('webglcontextlost', e=>{ e.preventDefault(); ctxLost=true; $('na').hidden=false; $('na').querySelector('.naT').textContent='The graphics card took a break';
  $('na').querySelector('.naB').textContent='That last picture was too heavy for this device, so the browser reset the graphics. Reload the page and try fewer iterations or less smoothing.'; });

export function setPal(g,P){ const arr=new Float32Array(24); RAMP.slice(0,8).forEach((c,i)=>arr.set(c,i*3)); g.uniform3fv(P.u('u_pal'),arr); g.uniform1i(P.u('u_npal'),Math.min(8,RAMP.length)); }
export const isLight=()=>st.bg==='#f3efe6';
const insideCol=()=> isLight() ? [0.11,0.12,0.16] : (st.bg==='#000000' ? [0,0,0] : [0.012,0.016,0.024]);
export function draw2D(C, vp, o){
  const g=C.g, P=C.prog(shared.F2KEY,shared.F2SRC); g.useProgram(P.p); g.viewport(vp.x,vp.y,vp.w,vp.h);
  g.uniform1f(P.u('u_bail'), st.custom.bail);
  g.uniform2f(P.u('u_res'),vp.w,vp.h); g.uniform2f(P.u('u_org'),vp.x,vp.y);
  g.uniform2f(P.u('u_center'),o.cx,o.cy); g.uniform1f(P.u('u_scale'),o.scale); g.uniform1f(P.u('u_rot'),o.rot);
  g.uniform2f(P.u('u_c'),o.c[0],o.c[1]); g.uniform1f(P.u('u_power'),o.power!=null?o.power:st.power);
  g.uniform1i(P.u('u_iter'),o.iter); g.uniform1i(P.u('u_type'),o.type); g.uniform1i(P.u('u_julia'),o.julia?1:0);
  g.uniform1i(P.u('u_cmode'),st.cmode); g.uniform1i(P.u('u_inside'),st.inside); g.uniform1i(P.u('u_aa'),o.aa||1);
  const ex=o.ext; g.uniform1i(P.u('u_ext'),ex?1:0); if (ex){ g.uniform1f(P.u('u_scaleM'),ex.M); g.uniform1i(P.u('u_scaleE'),ex.E); g.uniform2f(P.u('u_refOffS'),ex.offS[0],ex.offS[1]); }
  g.uniform2f(P.u('u_refOff'),(o.refOff||[0,0])[0],(o.refOff||[0,0])[1]); g.uniform1i(P.u('u_refLen'),o.refLen||0); g.uniform1i(P.u('u_dim'),o.dim?1:0);
  g.uniform1f(P.u('u_density'),effDensity()); g.uniform1f(P.u('u_cycle'),st.cycle); g.uniform1f(P.u('u_flash'),flash());
  const sq=st.lyaSeq; let bits=0; for (let i=0;i<sq.length;i++) if (sq[i]==='B') bits|=1<<i; g.uniform1i(P.u('u_seq'),bits); g.uniform1i(P.u('u_seqLen'),sq.length);
  setPal(g,P); g.uniform3fv(P.u('u_inC'),insideCol()); g.uniform3fv(P.u('u_bg'),hexRGB(st.bg));
  g.activeTexture(g.TEXTURE3); g.bindTexture(g.TEXTURE_2D,o.ctex||C.dummyR); g.uniform1i(P.u('u_refC'),3);
  g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D,o.tex||C.dummy); g.uniform1i(P.u('u_ref'),0);
  const BS=o.bla; g.uniform1i(P.u('u_blaOn'), BS?1:0);
  if (BS){ g.uniform1i(P.u('u_blaL'), BS.bla.L); g.uniform1iv(P.u('u_blaOff'), BS.bla.off);
    g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, BS.blaAB); g.uniform1i(P.u('u_blaAB'),1);
    g.activeTexture(g.TEXTURE2); g.bindTexture(g.TEXTURE_2D, BS.blaRt); g.uniform1i(P.u('u_blaR'),2); g.activeTexture(g.TEXTURE0); }
  g.drawArrays(g.TRIANGLES,0,3);
}
// reference orbit for perturbation (full double precision, on the CPU)
export const REF_W=1024, refSlots=[{tex:main.newTex(),key:'',len:0},{tex:main.newTex(),key:'',len:0}];
const ddNeg=a=>[-a[0],-a[1]], ddAbs=a=>a[0]<0?ddNeg(a):a;
export function makeRef(julia, v, jc, maxIt, type=0){
  const out=new Float32Array((maxIt+2)*2), d64=new Float64Array((maxIt+2)*2), C=[[v.cx,v.lx||0], type===1?ddNeg([v.cy,v.ly||0]):[v.cy,v.ly||0]], n=Math.round(st.power);
  let zr=julia?C[0]:[0,0], zi=julia?C[1]:[0,0], pr=[0,0], pi=[0,0]; const ar=julia?[jc[0],0]:C[0], ai=julia?[jc[1],0]:C[1]; let len=1;
  const aux=(type===1||type===4)?new Float64Array(maxIt+2):null, fold=()=> type===1 ? ddMul(zr,zi)[0] : ddAdd(ddMul(zr,zr),ddNeg(ddMul(zi,zi)))[0];
  out[0]=d64[0]=zr[0]; out[1]=d64[1]=zi[0]; if (aux) aux[0]=fold();
  for (let i=1;i<=maxIt;i++){
    if (type===3){ let qr=zr, qi=zi; for (let k=1;k<n;k++){ const a=ddAdd(ddMul(qr,zr),ddNeg(ddMul(qi,zi))), b=ddAdd(ddMul(qr,zi),ddMul(qi,zr)); qr=a; qi=b; } zr=ddAdd(qr,ar); zi=ddAdd(qi,ai); }
    else { const r2=ddMul(zr,zr), i2=ddMul(zi,zi), ri=ddMul(zr,zi), re=ddAdd(r2,ddNeg(i2)), im=[2*ri[0],2*ri[1]];
      if (type===5){ const nr=ddAdd(ddAdd(re,ar),ddMul(pr,[jc[1],0])), ni=ddAdd(im,ddMul(pi,[jc[1],0])); pr=zr; pi=zi; zr=nr; zi=ni; }   // Phoenix: z² + p + q·(previous z)
      else { zr=ddAdd(type===4?ddAbs(re):re, ar); zi=ddAdd(type===1?ddAbs(im):type===2?ddNeg(im):im, ai); } }
    if (aux) aux[i]=fold();
    out[2*i]=d64[2*i]=zr[0]; out[2*i+1]=d64[2*i+1]=zi[0]; len=i+1; if (zr[0]*zr[0]+zi[0]*zi[0]>1e4) break; }
  return {data:out, d64, len, aux};
}
export function upRef(tex, ref, slot){ const h=Math.ceil(ref.len/REF_W), buf=new Float32Array(REF_W*h*2); buf.set(ref.data.subarray(0,ref.len*2));
  gl.bindTexture(gl.TEXTURE_2D,tex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RG32F,REF_W,h,0,gl.RG,gl.FLOAT,buf);
  if (slot){ slot.aux=ref.aux||null; if (ref.aux){ const cb=new Float32Array(REF_W*h); cb.set(ref.aux.subarray(0,ref.len)); blaTex(slot,'ctex',gl.R32F,gl.RED,REF_W,h,cb); } } }

export function blaTex(slot, key, ifmt, fmt, w, h, data){ let t=slot[key]; if (!t){ t=slot[key]=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); for (const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,k,v); }
  gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,ifmt,w,h,0,fmt,gl.FLOAT,data); return t; }
