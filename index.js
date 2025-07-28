require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { MetaApi } = require('metaapi.cloud-sdk');

const app = express();
const port = 8080;

app.use(bodyParser.json());

const metaapi = new MetaApi(process.env.METAAPI_TOKEN);

app.post('/webhook', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    if (!symbol || !action || !lot || !sl || !tp) {
      return res.status(400).send('Faltan parámetros en el cuerpo JSON');
    }

    const account = await metaapi.metatraderAccountApi.getAccount(process.env.ACCOUNT_ID);
    const state = await account.getState();
    if (state !== 'DEPLOYED') {
      return res.status(400).send('La cuenta no está desplegada');
    }

    const connection = await account.getRPCConnection();
    await connection.connect();

    const position = await connection.trade({
      action: 'ORDER_TYPE_BUY',
      symbol: symbol,
      volume: lot,
      stopLoss: sl,
      takeProfit: tp,
      type: action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL'
    });

    console.log('Orden ejecutada correctamente:', position);
    res.status(200).send('Orden ejecutada correctamente');
  } catch (error) {
    console.error('Error al ejecutar la orden:', error);
    res.status(500).send(`Error al ejecutar la orden: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
