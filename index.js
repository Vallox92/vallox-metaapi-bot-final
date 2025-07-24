require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 8080;

const TOKEN = process.env.METAAPI_TOKEN;
const ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID;

// Seguridad básica
if (!TOKEN || !ACCOUNT_ID) {
  console.error('❌ Faltan METAAPI_TOKEN o METAAPI_ACCOUNT_ID en las variables de entorno');
  process.exit(1);
}

app.use(bodyParser.json());

/**
 * Normaliza los símbolos que vienen de TradingView (XAUUSD, XAUUSDm, GOLD, etc.)
 */
function normalizeSymbol(symbol) {
  const s = symbol.toUpperCase();
  if (s === 'GOLD' || s === 'XAUUSD') return 'XAUUSD';
  return s;
}

/**
 * Convierte "buy"/"sell" a los tipos que espera MetaApi en REST
 */
function sideToOrderType(action) {
  return action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL';
}

app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📩 Señal recibida:', data);

  // Validación rápida
  if (!data || !data.symbol || !data.action || !data.lot || !data.sl || !data.tp) {
    console.error('🔴 JSON incompleto o inválido');
    return res.status(400).send('JSON incompleto o inválido');
  }

  const symbol = normalizeSymbol(data.symbol);
  const volume = Number(data.lot);
  const stopLoss = Number(data.sl);
  const takeProfit = Number(data.tp);
  const orderType = sideToOrderType(data.action);

  try {
    console.log('🔑 Ejecutando orden vía REST…');

    // Documentación REST (trade) de MetaApi:
    // POST https://api.metaapi.cloud/users/current/accounts/{accountId}/trade
    const url = `https://api.metaapi.cloud/users/current/accounts/${ACCOUNT_ID}/trade`;
    const payload = {
      actionType: 'ORDER_TYPE_MARKET',
      symbol,
      volume,
      type: orderType,
      stopLoss,
      takeProfit
    };

    const headers = {
      'auth-token': TOKEN,
      'Content-Type': 'application/json'
    };

    const resp = await axios.post(url, payload, { headers });

    console.log('✅ Orden enviada. Respuesta:', JSON.stringify(resp.data, null, 2));
    return res.status(200).send('Orden enviada correctamente');
  } catch (err) {
    if (err.response) {
      console.error('❌ Error REST:', err.response.status, err.response.data);
      return res
        .status(err.response.status)
        .send(`Error REST (${err.response.status}): ${JSON.stringify(err.response.data)}`);
    }
    console.error('❌ Error general:', err.message || err);
    return res.status(500).send(`Error general: ${err.message || err}`);
  }
});

app.get('/', (_req, res) => res.send('Bot MetaApi REST corriendo 👌'));

app.listen(port, () => {
  console.log(`🟢 Bot escuchando en puerto ${port}`);
});
