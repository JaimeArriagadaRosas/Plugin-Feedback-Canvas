import { Router } from 'express';

const router = Router();

router.get('/deep-diagnostic.js', (req, res) => {
  res.type('application/javascript');
  res.send(`
// [Plugin Feedback LTI] Injected Global Script - TOTAL DEEP DIAGNOSTIC
(function() {
  try {
    console.log('%c======================================================', 'color: #ff0000; font-weight: bold;');
    console.log('%c[DEEP DIAGNOSTIC] STARTED IN CANVAS LMS', 'color: #ff0000; font-weight: bold; font-size: 16px;');
    console.log('%cCurrent URL: ' + window.location.href, 'color: #ff0000; font-weight: bold;');
    console.log('%c======================================================', 'color: #ff0000; font-weight: bold;');
    
    // 1. Log Environment info
    if (window.ENV) {
      console.log('%c[ENV] current_user_id: ' + window.ENV.current_user_id, 'color: #0088ff');
      console.log('%c[ENV] current_user_roles: ' + JSON.stringify(window.ENV.current_user_roles), 'color: #0088ff');
      console.log('%c[ENV] COURSE_ID: ' + window.ENV.COURSE_ID, 'color: #0088ff');
    }

    // 2. Track clicks globally
    document.addEventListener('click', function(e) {
      var target = e.target;
      var path = [];
      while(target && target.tagName) {
        path.push(target.tagName.toLowerCase() + (target.id ? '#' + target.id : '') + (target.className ? '.' + target.className.replace(/ /g, '.') : ''));
        target = target.parentElement;
        if(path.length >= 3) break;
      }
      console.log('%c[CLICK] Detected at: ' + path.reverse().join(' > '), 'color: #00aa00', e.target);
    }, true);

    // 3. Track fetch requests (to see what Canvas loads in background)
    var originalFetch = window.fetch;
    window.fetch = function() {
      console.log('%c[FETCH] Request to: ' + arguments[0], 'color: #aa00aa');
      return originalFetch.apply(this, arguments);
    };

    // 4. Course Navigation Menu Analyzer
    function analizarMenuNavegacion() {
      var navMenu = document.getElementById('section-tabs');
      if (navMenu) {
        console.log('%c[COURSE MENU] Menu detected. Listing all LTI/Native items:', 'color: #0000ff; font-weight: bold');
        var items = navMenu.querySelectorAll('li > a');
        var ltiFound = false;
        
        items.forEach(function(item) {
          var texto = item.textContent.trim();
          var href = item.href;
          var parentLi = item.parentElement;
          var estilos = window.getComputedStyle(parentLi);
          var isHidden = (estilos.display === 'none' || estilos.visibility === 'hidden' || parentLi.classList.contains('hidden'));
          
          console.log(' -> Item: "' + texto + '" | hidden: ' + isHidden + ' | classes: ' + item.className);
          
          if (texto.toLowerCase().indexOf('feedback') !== -1 || texto.toLowerCase().indexOf('unida') !== -1) {
            ltiFound = true;
            console.log('%c[COURSE MENU] PLUGIN BUTTON FOUND IN THE DOM!', 'color: #ff00ff; font-weight: bold; font-size: 14px;');
            console.log('      Display: ' + estilos.display);
            console.log('      Visibility: ' + estilos.visibility);
            console.log('      LI classes: ' + parentLi.className);
            console.log('      Destination URL: ' + href);
          }
        });

        if (!ltiFound) {
          console.log('%c[COURSE MENU] FATAL: The "Feedback" button does NOT exist in the HTML at all.', 'color: #ff0000; font-weight: bold; font-size: 14px;');
          console.log('%c          This means Canvas is NOT injecting it for this course.', 'color: #ff0000; font-weight: bold;');
        }
      } else {
        console.log('%c[DOM] #section-tabs not found on this page.', 'color: #888888');
      }
    }

    // Execute when ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(analizarMenuNavegacion, 1500); });
    } else {
      setTimeout(analizarMenuNavegacion, 1500);
    }
    
    // 5. Aggressive Mutation Observer
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element_NODE
              if (node.id === 'section-tabs') {
                console.log('%c[DOM] #section-tabs injected dynamically.', 'color: #ff8800');
                setTimeout(analizarMenuNavegacion, 500);
              }
              if (node.tagName === 'LI' && node.className.indexOf('context_external_tool') !== -1) {
                console.log('%c[DOM] New LTI injected dynamically:', 'color: #0000ff', node.textContent.trim(), node);
              }
            }
          });
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

  } catch (e) {
    console.error('[DEEP DIAGNOSTIC] Error in injected script:', e);
  }
})();
  `);
});

export default router;
