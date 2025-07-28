require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { default: MetaApi } = require('metaapi.cloud-sdk');

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const token = process.env.METAAPI_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

const metaapi = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    if (!symbol || !action || !lot || !sl || !tp) {
      return res.status(400).send('Faltan campos en el JSON.');
    }

    const account = await metaapi.metatraderAccountApi.getAccount(accountId);
    const deployed = await account.isDeployed();
    if (!deployed) await account.deploy();
    await account.waitConnected();

    const connection = await account.getRPCConnection();
    await connection.connect();

    const price = action === 'buy' 
      ? (await connection.getSymbolPrice(symbol)).ask 
      : (await connection.getSymbolPrice(symbol)).bid;

    const slPrice = action === 'buy' ? price - sl * 0.1 : price + sl * 0.1;
    const tpPrice = action === 'buy' ? price + tp * 0.1 : price - tp * 0.1;

    await connection.trade({
      action: 'ORDER_TYPE_MARKET',
      symbol,
      volume: lot,
      type: action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      sl: slPrice,
      tp: tpPrice,
      magic: 123456
    });

    res.send('✅ Orden ejecutada correctamente');
  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err);
    res.status(500).send('Error en la ejecución de la orden');
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${port}`);
});
