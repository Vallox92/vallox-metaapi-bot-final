require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;
const metaapi = new MetaApi(process.env.METAAPI_TOKEN);
const ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID;
const WEBHOOK_PASSPHRASE = process.env.WEBHOOK_PASSPHRASE;

app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;

    // Validar que venga la passphrase
    if (WEBHOOK_PASSPHRASE && data.passphrase !== WEBHOOK_PASSPHRASE) {
      return res.status(401).send('Unauthorized: Invalid passphrase');
    }

    const { symbol, action, lot, sl, tp } = data;
    if (!symbol || !action || !lot || !sl || !tp) {
      return res.status(400).send('Error: Datos incompletos en el JSON');
    }

    // Obtener cuenta desde MetaApi
    const account = await metaapi.metatraderAccountApi.getAccount(ACCOUNT_ID);
    if (!account || account.state !== 'DEPLOYED') {
      return res.status(500).send('Error: Cuenta no está desplegada o conectada');
    }

    console.log('Conectando a la cuenta vía RPC...');
    const connection = await metaapi.rpc.connect(ACCOUNT_ID);

    console.log('Enviando orden...');
    const result = await connection.trade({
      symbol,
      action,
      lot,
      sl,
      tp,
    });

    console.log('✅ Orden ejecutada correctamente:', result);
    res.status(200).send('Orden ejecutada correctamente');

  } catch (error) {
    console.error('❌ Error al ejecutar la orden:', error.message);
    res.status(500).send(`Error al ejecutar la orden: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

