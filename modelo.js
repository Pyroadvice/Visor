/* ====================================================================
   MODELO DE MEDIDA · compartido por visor.html y basico.html

   Aquí vive la física, y solo la física: cómo se convierte una fila de
   píxeles en una altura y qué incertidumbre lleva. Está fuera de las dos
   páginas a propósito: son dos herramientas para el mismo ensayo, y si
   cada una llevara su copia acabarían dando números distintos sin que
   nadie se enterara hasta tener que explicarlo en una auditoría.

   Contrato con la página que lo use. Debe ofrecer:
     S                   estado, con S.src {w,h}, S.med {d,ud,upx,uphi,hRef}
                         y S.marks {origen,puntos}
     perfil()            perfil óptico activo {fRel,y0Rel,uF}
     tiltUsado()         ángulo del eje óptico, frontal, en grados o null
     rollUsado()         ángulo del eje óptico, lateral, en grados o null
     ROLL_AVISO          umbral de aviso de inclinación lateral
   ==================================================================== */

/* Incertidumbre de la inclinación lateral una vez corregida. Con el móvil
   casi vertical la lectura sale de atan2(gx,gy) y el redondeo del
   acelerómetro a 0,1 m/s² se traduce en 0,1/9,8 rad ≈ 0,6°. Sin ninguna
   lectura (foto de un tercero sin dato) se presupuesta el límite de aviso. */
const U_ROLL = 0.6;

/* Inclinación lateral y perspectiva.

   Dos efectos distintos hacen que una vertical del mundo NO caiga sobre una
   columna de la imagen, y conviene no confundirlos:

   1) BALANCEO (ρ). Si el móvil está girado sobre su eje óptico, toda la imagen
      gira ρ. Se corrige girando las coordenadas −ρ en torno al centro óptico,
      que es lo que hace yEf: devuelve la fila que tendría el punto con la
      imagen puesta a plomo. Así la inclinación lateral deja de ser un error que haya que
      presupuestar y pasa a ser una corrección.

   2) PERSPECTIVA (convergencia de verticales). Aun a plomo perfecto, una
      vertical del mundo solo se proyecta sobre una columna constante si pasa
      por el centro óptico. Fuera de él, la columna es
          x − x₀ = f·(a/d) / (r·sen φ + cos φ)
      es decir, se separa del centro al acercarse al horizonte. Sigue siendo
      una RECTA, pero inclinada. Es el efecto de las fachadas que convergen al
      fotografiarlas desde abajo, y no es un defecto del equipo.

   Ninguno de los dos altera la FILA de un punto por sí mismo: con inclinación frontal pura
   la fila depende solo de la altura y la distancia, no de la posición lateral.
   Por eso una vertical que no cuadre no invalida las alturas medidas.        */
function geom(){
  const p = perfil(), src = S.src;
  if (!src || !p) return null;
  const f = p.fRel*src.h, y0 = p.y0Rel*src.h, x0 = src.w/2;
  const phi = (tiltUsado() ?? 0)*Math.PI/180;
  const rho = (rollUsado() ?? 0)*Math.PI/180;
  const cR = Math.cos(rho), sR = Math.sin(rho);
  /* coordenadas a plomo (u lateral, v fila) ← imagen */
  const uDe = (y,x) => ((x==null?x0:x)-x0)*cR + (y-y0)*sR;
  const vDe = (y,x) => -((x==null?x0:x)-x0)*sR + (y-y0)*cR;
  const yEf = (y,x) => y0 + vDe(y,x);
  /* imagen ← coordenadas a plomo */
  const aImgR = (u,v) => ({x: x0 + u*cR - v*sR, y: y0 + u*sR + v*cR});
  const r  = (y,x) => Math.tan(Math.atan(-vDe(y,x)/f) + phi);
  const yDe = rr => y0 - f*Math.tan(Math.atan(rr) - phi);   // fila a plomo
  return {f, y0, x0, phi, rho, cR, sR, r, yDe, yEf, uDe, vDe, aImgR};
}
function medidas(){
  const g = geom(); if (!g || S.marks.origen===null) return null;
  const p = perfil(), d = +S.med.d, yo = S.marks.origen.y, xo = S.marks.origen.x;
  const phi0 = tiltUsado() ?? 0;
  const roll = rollUsado();
  const con = (fv,y0v,phiv,dv,yov,ytv)=>{
    const rr = y => Math.tan(Math.atan((y0v-y)/fv) + phiv*Math.PI/180);
    return (rr(ytv)-rr(yov))*dv;
  };
  const yoE = g.yEf(yo,xo);
  const ro = g.r(yo,xo);
  return S.marks.puntos.map(q=>{
    if (q.y===null) return {lab:q.lab, y:null};
    const ytE = g.yEf(q.y,q.x);
    const rt = g.r(q.y,q.x), dr = rt-ro, dH = dr*d;
    const base = con(g.f,g.y0,phi0,d,yoE,ytE);
    const cDist = Math.abs(dH)*(+S.med.ud)/100;
    const cF    = Math.abs(con(g.f*(1+(+p.uF)/100),g.y0,phi0,d,yoE,ytE)-base);
    const cPhi  = Math.abs(con(g.f,g.y0,phi0+(+S.med.uphi),d,yoE,ytE)-base);
    const upx   = +S.med.upx;
    const cPo   = Math.abs(con(g.f,g.y0,phi0,d,yoE+upx,ytE)-base);
    const cPt   = Math.abs(con(g.f,g.y0,phi0,d,yoE,ytE+upx)-base);
    /* Inclinación lateral. El giro de la imagen YA se corrige en geom(), así que
       lo que queda aquí no es la inclinación lateral sino su INCERTIDUMBRE: un punto
       separado Δx del origen arrastra un error (Δx/f)·sen(u_ρ). Se anula
       exactamente cuando origen y punto quedan en la misma vertical, que
       sigue siendo la mejor práctica de campo. */
    const dx = (q.x===null||xo===null) ? null : (q.x-xo);
    const uRoll = roll===null ? U_ROLL_DESC : U_ROLL;
    const cRoll = dx===null ? 0
                : Math.abs(dx/g.f*Math.sin(uRoll*Math.PI/180))*d;
    const uc = Math.hypot(cDist,cF,cPhi,cPo,cPt,cRoll), U = 2*uc;
    return {lab:q.lab, y:q.y, x:q.x, hReal:q.hReal, dx, ro, rt, dr, dH, H:dH+(+S.med.hRef||0), uc, U,
            comp:{cDist,cF,cPhi,cPo,cPt,cRoll},
            relU: Math.abs(dH)>1e-9 ? 100*U/Math.abs(dH) : null};
  });
}
