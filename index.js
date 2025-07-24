require('dotenv').config();
const express = require('express');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = process.env.PORT || 8080;

const token = process.env.META_API_TOKEN;
const accountId = process.env.META_API_ACCOUNT_ID;

const api = new MetaApi(token);
app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    const { symbol, action, lot, sl, tp } = req.body;

    if (!symbol || !action || !lot || !sl || !tp) {
      console.log('⚠️ JSON incompleto:', req.body);
      return res.status(400).send('JSON inválido. Faltan campos.');
    }

    const account = await api.metatraderAccountApi.getAccount(accountId);
    if (!account || account.state !== 'DEPLOYED') {
      console.log('⚠️ Cuenta no desplegada:', accountId);
      return res.status(500).send('Cuenta no desplegada o incorrecta.');
    }

    console.log('⏳ Conectando a la cuenta...');
    const connection = await account.getRPCConnection();
    await connection.connect();

    if (!connection.isConnected()) {
      console.log('❌ No se pudo conectar a MetaApi');
      return res.status(500).send('No se pudo conectar a MetaApi');
    }

    console.log('✅ Conectado. Enviando orden:', { symbol, action, lot, sl, tp });

    await connection.trade({
      actionType: 'ORDER_TYPE_MARKET',
      symbol,
      volume: lot,
      type: action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      stopLoss: sl,
      takeProfit: tp
    });

    console.log('✅ Orden ejecutada correctamente');
    res.send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('🔥 Error al ejecutar orden:', err);
    res.status(500).send('Error al ejecutar orden');
  }
});

app.listen(port, () => {
  console.log(`🚀 Bot de trading escuchando en el puerto ${port}`);
});
