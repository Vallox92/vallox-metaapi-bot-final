require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = 8080;

app.use(bodyParser.json());

const token = process.env.METAAPI_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

const api = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  console.log('🟢 Señal recibida:', req.body);

  const { symbol, action, lot, sl, tp } = req.body;

  if (!symbol || !action || !lot || !sl || !tp) {
    console.error('❌ JSON incompleto');
    return res.status(400).send('JSON inválido');
  }

  try {
    const account = await api.metatraderAccountApi.getAccount(accountId);

    if (!account) throw new Error('Cuenta no encontrada');
    if (account.state !== 'DEPLOYED') {
      console.log('⚠️ Cuenta no desplegada. Desplegando...');
      await account.deploy();
      await account.waitConnected();
    }

    console.log('🔌 Conectando con MetaApi...');
    const connection = await account.connect();
    await connection.waitSynchronized();

    console.log('📤 Ejecutando orden...');
    const result = await connection.createMarketOrder(symbol, action.toUpperCase(), lot, {
      stopLoss: sl,
      takeProfit: tp
    });

    console.log('✅ Orden ejecutada:', result);
    res.status(200).send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err);
    res.status(500).send(`Error: ${err.message}`);
  }
});

app.listen(port, () => {
  console.log(`🚀 Bot corriendo en el puerto ${port}`);
});

