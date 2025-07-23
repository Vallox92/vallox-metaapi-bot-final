require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
app.use(bodyParser.json());

const port = 8080;
const token = process.env.METAAPI_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

const api = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  const { symbol, action, lot, sl, tp } = req.body;

  console.log('\n📩 Señal recibida:', req.body);
  console.log('🔄 Conectando con MetaApi...');

  try {
    const account = await api.metatraderAccountApi.getAccount(accountId);
    await account.connect();

    console.log('✅ Conectado. Esperando a que esté listo...');
    await account.waitConnected();

    if (!account.connected || !account.accountInformation) {
      throw new Error('⛔️ No está conectado o no hay información de la cuenta.');
    }

    console.log(`📊 Ejecutando orden ${action.toUpperCase()} ${symbol} con lotaje ${lot}`);

    await account.trade().createMarketOrder(symbol, action, lot, {
      stopLoss: sl,
      takeProfit: tp
    });

    console.log('✅ Orden ejecutada correctamente');
    res.send('Orden ejecutada correctamente');

  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err.message);
    res.status(500).send('Error al ejecutar la orden');
  }
});

app.listen(port, () => {
  console.log(`\n🚀 Bot funcionando en el puerto ${port}`);
});
