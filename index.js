require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { MetaApi } = require('metaapi.cloud-sdk');

const app = express();
const port = process.env.PORT || 8080;

const api = new MetaApi(process.env.METAAPI_TOKEN);
const accountId = process.env.METAAPI_ACCOUNT_ID;

app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  const { symbol, action, lot, sl, tp } = req.body;

  try {
    const account = await api.metatraderAccountApi.getAccount(accountId);

    if (account.state !== 'DEPLOYED') {
      console.log('Cuenta no desplegada. Esperando...');
      await account.deploy();
      await account.waitConnected();
    }

    const connection = account.getRPCConnection();
    await connection.connect();

    const side = action.toLowerCase() === 'buy' ? 'BUY' : 'SELL';

    const result = await connection.createMarketOrder(symbol, side, lot, {
      stopLoss: sl,
      takeProfit: tp
    });

    console.log('Orden ejecutada:', result);
    res.send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('Error al ejecutar la orden:', err.message || err);
    res.status(500).send('Error al ejecutar la orden.');
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});
