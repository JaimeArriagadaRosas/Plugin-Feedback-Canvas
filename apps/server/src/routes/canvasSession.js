import { Router } from 'express';
import logger from '../utils/logger.js';

const router = Router();

/**
 * One-way beacon from JS injected in Canvas layout (layouts/_foot).
 * Canvas processes login/logout with its own backend (port 8080); our
 * plugin does not see the credentials. This endpoint receives an event already identified
 * by Canvas to log the start/end of the session in the LMS in the console.
 *
 * The beacon is sent with navigator.sendBeacon as application/x-www-form-urlencoded
 * (simple request, without preflight) to not depend on the plugin's CORS policy.
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

  const email = data.email || 'unknown';
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
      ? 'TEACHER'
      : esEstudiante
        ? 'STUDENT'
        : (roles[0] || 'N/A');

  if (event === 'login_attempt') {
    logger.info('[CANVAS-SESSION] [LOCK] LOGIN ATTEMPT in Canvas LMS');
    logger.info(`[CANVAS-SESSION]   Email entered: ${email}`);
    logger.info('[CANVAS-SESSION]   (Pending confirmation from Canvas)');
  } else if (event === 'login_success') {
    logger.info('[CANVAS-SESSION] [OK] LOGIN in Canvas LMS successful');
    logger.info(`[CANVAS-SESSION]   User : ${email} (global id: ${userId}, local: ${localId})`);
    logger.info(`[CANVAS-SESSION]   Permissions: ${roles.join(', ') || 'N/A'}`);
    logger.info(`[CANVAS-SESSION]   Identified role: ${etiqueta} ${esAdmin || esProfesor || esEstudiante ? '[OK]' : '[!]'}`);
  } else if (event === 'logout') {
    logger.info('[CANVAS-SESSION] [EXIT] LOGOUT in Canvas LMS');
    logger.info(`[CANVAS-SESSION]   User : ${email} (global id: ${userId})`);
    logger.info('[CANVAS-SESSION]   Canvas session ended.');
  } else {
    logger.info(`[CANVAS-SESSION] Unknown event: ${event}`);
  }

  res.status(204).end();
});

router.get('/canvas-logs.js', (req, res) => {
  res.type('application/javascript');
  res.send(`
// [Plugin Feedback LTI] Canvas Global Script - DEEP DIAGNOSTICS
(function() {
  try {
    console.log('%c[Unida LTI] DEEP DIAGNOSTICS INITIATED', 'color: #ff0000; font-weight: bold; font-size: 16px;');
    
    // 1. Log user info
    if (window.ENV && window.ENV.current_user_id) {
      console.log('[Unida LTI] User: ' + window.ENV.current_user_email);
      console.log('[Unida LTI] Roles: ', window.ENV.current_user_roles);
    }
    
    // 2. Track clicks
    document.addEventListener('click', function(e) {
      console.log('%c[Unida LTI] Click detected on:', 'color: #00aa00', e.target);
    }, true);

    // 3. Inspect Course Navigation Menu
    function inspeccionarMenu() {
      var navMenu = document.getElementById('section-tabs');
      if (navMenu) {
        console.log('%c[Unida LTI] Navigation menu found. HTML elements present:', 'color: #0000ff; font-weight:bold');
        var items = navMenu.querySelectorAll('li > a');
        var ltiFound = false;
        items.forEach(function(item) {
          var texto = item.textContent.trim();
          var href = item.href;
          var parentLi = item.parentElement;
          var estilosDiv = window.getComputedStyle(parentLi);
          var isHidden = (estilosDiv.display === 'none' || estilosDiv.visibility === 'hidden');
          
          console.log(' - ' + texto + ' | visible: ' + !isHidden + ' | classes: ' + item.className);
          
          if (texto.toLowerCase().indexOf('feedback') !== -1 || texto.toLowerCase().indexOf('unida') !== -1) {
            ltiFound = true;
            console.log('%c[Unida LTI] LTI BUTTON FOUND IN HTML!: ' + texto, 'color: #ff00ff; font-weight: bold; font-size: 14px;');
            console.log('   -> display: ' + estilosDiv.display + ', visibility: ' + estilosDiv.visibility);
          }
        });
        
        if (!ltiFound) {
          console.log('%c[Unida LTI] ERROR: THE BUTTON IS NOT PRESENT IN THE HTML MENU.', 'color: #ff0000; font-weight: bold;');
          console.log('   -> Canvas has not rendered the link. Check the visibility configuration or if the course did not inherit it.');
        }
      } else {
        console.log('[Unida LTI] Not in a course (no #section-tabs).');
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(inspeccionarMenu, 1000); });
    } else {
      setTimeout(inspeccionarMenu, 1000);
    }
    
    // 4. Mutation Observer (in case the menu loads via AJAX/React)
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) {
              if (node.id === 'section-tabs') {
                console.log('%c[Unida LTI] Menu injected dynamically, reinspecting...', 'color: #ff8800');
                inspeccionarMenu();
              }
              if (node.textContent && (node.textContent.indexOf('Feedback') !== -1 || node.textContent.indexOf('Unida') !== -1)) {
                 if(node.tagName === 'A' || node.tagName === 'LI') {
                     console.log('%c[Unida LTI] Possible button injection detected:', 'color: #ff00ff', node);
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
