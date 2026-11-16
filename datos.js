/* ====================================================================
   EXPORTAR E IMPORTAR · compartido por visor.html y basico.html

   Lleva de un aparato a otro lo que cuesta rehacer: las calibraciones
   de los objetivos, las cámaras definidas y las configuraciones de
   ensayo. Un móvil se pierde o se cambia, y una calibración rehecha no
   es la misma calibración: el expediente viaja con ella.

   Regla que gobierna la importación: NO BORRA NADA. Lo que ya está
   sigue estando. Si un elemento del archivo coincide en identificador
   con uno existente, se pregunta qué hacer, y la opción por omisión es
   conservar el de aquí y traer el de fuera como elemento aparte. Así
   una importación equivocada nunca destruye trabajo.
   ==================================================================== */

const BUNDLE_VER = 2;

function exportaDatos(S){
  return JSON.stringify({
    vpd: BUNDLE_VER,
    fecha: new Date().toISOString(),
    perfiles: S.perfiles||[],
    camaras: S.camaras||[],
    ensayos: ensayosLee()
  }, null, 1);
}

/* Lee y valida sin tocar nada. Devuelve el contenido y un resumen para
   poder enseñar qué se va a importar antes de importarlo. */
function leeBundle(txt){
  let o;
  try{ o=JSON.parse(txt); }
  catch(e){ return {err:"El texto no es un archivo de datos válido."}; }
  if(!o || typeof o!=="object") return {err:"El archivo no contiene datos."};
  const arr = v => Array.isArray(v) ? v : [];
  const perfiles = arr(o.perfiles).filter(p=>p && p.id && isFinite(+p.fRel) && +p.fRel>0);
  const camaras  = arr(o.camaras ).filter(c=>c && c.id && c.nombre);
  const ensayos  = arr(o.ensayos ).filter(e=>e && e.id && e.nombre);
  if(!perfiles.length && !camaras.length && !ensayos.length)
    return {err:"El archivo no trae perfiles, cámaras ni configuraciones reconocibles."};
  /* Un perfil exportado desde una versión anterior puede no traer δρ ni
     expediente. Se admite, pero conviene que se vea. */
  const sinDatos = perfiles.filter(p=>!p.datos).length;
  return {ok:true, vpd:+o.vpd||1, fecha:o.fecha||null, perfiles, camaras, ensayos, sinDatos};
}

/* Funde una lista entrante con la que ya hay.
   modo "conservar": ante choque de identificador, se queda el de aquí y
   el de fuera entra con identificador nuevo y el nombre marcado.
   modo "sustituir": el de fuera pisa al de aquí.
   En ningún caso se elimina un elemento que no venga en el archivo.  */
function fusiona(actual, entrantes, modo, marca){
  const lista = (actual||[]).slice();
  let nuevos=0, sustituidos=0, duplicados=0;
  for(const e of entrantes){
    const i = lista.findIndex(q=>q.id===e.id);
    if(i<0){ lista.push(e); nuevos++; continue; }
    if(modo==="sustituir"){ lista[i]=e; sustituidos++; }
    else {
      const copia = Object.assign({}, e, {id:e.id+"-imp"+Date.now().toString(36)});
      if(copia.nombre) copia.nombre += " "+(marca||"(importado)");
      if(copia.name)   copia.name   += " "+(marca||"(importado)");
      lista.push(copia); duplicados++;
    }
  }
  return {lista, nuevos, sustituidos, duplicados};
}

/* Aplica el archivo. Devuelve el resumen de lo que ha hecho, para
   poder contárselo a quien lo importó en vez de dejarlo a oscuras. */
function aplicaBundle(S, b, opts){
  const o = Object.assign({perfiles:true, camaras:true, ensayos:true, modo:"conservar"}, opts||{});
  const r = {};
  if(o.perfiles && b.perfiles.length){
    const f = fusiona(S.perfiles, b.perfiles, o.modo, "(importado)");
    S.perfiles = f.lista; r.perfiles = f;
  }
  if(o.camaras && b.camaras.length){
    const f = fusiona(S.camaras, b.camaras, o.modo, "(importada)");
    S.camaras = f.lista; r.camaras = f;
  }
  if(o.ensayos && b.ensayos.length){
    const f = fusiona(ensayosLee(), b.ensayos, o.modo, "(importado)");
    ensayosGuarda(f.lista); r.ensayos = f;
  }
  return r;
}

function resumenImport(r){
  const t=[];
  const di=(n,f)=>{ if(!f) return;
    const p=[]; if(f.nuevos) p.push(f.nuevos+" nuevos");
    if(f.sustituidos) p.push(f.sustituidos+" sustituidos");
    if(f.duplicados) p.push(f.duplicados+" añadidos aparte");
    if(p.length) t.push(n+": "+p.join(", ")); };
  di("Perfiles", r.perfiles); di("Cámaras", r.camaras); di("Configuraciones", r.ensayos);
  return t.length ? t.join("\n") : "No había nada que añadir.";
}

/* Descarga como archivo, que en un móvil es más manejable que copiar un
   texto largo del portapapeles. */
function descargaTexto(txt, nombre, tipo){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([txt],{type:(tipo||"application/json")+";charset=utf-8"}));
  a.download=nombre; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000);
}
function nombreExport(){
  return "visor-datos-"+new Date().toISOString().slice(0,10)+".json";
}
