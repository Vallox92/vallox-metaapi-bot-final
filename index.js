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

  const { symbol, action, lot, sl, tp, units } = data || {};

  if (!symbol || !action || !lot || sl == null || tp == null) {
    console.error('🔴 JSON incompleto o inválido');
    return res.status(400).send('JSON incompleto o inválido');
  }

  try {
    // 1) Traemos info del símbolo (precio actual) para poder convertir POINTS -> precio
    let currentPrice = null;
    try {
      const priceResponse = await axios.get(
        `https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${ACCOUNT_ID}/symbols/${symbol}`,
        { headers: { 'auth-token': TOKEN } }
      );
      currentPrice = priceResponse.data.price ?? priceResponse.data.bid ?? priceResponse.data.ask;
      console.log('💰 currentPrice:', currentPrice);
    } catch (e) {
      console.warn('⚠️ No pude obtener el precio del símbolo, uso stops tal cual vienen');
    }

    const pointValue = 0.01; // Para GOLD en la mayoría de brokers (revisa si en tu cuenta es 0.01)

    // 2) Convertimos SL/TP si vienen en POINTS
    let stopLoss = sl;
    let takeProfit = tp;
    if (units && units.toUpperCase() === 'POINTS' && currentPrice) {
      if (action.toLowerCase() === 'buy') {
        stopLoss = currentPrice - sl * pointValue;
        takeProfit = currentPrice + tp * pointValue;
      } else {
        stopLoss = currentPrice + sl * pointValue;
        takeProfit = currentPrice - tp * pointValue;
      }
    }

    // 3) Construimos el payload final para MetaApi REST
    const payload = {
      actionType: action.toLowerCase() === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      symbol,
      volume: Number(lot),
      stopLoss: stopLoss != null ? Number(stopLoss.toFixed(2)) : undefined,
      takeProfit: takeProfit != null ? Number(takeProfit.toFixed(2)) : undefined
    };

    const url = `https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${ACCOUNT_ID}/trade`;

    console.log('🚀 Enviando orden a MetaApi:', payload);
    console.log('🔗 ->', url);

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
