
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
  try {
    const { symbol, action, lot, sl, tp } = req.body;
    console.log('Señal recibida:', req.body);

    if (!symbol || !action || !lot || !sl || !tp) {
      console.error('Error: Datos incompletos en la señal');
      return res.status(400).json({ error: 'Datos incompletos en la señal' });
    }

    const account = await api.metatraderAccountApi.getAccount(accountId);
    if (!account || account.state !== 'DEPLOYED') {
      console.error('Error: Cuenta no está desplegada o no existe');
      return res.status(400).json({ error: 'Cuenta no desplegada o no encontrada' });
    }

    const connection = account.getRPCConnection();
    await connection.connect();

    const order = await connection.createMarketOrder(symbol, action, lot, {
      stopLoss: sl,
      takeProfit: tp
    });

    console.log('Orden ejecutada:', order);
    res.status(200).json({ message: 'Orden ejecutada correctamente', order });

  } catch (err) {
    console.error('Error al ejecutar la orden:', err.message || err);
    res.status(500).json({ error: err.message || err });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor Express corriendo en el puerto ${port}`);
});
