
// index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 8080;

const TOKEN = process.env.METAAPI_TOKEN || process.env.TOKEN;
const ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID || process.env.ACCOUNT_ID;

if (!TOKEN || !ACCOUNT_ID) {
  console.error('❌ Faltan variables de entorno METAAPI_TOKEN o METAAPI_ACCOUNT_ID');
  process.exit(1);
}

app.use(bodyParser.json());

app.get('/', (_req, res) => res.send('✅ Bot vivo'));

app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📩 Señal recibida:', data);

  const { symbol, action, lot, sl, tp } = data || {};

  // Validación básica
  if (!symbol || !action || lot == null || sl == null || tp == null) {
    console.error('🔴 JSON incompleto o inválido');
    return res.status(400).send('JSON incompleto o inválido');
  }

  // Construimos el payload que espera MetaApi REST
  const payload = {
    actionType: action.toLowerCase() === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
    symbol,
    volume: Number(lot),
    stopLoss: Number(sl),
    takeProfit: Number(tp)
  };

  const url = `https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${ACCOUNT_ID}/trade`;

  console.log('🚀 Enviando orden a MetaApi:', payload);
  console.log('🔗 ->', url);

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'auth-token': TOKEN,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('✅ Orden ejecutada:', response.data);
    return res.status(200).json({ ok: true, result: response.data });
  } catch (err) {
    // Log detallado del error
    const status = err.response?.status;
    const body = err.response?.data;
    console.error('❌ Error al ejecutar orden:', status, body || err.message);
    return res.status(status || 500).json({
      ok: false,
      error: body || err.message
    });
  }
});

app.listen(port, () => {
  console.log(`🟢 Bot escuchando en puerto ${port}`);
});
