require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const api = new MetaApi(process.env.TOKEN);
const accountId = process.env.METAAPI_ACCOUNT_ID;

app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;

    console.log('📩 Señal recibida:', data);

    // Validar estructura básica
    if (!data.symbol || !data.action || !data.lot || !data.sl || !data.tp) {
      return res.status(400).json({ error: 'Faltan campos en el JSON (symbol, action, lot, sl, tp)' });
    }

    // Obtener cuenta
    const account = await api.metatraderAccountApi.getAccount(accountId);
    const rpc = await account.getRPCConnection();
    await rpc.connect();

    if (!rpc.connected) {
      return res.status(500).json({ error: 'No se pudo conectar con la cuenta MetaApi' });
    }

    // Calcular SL y TP en puntos (1 punto = 0.1 pip)
    const slPoints = data.sl * 10;
    const tpPoints = data.tp * 10;

    // Ejecutar orden
    const result = await rpc.trade({
      actionType: 'ORDER_TYPE_MARKET',
      symbol: data.symbol,
      volume: data.lot,
      type: data.action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      sl: slPoints,
      tp: tpPoints,
      magic: 123456,
    });

    console.log('✅ Orden ejecutada:', result);

    res.status(200).json({ message: 'Orden ejecutada correctamente' });

  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err);
    res.status(500).json({ error: err.message || 'Error desconocido' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Bot corriendo en el puerto ${port}`);
});

