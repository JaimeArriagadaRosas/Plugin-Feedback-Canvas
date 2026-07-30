import { Router } from 'express';

const router = Router();

router.get('/deep-diagnostic.js', (req, res) => {
  res.type('application/javascript');
  res.send(`
// [Plugin Feedback LTI] Script Global Inyectado - DIAGNÓSTICO PROFUNDO TOTAL
(function() {
  try {
    console.log('%c======================================================', 'color: #ff0000; font-weight: bold;');
    console.log('%c[DIAGNÓSTICO PROFUNDO] INICIADO EN CANVAS LMS', 'color: #ff0000; font-weight: bold; font-size: 16px;');
    console.log('%cURL actual: ' + window.location.href, 'color: #ff0000; font-weight: bold;');
    console.log('%c======================================================', 'color: #ff0000; font-weight: bold;');
    
    // 1. Loggear info de Entorno
    if (window.ENV) {
      console.log('%c[ENV] current_user_id: ' + window.ENV.current_user_id, 'color: #0088ff');
      console.log('%c[ENV] current_user_roles: ' + JSON.stringify(window.ENV.current_user_roles), 'color: #0088ff');
      console.log('%c[ENV] COURSE_ID: ' + window.ENV.COURSE_ID, 'color: #0088ff');
    }

    // 2. Rastrear clicks globalmente
    document.addEventListener('click', function(e) {
      var target = e.target;
      var path = [];
      while(target && target.tagName) {
        path.push(target.tagName.toLowerCase() + (target.id ? '#' + target.id : '') + (target.className ? '.' + target.className.replace(/ /g, '.') : ''));
        target = target.parentElement;
        if(path.length >= 3) break;
      }
      console.log('%c[CLICK] Detectado en: ' + path.reverse().join(' > '), 'color: #00aa00', e.target);
    }, true);

    // 3. Rastrear fetch requests (para ver qué carga Canvas de fondo)
    var originalFetch = window.fetch;
    window.fetch = function() {
      console.log('%c[FETCH] Petición a: ' + arguments[0], 'color: #aa00aa');
      return originalFetch.apply(this, arguments);
    };

    // 4. Analizador de Menú de Navegación del Curso
    function analizarMenuNavegacion() {
      var navMenu = document.getElementById('section-tabs');
      if (navMenu) {
        console.log('%c[MENÚ CURSO] Menú detectado. Listando todos los ítems LTI/Nativos:', 'color: #0000ff; font-weight: bold');
        var items = navMenu.querySelectorAll('li > a');
        var ltiFound = false;
        
        items.forEach(function(item) {
          var texto = item.textContent.trim();
          var href = item.href;
          var parentLi = item.parentElement;
          var estilos = window.getComputedStyle(parentLi);
          var isHidden = (estilos.display === 'none' || estilos.visibility === 'hidden' || parentLi.classList.contains('hidden'));
          
          console.log(' -> Item: "' + texto + '" | hidden: ' + isHidden + ' | clases: ' + item.className);
          
          if (texto.toLowerCase().indexOf('feedback') !== -1 || texto.toLowerCase().indexOf('unida') !== -1) {
            ltiFound = true;
            console.log('%c[MENÚ CURSO] ¡BOTÓN DEL PLUGIN ENCONTRADO EN EL DOM!', 'color: #ff00ff; font-weight: bold; font-size: 14px;');
            console.log('      Display: ' + estilos.display);
            console.log('      Visibility: ' + estilos.visibility);
            console.log('      Clases del LI: ' + parentLi.className);
            console.log('      URL Destino: ' + href);
          }
        });

        if (!ltiFound) {
          console.log('%c[MENÚ CURSO] FATAL: El botón "Feedback" NO existe en el HTML en absoluto.', 'color: #ff0000; font-weight: bold; font-size: 14px;');
          console.log('%c          Esto significa que Canvas NO lo está inyectando para este curso.', 'color: #ff0000; font-weight: bold;');
        }
      } else {
        console.log('%c[DOM] No se encontró #section-tabs en esta página.', 'color: #888888');
      }
    }

    // Ejecutar cuando esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(analizarMenuNavegacion, 1500); });
    } else {
      setTimeout(analizarMenuNavegacion, 1500);
    }
    
    // 5. Observador de Mutaciones Agresivo
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element_NODE
              if (node.id === 'section-tabs') {
                console.log('%c[DOM] #section-tabs inyectado dinámicamente.', 'color: #ff8800');
                setTimeout(analizarMenuNavegacion, 500);
              }
              if (node.tagName === 'LI' && node.className.indexOf('context_external_tool') !== -1) {
                console.log('%c[DOM] Nuevo LTI inyectado dinámicamente:', 'color: #0000ff', node.textContent.trim(), node);
              }
            }
          });
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

  } catch (e) {
    console.error('[DIAGNÓSTICO PROFUNDO] Error en el script inyectado:', e);
  }
})();
  `);
});

export default router;
