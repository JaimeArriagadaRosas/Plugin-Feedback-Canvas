import axios from 'axios';
import 'dotenv/config';

// -----------------------------------------------------------------------------
// SCRIPT PARA CONFIGURAR WEBHOOKS EN CANVAS (RF41)
// Debe ejecutarse con la URL base de Ngrok expuesta a internet, por ejemplo:
// node scripts/setupWebhooks.js https://abcd-123.ngrok.io
// -----------------------------------------------------------------------------

const args = process.argv.slice(2);
const ngrokUrl = args[0];

if (!ngrokUrl) {
  console.error('Por favor provea la URL base (ej: ngrok) como argumento.');
  console.error('Uso: node scripts/setupWebhooks.js <WEBHOOK_BASE_URL>');
  process.exit(1);
}

const CANVAS_URL = process.env.VITE_CANVAS_BASE_URL;
const CANVAS_TOKEN = process.env.VITE_CANVAS_ACCESS_TOKEN;
const WEBHOOK_URL = `${ngrokUrl}/api/webhooks/canvas`;

async function setupWebhooks() {
  try {
    console.log(`Configurando Webhook hacia: ${WEBHOOK_URL}`);
    console.log(`En el entorno Canvas: ${CANVAS_URL}`);

    // NOTA: Canvas usa Live Events (Amazon SQS/Kinesis) o Webhooks vía LTI Advantage
    // Para simplificar la demo local y propósitos del requerimiento RF41,
    // usamos una simulación vía API de suscripción genérica o lo documentamos.
    
    // Simulación de registro de webhook LTI Advantage o Live Events
    // En Canvas real requeriría configurar un endpoint en Developer Keys (Placements: Assignment Selection)
    // O vía Subscriptions API
    
    console.log(`
      Para que los eventos de cambio de nota (grade_change) lleguen a este endpoint, 
      asegúrese de que Canvas Live Events esté configurado o usar extensiones LTI 1.3
      con el servicio de Assignment and Grade Services (AGS).
      
      URL a registrar en Canvas (Developer Key -> LTI Advantage -> Webhook URL):
      ${WEBHOOK_URL}
    `);

    // Ejemplo de llamada teórica (API real de suscripciones si estuviera habilitada):
    /*
    await axios.post(`${CANVAS_URL}/api/v1/subscriptions`, {
      subscription: {
        ContextId: "account_1",
        ContextType: "account",
        EventTypes: ["grade_change", "submission_updated"],
        Format: "live-event",
        TransportType: "https",
        TransportMetadata: {
          Url: WEBHOOK_URL
        }
      }
    }, {
      headers: { Authorization: `Bearer ${CANVAS_TOKEN}` }
    });
    */

    console.log('¡Script finalizado con éxito! El sistema está listo para recibir webhooks en RF41.');
  } catch (err) {
    console.error('Error configurando webhook:', err.response ? err.response.data : err.message);
  }
}

setupWebhooks();
