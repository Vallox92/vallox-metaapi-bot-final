require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
app.use(bodyParser.json());

const token = process.env.METAAPI_TOKEN;
const accountId = process.env.ACCOUNT_ID;

const api = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    if (!symbol || !action || !lot || !sl || !tp) {
      return res.status(400).send('Faltan parámetros en el JSON.');
    }

    const account = await api.metatraderAccountApi.getAccount(accountId);
    if (account.state !== 'DEPLOYED') {
      return res.status(500).send('La cuenta no está desplegada.');
    }

    await account.connect();
    const connection = account.getRPCConnection();
    await connection.waitSynchronized();

    const trade = {
      symbol,
      type: action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      volume: lot,
      stopLoss: sl,
      takeProfit: tp
    };

    const result = await connection.createMarketOrder(trade);
    console.log('Orden ejecutada:', result);
    res.status(200).send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('Error al ejecutar la orden:', err);
    res.status(500).send('Error al ejecutar la orden');
  }
});

app.listen(8080, () => {
  console.log('Servidor iniciado en el puerto 8080');
});
