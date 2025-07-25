require('dotenv').config();
// (opcional) evita que el error del certificado vuelva a bloquearte
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 8080;

const METAAPI_TOKEN = process.env.METAAPI_TOKEN;
const METAAPI_ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID;
// si usas otra región en MetaApi, cámbiala aquí (ej.: 'london', 'tokyo', etc.)
const METAAPI_REGION = process.env.METAAPI_REGION || 'new-york';

if (!METAAPI_TOKEN || !METAAPI_ACCOUNT_ID) {
  console.error('❌ Faltan variables de entorno METAAPI_TOKEN o METAAPI_ACCOUNT_ID');
  process.exit(1);
}

app.use(bodyParser.json());

// agente https para ignorar validación de certificados (solo mientras resolvemos el 404/SSL)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function sendMarketOrder(signal) {
  const url = `https://mt-client-api-v1.${METAAPI_REGION}.agiliumtrade.ai/users/current/accounts/${METAAPI_ACCOUNT_ID}/trade`;

  const payload = {
    actionType: 'ORDER_TYPE_MARKET',
    symbol: signal.symbol,
    volume: Number(signal.lot),
    type: signal.action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
    stopLoss: Number(signal.sl),
    takeProfit: Number(signal.tp)
  };

  const headers = {
    'auth-token': METAAPI_TOKEN,
    'Content-Type': 'application/json'
  };

  console.log('🚀 Enviando orden a MetaApi:', payload, '->', url);
  const res = await axios.post(url, payload, { headers, httpsAgent });
  return res.data;
}

app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📩 Señal recibida:', data);

  if (!data.symbol || !data.action || data.lot == null || data.sl == null || data.tp == null) {
    console.error('🔴 JSON incompleto o inválido');
    return res.status(400).send('JSON incompleto o inválido');
  }

  try {
    const result = await sendMarketOrder(data);
    console.log('✅ Orden ejecutada correctamente:', result);
    return res.status(200).send('Orden ejecutada correctamente');
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error('❌ Error general:',
      status ? `HTTP ${status}` : '',
      err.message,
      body ? `\nBODY: ${JSON.stringify(body).slice(0, 500)}...` : ''
    );
    return res.status(status || 500).send(`Error al ejecutar la orden: ${err.message}`);
  }
});

app.get('/', (_req, res) => res.send('Bot vivo ✅'));

app.listen(port, () => {
  console.log(`🟢 Bot escuchando en puerto ${port}`);
  console.log(`   Envía tus alertas a: https://<tu-servicio>.onrender.com/webhook`);
});

