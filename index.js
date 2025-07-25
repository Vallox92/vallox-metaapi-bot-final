require('dotenv').config();

// <<< Parche para el error "certificate has expired"
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 8080;

const METAAPI_TOKEN = process.env.METAAPI_TOKEN;
const METAAPI_ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID;
const METAAPI_BASE_URL = 'https://metaapi.cloud';

if (!METAAPI_TOKEN || !METAAPI_ACCOUNT_ID) {
  console.error('❌ METAAPI_TOKEN o METAAPI_ACCOUNT_ID no están definidos en las variables de entorno');
  process.exit(1);
}

app.use(bodyParser.json());

// agente https que ignora el certificado expirado
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Envía una orden de mercado a MetaApi vía REST
 */
async function sendMarketOrder(signal) {
  const url = `${METAAPI_BASE_URL}/users/current/accounts/${METAAPI_ACCOUNT_ID}/trade`;

  const payload = {
    actionType: 'ORDER_TYPE_MARKET',
    symbol: signal.symbol,
    volume: Number(signal.lot),
    type: signal.action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
    stopLoss: Number(signal.sl),
    takeProfit: Number(signal.tp)
  };

  console.log('🚀 Enviando orden a MetaApi...', payload);

  const headers = {
    'auth-token': METAAPI_TOKEN,
    'Content-Type': 'application/json'
  };

  const res = await axios.post(url, payload, { headers, httpsAgent });
  return res.data;
}

/**
 * Webhook que recibe la alerta de TradingView
 */
app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📩 Señal recibida:', data);

  // Validar JSON
  if (!data.symbol || !data.action || !data.lot || data.sl == null || data.tp == null) {
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
    console.error('❌ Error general:', err.message, 'status:', status, 'body:', body);
    return res
      .status(status || 500)
      .send(`Error al ejecutar la orden: ${err.message}`);
  }
});

app.get('/', (_req, res) => res.send('Bot vivo ✅'));
app.get('/health', (_req, res) => res.send('ok'));

app.listen(port, () => {
  console.log(`🟢 Bot escuchando en puerto ${port}`);
});
