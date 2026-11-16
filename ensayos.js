/* ====================================================================
   CONFIGURACIONES DE ENSAYO · compartidas por visor.html y basico.html

   Una configuración guarda lo que define el control de un artículo o de
   una familia: su altura declarada y la tolerancia admitida, las líneas
   de referencia que deben verse en pantalla, y la distancia de
   observación si el ensayo la tiene fijada.

   Dos formas de usarlas, que caben en la misma estructura porque los
   campos son opcionales:

   · Familia. «Voladores F3»: lleva oblicuas y alturas de referencia, y
     no lleva altura declarada, porque lo que se controla es la
     desviación y la altura de explosión, no una cifra nominal.
   · Artículo. «Fuente 5,5 m ±20 %», «Carcasa 105 m ±30 %»: lleva altura
     declarada y tolerancia, y puede llevar o no líneas.

   Los valores de una configuración son los que escriba quien la crea.
   Esto no comprueba que correspondan a ninguna norma, y una
   configuración guardada no acredita por sí sola ningún criterio.
   ==================================================================== */

const ENS_KEY = "vpd.ensayos";

function ensayosLee(){
  try{ const a=JSON.parse(localStorage.getItem(ENS_KEY)||"[]"); return Array.isArray(a)?a:[]; }
  catch(e){ return []; }
}
function ensayosGuarda(a){
  try{ localStorage.setItem(ENS_KEY, JSON.stringify(a)); }catch(e){}
}
function ensayoPorId(id){ return ensayosLee().find(e=>e.id===id) || null; }

/* Distancia de observación.

   La EN 16261-3, 6.10.3, pide que el ángulo vertical no pase de 60° y
   señala como óptimo el entorno de 30° a 50°. Se sugiere el centro de
   ese intervalo, 40°, que para 105 m de altura da unos 125 m de
   distancia. Es una sugerencia de encuadre: la distancia que se escribe
   en el ensayo tiene que medirse, no heredarse de aquí.

   El segundo límite es el encuadre: para ver a la vez el punto de
   disparo y el punto más alto, el ángulo que abarcan no puede pasar del
   campo de visión vertical del objetivo, que sale de su focal. */
const ANG_OPT = 40, ANG_MAX = 60;
const gr = a => a*Math.PI/180;

function distanciaSugerida(e){
  if(!e) return null;
  if(e.d!==null && e.d!==undefined && isFinite(+e.d) && +e.d>0) return {d:+e.d, origen:"escrita"};
  const H=+e.hNom;
  if(!isFinite(H) || H<=0) return null;
  /* Se redondea: es una sugerencia de encuadre, y dar 125,134 m fingiría
     una precisión que la sugerencia no tiene. */
  const d=H/Math.tan(gr(ANG_OPT));
  return {d: d>=20 ? Math.round(d) : Math.round(d*10)/10, origen:"calculada"};
}
/* Ángulo vertical que abarca una altura H a una distancia d. */
function anguloVertical(H,d){
  return (isFinite(H)&&isFinite(d)&&d>0) ? Math.atan(H/d)*180/Math.PI : null;
}
/* Distancia mínima para que el punto de disparo y la altura H quepan en
   el mismo fotograma con el objetivo dado. */
function distanciaEncuadre(H,fRel){
  if(!isFinite(H)||H<=0||!isFinite(fRel)||fRel<=0) return null;
  const fov = 2*Math.atan(0.5/fRel);
  return H/Math.tan(fov);
}

/* Vuelca una configuración sobre el estado de medida. No toca la
   distancia: esa se mide en campo y sobrescribirla con una sugerencia
   sería sustituir un dato por una estimación sin avisar. */
function aplicaEnsayo(e){
  if(!e) return;
  S.med.hNom   = (e.hNom===null||e.hNom===undefined||e.hNom==="") ? "" : +e.hNom;
  S.med.tol    = (e.tol ===null||e.tol ===undefined||e.tol ==="") ? S.med.tol : +e.tol;
  S.med.angulos = e.angulos||"";
  S.med.alturas = e.alturas||"";
  S.med.obliq  = !!(e.angulos && e.angulos.trim());
  S.med.horiz  = !!(e.alturas && e.alturas.trim());
  S.reticula   = !!(S.med.hNom);
  S.med.ensayoId = e.id;
  S.med.ensayoNom = e.nombre;
  if(e.cat) S.med.cat = e.cat;
  if(e.ref) S.med.ref = e.ref;
}

/* Instantánea de lo que hay en pantalla, para guardarla con nombre. */
function ensayoDesdeEstado(nombre){
  return { id:"e"+Date.now(), nombre,
    cat: S.med.cat||"", ref: S.med.ref||"",
    hNom: (S.med.hNom===""||S.med.hNom===null||S.med.hNom===undefined)?null:+S.med.hNom,
    tol:  +S.med.tol,
    angulos: S.med.obliq ? (S.med.angulos||"") : "",
    alturas: S.med.horiz ? (S.med.alturas||"") : "",
    d: null, nota:"" };
}
