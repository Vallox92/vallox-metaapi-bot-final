import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import MetaApiDefault from 'metaapi.cloud-sdk';

dotenv.config();

const MetaApi = MetaApiDefault.default; // ✅ Soluciona el error
const app = express();
const port = 8080;

app.use(bodyParser.json());

const api = new MetaApi(process.env.TOKEN);

app.post('/webhook', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    if (!symbol || !action || !lot || !sl || !tp) {
      return res.status(400).send('JSON incompleto o mal estructurado');
    }

    const account = await api.metatraderAccountApi.getAccount(process.env.ACCOUNT_ID);
    if (!account || account.state !== 'DEPLOYED') {
      return res.status(500).send('La cuenta no está desplegada o activa');
    }

    const connection = await account.getRPCConnection();
    await connection.connect();

    if (!connection.connected) {
      return res.status(500).send('Error al conectar con la cuenta MetaTrader');
    }

    const result = await connection.createMarketOrder(symbol, action, lot, {
      stopLossInPips: sl,
      takeProfitInPips: tp
    });

    console.log('Orden ejecutada:', result);
    res.send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('Error al ejecutar la orden:', err);
    res.status(500).send('Error al ejecutar la orden');
  }
});

app.listen(port, () => {
  console.log(`Express server is running on port ${port}`);
});
