import axios from 'axios';
import 'dotenv/config';

// -----------------------------------------------------------------------------
// SCRIPT TO CONFIGURE CANVAS WEBHOOKS (RF41)
// Must be executed with the Ngrok base URL exposed to the internet, for example:
// node apps/server/bin/setupWebhooks.js https://abcd-123.ngrok.io
// -----------------------------------------------------------------------------

const args = process.argv.slice(2);
const ngrokUrl = args[0];

if (!ngrokUrl) {
  console.error('Please provide the base URL (e.g. ngrok) as an argument.');
  console.error('Usage: node apps/server/bin/setupWebhooks.js <WEBHOOK_BASE_URL>');
  process.exit(1);
}

const CANVAS_URL = process.env.VITE_CANVAS_BASE_URL;
const CANVAS_TOKEN = process.env.VITE_CANVAS_ACCESS_TOKEN;
const WEBHOOK_URL = `${ngrokUrl}/api/webhooks/canvas`;

async function setupWebhooks() {
  try {
    console.log(`Configuring Webhook to: ${WEBHOOK_URL}`);
    console.log(`In the Canvas environment: ${CANVAS_URL}`);

    // NOTE: Canvas uses Live Events (Amazon SQS/Kinesis) or Webhooks via LTI Advantage
    // To simplify the local demo and RF41 requirements,
    // we use a generic subscription API simulation or document it.
    
    // LTI Advantage webhook or Live Events registration simulation
    // In real Canvas it would require configuring an endpoint in Developer Keys (Placements: Assignment Selection)
    // Or via Subscriptions API
    
    console.log(`
      For grade change events (grade_change) to reach this endpoint, 
      ensure Canvas Live Events is configured or use LTI 1.3 extensions
      with Assignment and Grade Services (AGS).
      
      URL to register in Canvas (Developer Key -> LTI Advantage -> Webhook URL):
      ${WEBHOOK_URL}
    `);

    // Theoretical call example (real subscriptions API if enabled):
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

    console.log('Script finished successfully! System is ready to receive webhooks for RF41.');
  } catch (err) {
    console.error('Error configuring webhook:', err.response ? err.response.data : err.message);
  }
}

setupWebhooks();
