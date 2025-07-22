const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const MetaApi = require('metaapi.cloud-sdk').default;

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const metaApi = new MetaApi(process.env.TOKEN);

app.post('/', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    // Validación de campos
    if (!symbol || !action || !lot || !sl || !tp) {
      return res.status(400).json({ error: 'Faltan datos en el JSON de la alerta' });
    }

    console.log('✅ Señal recibida:', req.body);

    const account = await metaApi.metatraderAccountApi.getAccount(process.env.METAAPI_ACCOUNT_ID);

    if (!account || account.state !== 'DEPLOYED' || account.connectionStatus !== 'CONNECTED') {
      return res.status(500).json({ error: 'La cuenta no está desplegada o conectada.' });
    }

    const connection = await account.getRPCConnection();
    await connection.connect();

    const result = await connection.createMarketOrder(symbol, action, lot, {
      stopLoss: sl,
      takeProfit: tp
    });

    console.log('✅ Orden ejecutada correctamente:', result);
    res.send('Orden ejecutada correctamente');

  } catch (error) {
    console.error('❌ Error al ejecutar la orden:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Servidor Express corriendo en puerto ${port}`);
});
