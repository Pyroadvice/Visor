/* ====================================================================
   AJUSTE DE CALIBRACIÓN · compartido por visor.html y basico.html

   Resuelve la óptica a partir de marcas de altura conocida sobre una
   vertical: focal, centro óptico, inclinación frontal de la toma y, de
   las columnas de esas mismas marcas, la inclinación lateral. De ahí
   salen δ y δρ, los dos ceros del inclinómetro.

   Está fuera de las páginas por el mismo motivo que modelo.js: las dos
   versiones calibran, y si cada una llevara su copia del ajuste podrían
   dar perfiles distintos de la misma cámara.

   Contrato con la página que lo use. Debe ofrecer:
     S.calib   {puntos:[{h,y,x}], d, hCam, sensor, sensorRoll, tipo,
                camaraId, uso, capId}
     S.src     {w,h}
     perfil()  perfil activo, necesario solo para tipo "phi"
     vacio(v)  cierto si el campo está sin rellenar
     fmt(v,n)  formato numérico, para las notas
   ==================================================================== */

/* δ y δρ son desalineaciones MECÁNICAS entre el acelerómetro y el sensor
   de imagen: décimas de grado. Un valor grande no es una desalineación,
   es una calibración mal cerrada. */
const DELTA_MAX = 3.0;
const deltaRaro = p => !!p && Math.abs(+p.delta||0) > DELTA_MAX;

/* --------------------------------------------------- ajuste calibración */
function residuos(pts0, f, y0, phiDeg, d, hc){
  return pts0.map(p=>{
    const r=(+p.h-hc)/d;
    return y0 - f*Math.tan(Math.atan(r)-phiDeg*Math.PI/180) - p.y;
  });
}
const rmsDe = res => Math.sqrt(res.reduce((s,v)=>s+v*v,0)/res.length);

