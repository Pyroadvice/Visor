/* ====================================================================
   PANTALLA COMPLETA · compartida por visor.html y basico.html

   En campo la observación se hace mirando, no leyendo paneles: con el
   lienzo ocupando toda la pantalla se ve el efecto mucho mejor, y a
   oscuras la diferencia es grande. Pero una vista sin controles no
   sirve para medir, así que en pantalla completa se superponen los tres
   que hacen falta y nada más: elegir marca, fijarla, y salir. El nivel
   sigue visible, porque es lo que hay que vigilar antes de disparar.

   Contrato con la página: debe ofrecer dimensiona() o mide() para
   recalcular el lienzo, dibuja() y pinta(). Se llaman al entrar y al
   salir porque el tamaño del lienzo cambia en ambos sentidos.
   ==================================================================== */

let FS_EL = null;

const fsActivo = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

function fsRedibuja(){
  if (typeof dimensiona === "function") dimensiona();
  else if (typeof mide === "function") { mide(); if (typeof encaja==="function" && S.src) encaja(); }
  if (typeof dibuja === "function") dibuja();
  if (typeof pinta === "function") pinta();
}

async function fsEntra(el){
  FS_EL = el;
  try{
    if (el.requestFullscreen) await el.requestFullscreen({navigationUI:"hide"});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else throw new Error("sin pantalla completa");
    /* El giro de pantalla se bloquea solo si el navegador lo permite; no
       es imprescindible y no se avisa si falla. */
    try{ await screen.orientation?.lock?.("portrait"); }catch(e){}
  }catch(e){
    alert("Este navegador no deja poner la vista a pantalla completa.\n\n"
      + "En Chrome de Android suele funcionar; en iPhone, Safari no lo permite para elementos de la página.");
    FS_EL = null;
  }
}
function fsSale(){
  try{ screen.orientation?.unlock?.(); }catch(e){}
  if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}
function fsAlterna(el){ fsActivo() ? fsSale() : fsEntra(el); }

/* Un cambio de estado puede venir del botón o del gesto del sistema, así
   que el redibujado cuelga del evento y no de quien lo provocó. */
["fullscreenchange","webkitfullscreenchange"].forEach(ev=>
  document.addEventListener(ev, ()=>{ if(!fsActivo()) FS_EL=null; setTimeout(fsRedibuja,60); }));

/* Estilos de la superposición. Se inyectan desde aquí para que las dos
   páginas no tengan que llevar una copia que se les quede desfasada. */
(function(){
  const css = document.createElement("style");
  css.textContent = `
  .fsbar{display:none}
  :fullscreen .fsbar, :-webkit-full-screen .fsbar{
    display:flex;position:absolute;left:0;right:0;bottom:0;gap:8px;padding:10px 12px
      calc(10px + env(safe-area-inset-bottom));
    background:linear-gradient(transparent,rgba(13,17,23,.88) 38%);align-items:flex-end;flex-wrap:wrap}
  .fsbar button{flex:1;min-width:76px;background:rgba(33,38,45,.92);color:#e6edf3;
    border:1px solid #30363d;border-radius:9px;padding:13px 8px;font:600 15px inherit}
  .fsbar button.p{background:#4493f8;border-color:#4493f8;color:#fff}
  .fsbar button.g{background:#3fb950;border-color:#3fb950;color:#06250f}
  .fsbar button.x{flex:0 0 auto;min-width:54px}
  .fsnum{position:absolute;right:8px;top:8px;background:rgba(13,17,23,.82);border:1px solid #30363d;
    border-radius:8px;padding:6px 10px;font:600 13px ui-monospace,monospace;color:#e6edf3;
    max-width:62%;text-align:right;display:none}
  :fullscreen .fsnum, :-webkit-full-screen .fsnum{display:block}
  `;
  document.head.appendChild(css);
})();
