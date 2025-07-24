require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const token = process.env.METAAPI_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

const api = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📩 Señal recibida:', data);

  if (!data.symbol || !data.action || !data.lot || !data.sl || !data.tp) {
    console.error('🔴 JSON incompleto o inválido');
    return res.status(400).send('JSON incompleto o inválido');
  }

  try {
    console.log('🔑 Conectando con MetaApi...');
    const account = await api.metatraderAccountApi.getAccount(accountId);

    if (account.state !== 'DEPLOYED') {
      console.error('🔴 Cuenta no está desplegada.');
      return res.status(500).send('La cuenta no está desplegada en MetaApi');
    }

    console.log('🟢 Cuenta desplegada, conectando...');
    const connection = await account.getStreamingConnection();
    await connection.connect();
    await connection.waitSynchronized();

    const rpc = await connection.rpc;

    const result = await rpc.trade({
      actionType: 'ORDER_TYPE_MARKET',
      symbol: data.symbol,
      volume: data.lot,
      type: data.action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      stopLoss: data.sl,
      takeProfit: data.tp
    });

    console.log('✅ Orden ejecutada correctamente:', result);
    res.send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('❌ Error al ejecutar orden:', err.message || err);
    res.status(500).send(`Error al ejecutar la orden: ${err.message || err}`);
  }
});

app.listen(port, () => {
  console.log(`🟢 Bot escuchando en puerto ${port}`);
});

