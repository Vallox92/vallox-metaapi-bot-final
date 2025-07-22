import express from 'express';
import bodyParser from 'body-parser';
const MetaApi = require('metaapi.cloud-sdk').default;
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 8080;

app.use(bodyParser.json());

const token = process.env.METAAPI_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

const metaApi = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    if (!symbol || !action || !lot || !sl || !tp) {
      return res.status(400).send('JSON inválido. Falta algún campo.');
    }

    const account = await metaApi.metatraderAccountApi.getAccount(accountId);
    if (account.state !== 'DEPLOYED') {
      return res.status(500).send('La cuenta no está desplegada.');
    }

    const connection = await account.getRPCConnection();
    await connection.connect();

    const order = {
      symbol,
      volume: lot,
      type: action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      sl,
      tp,
      magic: 123456,
    };

    const result = await connection.createMarketOrder(order);
    console.log('Orden ejecutada:', result);

    res.status(200).send('Orden ejecutada correctamente');
  } catch (error) {
    console.error('Error al ejecutar la orden:', error);
    res.status(500).send('Error al ejecutar la orden');
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});

