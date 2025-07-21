const express = require('express');
const bodyParser = require('body-parser');
const { MetaApi } = require('metaapi.cloud-sdk');
require('dotenv').config();

const app = express();
const port = 8080;

app.use(bodyParser.json());

const api = new MetaApi(process.env.TOKEN);
const accountId = process.env.ACCOUNT_ID;

app.post('/webhook', async (req, res) => {
  const { symbol, action, lot, sl, tp } = req.body;

  console.log('📥 Señal recibida:', req.body);

  if (!symbol || !action || !lot) {
    return res.status(400).send('❌ JSON inválido. Requiere: symbol, action, lot.');
  }

  try {
    const account = await api.metatraderAccountApi.getAccount(accountId);
    if (!account || account.state !== 'DEPLOYED') {
      return res.status(500).send('❌ La cuenta no está desplegada.');
    }

    console.log('🔁 Conectando a la cuenta...');
    const connection = await account.getRPCConnection();
    await connection.connect();

    if (!connection.isConnected()) {
      return res.status(500).send('❌ No se pudo conectar a MetaTrader.');
    }

    const trade = {
      symbol,
      volume: lot,
      type: action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      action: 'ORDER_TYPE_MARKET',
      stopLoss: sl,
      takeProfit: tp,
    };

    console.log('📤 Enviando orden:', trade);
    const result = await connection.createMarketOrder(trade);

    console.log('✅ Orden ejecutada:', result);
    res.send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err);
    res.status(500).send('Error al ejecutar la orden');
  }
});

app.listen(port, () => {
  console.log(`🚀 Express server is running on port ${port}`);
});
