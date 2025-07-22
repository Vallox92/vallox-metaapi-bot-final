
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = process.env.PORT || 8080;

const token = process.env.TOKEN;
const accountId = process.env.ACCOUNT_ID;

const api = new MetaApi(token);
app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  const signal = req.body;
  console.log('📩 Señal recibida:', signal);

  try {
    const account = await api.metatraderAccountApi.getAccount(accountId);

    await account.reload();
    if (!account.isDeployed) {
      console.log('🚀 Deploying account...');
      await account.deploy();
    } else {
      console.log('✅ Cuenta ya desplegada');
    }

    const connection = account.getRPCConnection();
    await connection.connect();

    if (!connection.connected) throw new Error('❌ Conexión no disponible');

    const { symbol, action, lot, sl, tp } = signal;

    const result = await connection.createMarketOrder(symbol, action, lot, {
      stopLoss: sl,
      takeProfit: tp
    });

    console.log('✅ Orden ejecutada:', result);
    res.status(200).send({ status: 'Orden ejecutada correctamente', result });
  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err);
    res.status(500).send({ error: err.toString() });
  }
});

app.get('/', (req, res) => {
  res.send('🤖 Bot Vallox activo y escuchando señales');
});

app.listen(port, () => {
  console.log(`🚀 Server corriendo en puerto ${port}`);
});
