import { Router } from 'express';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Beacon one-way desde el JS inyectado en el layout de Canvas (layouts/_foot).
 * Canvas procesa el login/logout con su propio backend (puerto 8080); nuestro
 * plugin no ve las credenciales. Este endpoint recibe un evento ya identificado
 * por Canvas para registrar en consola el inicio/fin de sesion en el LMS.
 *
 * El beacon se envia con navigator.sendBeacon como application/x-www-form-urlencoded
 * (peticion simple, sin preflight) para no depender de la politica CORS del plugin.
 */
router.post('/session-events', (req, res) => {
  const { event, payload } = req.body || {};
  let data = {};
  if (payload) {
    try {
      data = JSON.parse(payload);
    } catch {
      data = {};
    }
  }

  const email = data.email || 'desconocido';
  const userId = data.userId || data.localId || 'N/A';
  const localId = data.localId || 'N/A';
  const roles = Array.isArray(data.roles)
    ? data.roles
    : (data.roles ? [String(data.roles)] : []);

  const esAdmin = roles.some((r) => /admin|root_admin/i.test(r));
  const esProfesor = roles.some((r) => /teacher|instructor/i.test(r));
  const esEstudiante = roles.some((r) => /student/i.test(r));
  const etiqueta = esAdmin
    ? 'ADMIN'
    : esProfesor
      ? 'PROFESOR'
      : esEstudiante
        ? 'ESTUDIANTE'
        : (roles[0] || 'N/A');

  if (event === 'login_attempt') {
    logger.info('[CANVAS-SESSION] [LOCK] INTENTO DE LOGIN en Canvas LMS');
    logger.info(`[CANVAS-SESSION]   Email ingresado: ${email}`);
    logger.info('[CANVAS-SESSION]   (Pendiente de confirmacion por Canvas)');
  } else if (event === 'login_success') {
    logger.info('[CANVAS-SESSION] [OK] LOGIN en Canvas LMS exitoso');
    logger.info(`[CANVAS-SESSION]   Usuario : ${email} (id global: ${userId}, local: ${localId})`);
    logger.info(`[CANVAS-SESSION]   Permisos: ${roles.join(', ') || 'N/A'}`);
    logger.info(`[CANVAS-SESSION]   Rol identificado: ${etiqueta} ${esAdmin || esProfesor || esEstudiante ? '[OK]' : '[!]'}`);
  } else if (event === 'logout') {
    logger.info('[CANVAS-SESSION] [EXIT] LOGOUT en Canvas LMS');
    logger.info(`[CANVAS-SESSION]   Usuario : ${email} (id global: ${userId})`);
    logger.info('[CANVAS-SESSION]   Sesion de Canvas finalizada.');
  } else {
    logger.info(`[CANVAS-SESSION] Evento desconocido: ${event}`);
  }

  res.status(204).end();
});

router.get('/canvas-logs.js', (req, res) => {
  res.type('application/javascript');
  res.send(`
// [Plugin Feedback LTI] Script Global de Canvas - DIAGNÓSTICO PROFUNDO
(function() {
  try {
    console.log('%c[Unida LTI] DIAGNÓSTICO PROFUNDO INICIADO', 'color: #ff0000; font-weight: bold; font-size: 16px;');
    
    // 1. Logear info del usuario
    if (window.ENV && window.ENV.current_user_id) {
      console.log('[Unida LTI] Usuario: ' + window.ENV.current_user_email);
      console.log('[Unida LTI] Roles: ', window.ENV.current_user_roles);
    }
    
    // 2. Rastrear clicks
    document.addEventListener('click', function(e) {
      console.log('%c[Unida LTI] Clic detectado en:', 'color: #00aa00', e.target);
    }, true);

    // 3. Inspeccionar Menú de Navegación del Curso
    function inspeccionarMenu() {
      var navMenu = document.getElementById('section-tabs');
      if (navMenu) {
        console.log('%c[Unida LTI] Menú de navegación encontrado. Elementos HTML presentes:', 'color: #0000ff; font-weight:bold');
        var items = navMenu.querySelectorAll('li > a');
        var ltiFound = false;
        items.forEach(function(item) {
          var texto = item.textContent.trim();
          var href = item.href;
          var parentLi = item.parentElement;
          var estilosDiv = window.getComputedStyle(parentLi);
          var isHidden = (estilosDiv.display === 'none' || estilosDiv.visibility === 'hidden');
          
          console.log(' - ' + texto + ' | visible: ' + !isHidden + ' | clases: ' + item.className);
          
          if (texto.toLowerCase().indexOf('feedback') !== -1 || texto.toLowerCase().indexOf('unida') !== -1) {
            ltiFound = true;
            console.log('%c[Unida LTI] ¡BOTÓN LTI ENCONTRADO EN EL HTML!: ' + texto, 'color: #ff00ff; font-weight: bold; font-size: 14px;');
            console.log('   -> display: ' + estilosDiv.display + ', visibility: ' + estilosDiv.visibility);
          }
        });
        
        if (!ltiFound) {
          console.log('%c[Unida LTI] ERROR: EL BOTÓN NO ESTÁ PRESENTE EN EL HTML DEL MENÚ.', 'color: #ff0000; font-weight: bold;');
          console.log('   -> Canvas no ha renderizado el enlace. Revisa la configuración de visibilidad o si el curso no lo heredó.');
        }
      } else {
        console.log('[Unida LTI] No estamos en un curso (no hay #section-tabs).');
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(inspeccionarMenu, 1000); });
    } else {
      setTimeout(inspeccionarMenu, 1000);
    }
    
    // 4. Observador de Mutaciones (por si el menú carga por AJAX/React)
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) {
              if (node.id === 'section-tabs') {
                console.log('%c[Unida LTI] Menú inyectado dinámicamente, reinspeccionando...', 'color: #ff8800');
                inspeccionarMenu();
              }
              if (node.textContent && (node.textContent.indexOf('Feedback') !== -1 || node.textContent.indexOf('Unida') !== -1)) {
                 if(node.tagName === 'A' || node.tagName === 'LI') {
                     console.log('%c[Unida LTI] Posible inyección de botón detectada:', 'color: #ff00ff', node);
                 }
              }
            }
          });
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

  } catch (e) {
    console.error('[Unida LTI] Error in Canvas global script:', e);
  }
})();
  `);
});

export default router;
