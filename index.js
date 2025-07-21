const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const token = process.env.METAAPI_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;
const api = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    console.log('📩 Señal recibida:', req.body);

    if (!symbol || !action || !lot || !sl || !tp) {
      console.log('❌ JSON inválido. Falta información.');
      return res.status(400).send('Faltan parámetros en el JSON.');
    }

    const account = await api.metatraderAccountApi.getAccount(accountId);
    if (!account || account.state !== 'DEPLOYED') {
      console.log('❌ Cuenta no está desplegada o no existe.');
      return res.status(500).send('Cuenta no desplegada o inválida.');
    }

    const connection = await account.getRPCConnection();
    await connection.connect();

    console.log('✅ Conectado a MetaApi');

    const price = await connection.getSymbolPrice(symbol);
    const side = action.toLowerCase() === 'buy' ? 'BUY' : 'SELL';

    const result = await connection.createMarketOrder(symbol, side, lot, {
      stopLoss: sl,
      takeProfit: tp
    });

    console.log(`✅ ORDEN EJECUTADA (${side}) en ${symbol}`, result);
    res.status(200).send('Orden ejecutada exitosamente');
  } catch (err) {
    console.error('🔥 Error al ejecutar la orden:', err);
    res.status(500).send('Error al ejecutar la orden.');
  }
});

app.listen(port, () => {
  console.log(`🚀 Bot escuchando en el puerto ${port}`);
});

