import MetaApi from 'metaapi.cloud-sdk';
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const api = new MetaApi(process.env.METAAPI_TOKEN);

app.post('/', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    // Validación básica del JSON
    if (!symbol || !action || !lot || !sl || !tp) {
      return res.status(400).send('Error: JSON incompleto o malformado');
    }

    const account = await api.metatraderAccountApi.getAccount(process.env.METAAPI_ACCOUNT_ID);
    const connection = await account.getRPCConnection();
    await connection.connect();

    if (!connection.connected) {
      return res.status(500).send('Error: no se pudo conectar con MetaApi');
    }

    await connection.trade({
      actionType: 'ORDER_TYPE_MARKET',
      symbol,
      volume: lot,
      type: action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      stopLoss: sl,
      takeProfit: tp,
    });

    res.status(200).send('Orden ejecutada correctamente');
  } catch (error) {
    console.error('Error al ejecutar la orden:', error.message);
    res.status(500).send('Error al ejecutar la orden');
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
