// index.js
import MetaApi from 'metaapi.cloud-sdk';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

const api = new MetaApi(process.env.METAAPI_TOKEN);

app.post('/', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    // Validación básica del JSON
    if (!symbol || !action || !lot || !sl || !tp) {
      return res.status(400).send('Faltan campos en la señal.');
    }

    const account = await api.metatraderAccountApi.getAccount(process.env.ACCOUNT_ID);
    const connection = await account.getRPCConnection();

    await connection.connect();
    if (!connection.isConnected()) {
      return res.status(500).send('No se pudo conectar a MetaApi.');
    }

    const result = await connection.createMarketOrder(symbol, action, lot, 0, {
      stopLoss: sl,
      takeProfit: tp
    });

    console.log('Orden ejecutada:', result);
    res.status(200).send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('Error al ejecutar la orden:', err);
    res.status(500).send('Error al ejecutar la orden');
  }
});

app.listen(port, () => {
  console.log(`Servidor Express activo en el puerto ${port}`);
});