function ajustaSoloPhi(pts0, d, hc, f, y0){
  const J = phi => rmsDe(residuos(pts0,f,y0,phi,d,hc));
  let a=-60, b=60; const gr=(Math.sqrt(5)-1)/2;
  let c=b-gr*(b-a), e=a+gr*(b-a);
  for (let i=0;i<120;i++){
    if (J(c)<J(e)) b=e; else a=c;
    c=b-gr*(b-a); e=a+gr*(b-a);
    if (b-a<1e-7) break;
  }
  const phi=(a+b)/2;
  return {phi, res:residuos(pts0,f,y0,phi,d,hc)};
}
function resuelve3(A,b){
  const n=3, M=[[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for(let i=0;i<n;i++){
    for(let j=0;j<n;j++){ let s=0; for(let k=0;k<A.length;k++) s+=A[k][i]*A[k][j]; M[i][j]=s; }
    let s=0; for(let k=0;k<A.length;k++) s+=A[k][i]*b[k]; M[i][3]=s;
  }
  for(let c=0;c<n;c++){
    let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r;
    [M[c],M[p]]=[M[p],M[c]];
    if (Math.abs(M[c][c])<1e-12) return null;
    for(let r=0;r<n;r++){ if(r===c) continue; const k=M[r][c]/M[c][c];
      for(let j=c;j<=n;j++) M[r][j]-=k*M[c][j]; }
  }
  return [M[0][3]/M[0][0], M[1][3]/M[1][1], M[2][3]/M[2][2]];
}
/* Inclinación lateral real de la imagen, medida sobre las propias marcas.

   Las marcas de calibración están TODAS en una misma vertical de la pared. En
   la imagen deberían caer sobre una recta cuya inclinación tiene dos causas
   sumadas: la perspectiva, que es calculable, y la inclinación lateral, que no se conoce.
   Quitada la primera, lo que queda es la inclinación lateral del sensor de imagen en el
   momento de la toma, y comparado con lo que marcaba el inclinómetro da la
   DESALINEACIÓN DE BALANCEO, el equivalente lateral de δ.

   Convenio: con la imagen girada ρ, una vertical del mundo se desplaza hacia
   la izquierda al bajar por la imagen, luego pendiente dx/dy = −tan ρ.

   Lo que NO se puede hacer: dejar libre la columna del centro óptico. Sobre un
   tramo vertical corto la curva de perspectiva 1/(r·sen φ + cos φ) es casi una
   recta en y, así que si se le permite un término constante propio absorbe
   toda la inclinación y la inclinación lateral sale siempre cero. Se verificó con escena
   sintética: con ρ real de 0,75° el ajuste libre devolvía 0,000°.

   Con x₀ fijado en el centro del fotograma el sistema sí separa los dos
   efectos, y lo hace exactamente, con las marcas centradas o desviadas casi un
   metro, y con inclinaciones frontales de 0,5° o de 8°. El límite pasa a ser lo que se
   desconoce de x₀: un punto principal desplazado 30 px sobre 3000 sesga ρ en
   0,09°, y eso se calcula aquí perturbando x₀ un 1 % del ancho.             */
function ajustaRoll(pts,f,y0,x0,phi,w){
  const p=pts.filter(q=>q.x!==null&&q.x!==undefined&&isFinite(+q.x));
  if(p.length<3) return null;
  const dy=Math.max(...p.map(q=>q.y))-Math.min(...p.map(q=>q.y));
  if(dy<100) return null;
  const sp=Math.sin(phi*Math.PI/180), cp=Math.cos(phi*Math.PI/180);
  const g=q=>1/(Math.tan(Math.atan((y0-q.y)/f)+phi*Math.PI/180)*sp+cp);
  /* x − x₀ = f·A·g + s·(y − y₀) ; A tangente lateral, s pendiente del giro */
  const fit=xc=>{
    let a11=0,a12=0,a22=0,b1=0,b2=0;
    for(const q of p){
      const G=f*g(q), Y=q.y-y0, X=(+q.x)-xc;
      a11+=G*G; a12+=G*Y; a22+=Y*Y; b1+=G*X; b2+=Y*X;
    }
    const det=a11*a22-a12*a12;
    if(Math.abs(det)<1e-9) return null;
    const A=(b1*a22-a12*b2)/det, s=(a11*b2-a12*b1)/det;
    let rms=0;
    for(const q of p){ const e=((+q.x)-xc)-(f*A*g(q)+s*(q.y-y0)); rms+=e*e; }
    return {A, s, rms:Math.sqrt(rms/p.length)};
  };
  const o=fit(x0); if(!o) return null;
  const o2=fit(x0+0.01*w);
  const rho=-Math.atan(o.s)*180/Math.PI;
  /* Dos fuentes: lo que se desconoce de x₀ y el ruido al poner las cruces.
     La segunda es el error típico de la pendiente, rms/√Σ(y−ȳ)². */
  const uX0=o2 ? Math.abs(-Math.atan(o2.s)*180/Math.PI - rho) : 0;
  const ym=p.reduce((s,q)=>s+q.y,0)/p.length;
  const Syy=p.reduce((s,q)=>s+(q.y-ym)*(q.y-ym),0);
  const uN=Syy>0 ? o.rms/Math.sqrt(Syy)*180/Math.PI : 0;
  const u=Math.hypot(uX0,uN);
  /* inclinación total observada, extremo a extremo, para poder contrastar */
  const or=p.slice().sort((a,b)=>a.y-b.y);
  const pend=(or[or.length-1].x-or[0].x)/(or[or.length-1].y-or[0].y);
  return {rho, u, rms:o.rms, n:p.length, lat:o.A,
          total:-Math.atan(pend)*180/Math.PI,
          deriva:Math.max(...p.map(q=>+q.x))-Math.min(...p.map(q=>+q.x))};
}
/* Núcleo del ajuste óptico completo, aislado para poder repetirlo dejando una
   marca fuera. Devuelve null si el sistema no da un resultado físico. */
function fitFull(pts,d,hc){
  const A=[], b=[];
  for (const p of pts){ const r=(+p.h-hc)/d; A.push([1,r,p.y*r]); b.push(p.y); }
  const sol = resuelve3(A,b); if(!sol) return null;
  const [a1,b1,c1]=sol, t=-c1;
  const f=(a1*t-b1)/(1+t*t), y0=a1-f*t, phi=Math.atan(t)*180/Math.PI;
  if (!isFinite(f)||f<=0) return null;
  const res = residuos(pts,f,y0,phi,d,hc);
  return {f, y0, phi, res, rms:rmsDe(res)};
}
/* MARCA SOSPECHOSA.

   Una sola marca mal puesta no se delata por su propio residuo: el ajuste
   reparte el error entre todas y la culpable puede acabar con un residuo
   menor que su vecina. Lo que sí la delata es cuánto mejora el ajuste al
   dejarla fuera. Se repite el ajuste tantas veces como marcas haya y se
   devuelve la que más lo mejora, solo si la mejora es grande; con una
   calibración sana, quitar cualquier marca apenas cambia nada.            */
function sospechosa(pts,d,hc,tipo,f0,y00,rmsBase){
  const min = tipo==="phi" ? 3 : 4;            // uno más que el mínimo del ajuste
  const rms = sub => {
    const o = tipo==="phi" ? (()=>{ const r=ajustaSoloPhi(sub,d,hc,f0,y00);
                                    return r?{rms:rmsDe(r.res)}:null; })()
                           : fitFull(sub,d,hc);
    return o ? o.rms : null;
  };
  const sal = idx => ({idx, puntos:idx.map(i=>pts[i]), base:rmsBase,
                       i:idx[0], punto:pts[idx[0]]});   // i y punto, para una sola

  if (pts.length>=min+1){
    let mejor=null;
    for (let i=0;i<pts.length;i++){
      const r = rms(pts.filter((_,k)=>k!==i));
      if(r!==null && (!mejor || r<mejor.rms)) mejor={i, rms:r};
    }
    if(mejor && mejor.rms <= 0.5*rmsBase)
      return Object.assign(sal([mejor.i]), {rms:mejor.rms});
  }
  /* Una sola marca mala se encuentra dejando fuera una cada vez. Dos no:
     con la otra todavía dentro, el ajuste sigue siendo malo y ninguna
     parece culpable. Por eso, cuando ninguna sola explica el desastre, se
     prueban las parejas. Pasa más de lo que parece: al teclear las alturas
     de una fila de marcas es fácil saltarse una y correr las siguientes. */
  if (pts.length>=min+2){
    let mejor=null;
    for (let i=0;i<pts.length-1;i++)
      for (let j=i+1;j<pts.length;j++){
        const r = rms(pts.filter((_,k)=>k!==i&&k!==j));
        if(r!==null && (!mejor || r<mejor.rms)) mejor={i,j,rms:r};
      }
    if(mejor && mejor.rms <= 0.5*rmsBase)
      return Object.assign(sal([mejor.i,mejor.j]), {rms:mejor.rms});
  }
  return null;
}

/* Escala aparente entre marcas consecutivas, en píxeles por centímetro.

   Es el control más directo que hay y no depende del ajuste: sobre una
   pared vertical la escala cambia despacio y de forma monótona con la
   altura, así que una marca cuya escala se sale del resto delata una
   altura mal escrita o una cruz mal puesta, sin necesidad de ajustar.
   Devuelve también la mediana, que es con lo que se compara. */
function escalas(pts){
  const p = pts.filter(q=>q.y!==null && isFinite(+q.h)).slice()
               .sort((a,b)=>(+a.h)-(+b.h));
  if(p.length<2) return null;
  const e=[];
  for(let i=0;i<p.length-1;i++){
    const dh=(+p[i+1].h)-(+p[i].h), dy=p[i].y-p[i+1].y;
    e.push({de:+p[i].h, a:+p[i+1].h, dh, dy, s: dh?dy/dh:null});
  }
  const v=e.map(x=>x.s).filter(x=>x!==null&&isFinite(x)).sort((a,b)=>a-b);
  const med = v.length ? v[Math.floor(v.length/2)] : null;
  return {tramos:e, med};
}
function ajusta(){
  const pts0 = S.calib.puntos.filter(p=>p.y!==null && isFinite(+p.h));
  const min = S.calib.tipo==="phi" ? 2 : 3;
  if (pts0.length<min) return {err:"Hacen falta al menos "+min+" puntos fijados (mejor 5)."};
  const d=+S.calib.d, hc=+S.calib.hCam;
  if (!d) return {err:"Falta la distancia horizontal."};
  if (!S.src) return {err:"Carga primero la imagen."};

  if (S.calib.tipo==="phi"){
    const p=perfil(), f=p.fRel*S.src.h, y0=p.y0Rel*S.src.h;
    const o = ajustaSoloPhi(pts0,d,hc,f,y0);
    const rl = ajustaRoll(pts0,f,y0,S.src.w/2,o.phi,S.src.w);
    const rmsB=rmsDe(o.res);
    return {tipo:"phi", f, y0, phi:o.phi, res:o.res, rms:rmsB, n:pts0.length,
            sosp: sospechosa(pts0,d,hc,"phi",f,y0,rmsB), pts:pts0,
            fRel:p.fRel, y0Rel:p.y0Rel, delta: vacio(S.calib.sensor) ? null : o.phi-(+S.calib.sensor),
            roll:rl, deltaRoll: (rl && !vacio(S.calib.sensorRoll)) ? rl.rho-(+S.calib.sensorRoll) : null};
  }
  const F = fitFull(pts0,d,hc);
  if (!F) return {err:"Ajuste sin sentido físico. Revisa las alturas, que sean distintas, y la distancia."};
  const {f,y0,phi,res} = F, hImg=S.src.h;
  const rl = ajustaRoll(pts0,f,y0,S.src.w/2,phi,S.src.w);
  return {tipo:"full", f, y0, phi, rms:F.rms, res, n:pts0.length,
          sosp: sospechosa(pts0,d,hc,"full",f,y0,F.rms), pts:pts0,
          fRel:f/hImg, y0Rel:y0/hImg, delta: vacio(S.calib.sensor) ? null : phi-(+S.calib.sensor),
          roll:rl, deltaRoll: (rl && !vacio(S.calib.sensorRoll)) ? rl.rho-(+S.calib.sensorRoll) : null};
}

function registroCalib(o){
  return { fecha:new Date().toISOString(), d:+S.calib.d, hCam:+S.calib.hCam,
           sensor:vacio(S.calib.sensor)?null:+S.calib.sensor,
           sensorRoll:vacio(S.calib.sensorRoll)?null:+S.calib.sensorRoll,
           capId:S.calib.capId||"", tipo:S.calib.tipo,
           puntos:S.calib.puntos.filter(q=>q.y!==null&&isFinite(+q.h))
                  .map(q=>({h:+q.h, y:+q.y, x:(q.x===null||q.x===undefined)?null:+q.x})),
           f:o.f, y0:o.y0, phi:o.phi, rms:o.rms, res:o.res.slice(),
           rho:o.roll?o.roll.rho:null, rhoRms:o.roll?o.roll.rms:null,
           deltaRoll:(o.deltaRoll===null||o.deltaRoll===undefined)?null:o.deltaRoll };
}
