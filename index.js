require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // quita el SSL expired

const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const TOKEN = process.env.METAAPI_TOKEN;
const ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID;
const REGION = process.env.METAAPI_REGION || 'new-york';

// Endpoint REST correcto (sin websockets)
const TRADE_URL = `https://mt-client-api-v1.${REGION}.agiliumtrade.ai/users/current/accounts/${ACCOUNT_ID}/trade`;
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

if (!TOKEN || !ACCOUNT_ID) {
  console.error('❌ Falta METAAPI_TOKEN o METAAPI_ACCOUNT_ID en las variables de entorno');
  process.exit(1);
}

app.post('/webhook', async (req, res) => {
  console.log('📩 Señal recibida:', req.body);

  const { symbol, action, lot, sl, tp } = req.body || {};
  if (!symbol || !action || lot == null || sl == null || tp == null) {
    console.error('🔴 JSON incompleto o inválido');
    return res.status(400).send('JSON incompleto o inválido');
  }

  const payload = {
    actionType: 'ORDER_TYPE_MARKET',
    symbol,
    volume: Number(lot),
    type: action.toLowerCase() === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
    stopLoss: Number(sl),
    takeProfit: Number(tp)
  };

  try {
    console.log('🚀 Enviando orden a MetaApi:', payload, '->', TRADE_URL);
    const r = await axios.post(TRADE_URL, payload, {
      headers: { 'auth-token': TOKEN, 'Content-Type': 'application/json' },
      httpsAgent
    });
    console.log('✅ Orden ejecutada correctamente:', r.data);
    return res.status(200).send('Orden ejecutada correctamente');
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error('❌ Error al ejecutar orden:',
      status ? `HTTP ${status}` : '',
      err.message,
      body ? `\nBODY: ${JSON.stringify(body).slice(0, 800)}…` : ''
    );
    return res.status(status || 500).send(`Error al ejecutar la orden: ${err.message}`);
  }
});

app.get('/', (_req, res) => res.send('Bot vivo ✅ /webhook listo'));

app.listen(PORT, () => {
  console.log(`🚀 Bot escuchando en puerto ${PORT}`);
  console.log(`   webhook: /webhook`);
  console.log(`   token? ${!!TOKEN}, accountId: ${ACCOUNT_ID}, region: ${REGION}`);
});

