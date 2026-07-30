import db from '../src/data/db.js';

async function updateModel() {
  console.log("Updating IA model in DB to gemini-2.5-flash...");
  const res = await db.query(
    "UPDATE Configuracion_IA SET modelo_preferido = 'gemini-2.5-flash', endpoint_api = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash' RETURNING *"
  );
  console.log("Updated config:", res.rows);
}
updateModel().catch(console.error);
