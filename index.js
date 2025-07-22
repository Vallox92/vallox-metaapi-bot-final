require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const token = process.env.TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

const api = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    if (!symbol || !action || !lot || !sl || !tp) {
      return res.status(400).json({ error: 'Faltan campos en la señal. Debe incluir symbol, action, lot, sl y tp.' });
    }

    console.log('📩 Señal recibida:', req.body);
    const account = await api.metatraderAccountApi.getAccount(accountId);

    console.log('⏳ Deploying account...');
    await account.deploy();
    await account.waitConnected();

    const connection = await account.getRPCConnection();
    await connection.connect();

    console.log('🚀 Ejecutando orden...');
    const result = await connection.createMarketOrder(symbol, action, lot, {
      stopLossInPips: sl,
      takeProfitInPips: tp
    });

    console.log('✅ Orden ejecutada:', result);
    res.send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err);
    res.status(500).json({ error: err.message || 'Error al procesar la orden' });
  }
});

app.listen(port, () => {
  console.log(`✅ Servidor escuchando en el puerto ${port}`);
});

