const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const MetaApi = require('metaapi.cloud-sdk').default;

dotenv.config();

const app = express();
const port = 8080;

app.use(bodyParser.json());

const token = process.env.TOKEN;
const accountId = process.env.ACCOUNT_ID;

const api = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  const { symbol, action, lot, sl, tp } = req.body;

  console.log('🔔 Señal recibida:', req.body);
  console.log('Conectando con MetaApi...');

  try {
    const account = await api.metatraderAccountApi.getAccount(accountId);
    if (!account) throw new Error('Cuenta no encontrada');

    await account.waitConnected();

    if (account.state !== 'DEPLOYED') throw new Error('Cuenta no desplegada');
    if (account.connectionStatus !== 'CONNECTED') throw new Error('Cuenta no conectada');

    const connection = account.getRPCConnection();
    await connection.connect();

    const result = await connection.trade({
      actionType: 'ORDER_TYPE_MARKET',
      symbol,
      volume: lot,
      type: action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      stopLoss: sl,
      takeProfit: tp
    });

    console.log('✅ Orden ejecutada:', result);
    res.status(200).send('Orden ejecutada correctamente');

  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err);
    res.status(500).send('Error al ejecutar la orden: ' + err.message);
  }
});

app.listen(port, () => {
  console.log(`✅ Bot funcionando en el puerto ${port}`);
});

