const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;
require('dotenv').config();

const app = express();
const port = 8080;

app.use(bodyParser.json());

const token = process.env.TOKEN;
const accountId = process.env.ACCOUNT_ID;

const api = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  const signal = req.body;
  console.log('📩 Señal recibida:', signal);

  // Validar que los datos estén completos
  if (!signal.symbol || !signal.action || !signal.lot || !signal.sl || !signal.tp) {
    console.log('❌ Error: Faltan datos en la señal');
    return res.status(400).send('Faltan datos en la señal');
  }

  try {
    console.log('🔌 Conectando con MetaApi...');
    const account = await api.metatraderAccountApi.getAccount(accountId);

    if (!account || !accountId) {
      console.log('❌ Cuenta no encontrada o ID no válido');
      return res.status(404).send('Cuenta no encontrada');
    }

    const connection = await account.getRPCConnection();
    await connection.connect();

    console.log('✅ Conectado. Esperando a que esté listo...');
    await connection.waitSynchronized();

    const order = {
      symbol: signal.symbol,
      type: signal.action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      volume: signal.lot,
      stopLoss: signal.sl,
      takeProfit: signal.tp
    };

    console.log('📤 Enviando orden:', order);
    const result = await connection.createMarketOrder(order);

    console.log('✅ Orden ejecutada correctamente:', result);
    res.send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err.message);
    res.status(500).send('Error al ejecutar la orden: ' + err.message);
  }
});

app.listen(port, () => {
  console.log(`🚀 Bot funcionando en el puerto ${port}`);
});
