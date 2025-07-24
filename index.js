const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  const signal = req.body;

  console.log('📥 Señal recibida:', signal);

  if (!signal.symbol || !signal.action || !signal.lot || !signal.sl || !signal.tp) {
    console.error('❌ Error: JSON incompleto o mal formado');
    return res.status(400).send('Error: JSON incompleto');
  }

  try {
    console.log('🔑 Conectando con MetaApi...');

    const api = new MetaApi(process.env.TOKEN);
    const account = await api.metatraderAccountApi.getAccount(process.env.ACCOUNT_ID);

    if (!account || account.state !== 'CONNECTED' && account.state !== 'DEPLOYED') {
      console.error('❌ Cuenta no conectada correctamente. Estado:', account.state);
      return res.status(500).send('Error: Cuenta no conectada');
    }

    await account.waitConnected();
    const connection = await account.getRPCConnection();
    await connection.connect();

    console.log('✅ Conectado. Ejecutando orden...');

    const result = await connection.trade({
      actionType: 'ORDER_TYPE_BUY',
      symbol: signal.symbol,
      volume: signal.lot,
      stopLoss: signal.sl,
      takeProfit: signal.tp,
      type: signal.action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL'
    });

    console.log('✅ Orden ejecutada correctamente:', result);
    res.send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err.message);
    res.status(500).send(`Error al ejecutar la orden: ${err.message}`);
  }
});

app.listen(port, () => {
  console.log(`🚀 Bot escuchando en puerto ${port}`);
});

