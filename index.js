require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const token = process.env.TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;
const api = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    if (!symbol || !action || !lot || !sl || !tp) {
      return res.status(400).json({ error: 'JSON inválido' });
    }

    console.log('📥 Señal recibida:', req.body);

    const account = await api.metatraderAccountApi.getAccount(accountId);

    if (!account || account.state !== 'DEPLOYED') {
      return res.status(500).json({ error: 'Cuenta no desplegada en MetaApi' });
    }

    console.log('🔁 Conectando con MetaApi...');
    const connection = await account.getStreamingConnection();
    await connection.connect();

    if (!connection.isConnected()) {
      return res.status(500).json({ error: 'Error al conectar con MetaApi' });
    }

    const result = await connection.createMarketOrder(symbol, action, lot, {
      stopLoss: sl,
      takeProfit: tp
    });

    console.log('✅ Orden ejecutada correctamente');
    res.status(200).json({ message: 'Orden ejecutada correctamente', result });
  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Bot corriendo en el puerto ${port}`);
});
