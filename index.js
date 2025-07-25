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

// simple healthcheck
app.get('/', (_req, res) => res.send('✅ Bot vivo'));

app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📩 Señal recibida:', data);

  const { symbol, action, lot, sl, tp, units } = data || {};

  // Validación básica
  if (!symbol || !action || lot == null || sl == null || tp == null) {
    console.error('🔴 JSON incompleto o inválido');
    return res.status(400).send('JSON incompleto o inválido');
  }

  // ------------------------------------------------------------------
  // 1) Intentar obtener especificaciones y precio del símbolo
  // ------------------------------------------------------------------
  let currentPrice = null;
  let point = 0.01; // fallback por si no lo obtenemos
  try {
    // intenta obtener specs del símbolo
    const specUrl = `https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${ACCOUNT_ID}/symbols/${symbol}`;
    const specResp = await axios.get(specUrl, {
      headers: { 'auth-token': TOKEN }
    });

    // intenta sacar tickSize/point
    const info = specResp.data || {};
    // algunos campos que pueden venir
    // info.tickSize, info.tickValue, info.digits, info.price
    if (typeof info.tickSize === 'number' && info.tickSize > 0) {
      point = info.tickSize;
    } else if (typeof info.digits === 'number') {
      point = 1 / Math.pow(10, info.digits);
    }

    // precio actual
    currentPrice = info.price || info.bid || info.ask || null;
    console.log('ℹ️ symbol spec:', { point, currentPrice });
  } catch (e) {
    console.warn('⚠️ No pude obtener especificaciones/precio del símbolo, usaré defaults. Motivo:', e.response?.data || e.message);
  }

  // ------------------------------------------------------------------
  // 2) Convertir SL / TP si vienen en POINTS
  // ------------------------------------------------------------------
  let stopLoss = sl;
  let takeProfit = tp;

  const actionIsBuy = action.toLowerCase() === 'buy';
  if (units && units.toUpperCase() === 'POINTS') {
    if (!currentPrice) {
      console.warn('⚠️ No pude obtener el precio del símbolo, uso los stops tal cual vienen (puede fallar con INVALID_STOPS)');
    } else {
      const pointsToPrice = (p) => p * point; // conversión
      if (actionIsBuy) {
        stopLoss = currentPrice - pointsToPrice(sl);
        takeProfit = currentPrice + pointsToPrice(tp);
      } else {
        stopLoss = currentPrice + pointsToPrice(sl);
        takeProfit = currentPrice - pointsToPrice(tp);
      }
    }
  } else {
    // Asumimos que sl/tp ya vienen como precios absolutos
    // (nada que hacer)
  }

  // En caso de que stopLoss/takeProfit queden aún en puntos (porque no hubo precio)
  // los mandamos como venían, pero es probable que MetaApi los rechace.
  // Redondeamos a 2 decimales (ajusta si tu símbolo necesita más)
  if (typeof stopLoss === 'number') stopLoss = Number(stopLoss.toFixed(2));
  if (typeof takeProfit === 'number') takeProfit = Number(takeProfit.toFixed(2));

  // ------------------------------------------------------------------
  // 3) Construir payload MetaApi REST
  // ------------------------------------------------------------------
  const payload = {
    actionType: actionIsBuy ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
    symbol,
    volume: Number(lot),
    stopLoss,
    takeProfit
  };

  const url = `https://mt-client-api-v1.new-york.agiliumtrade.ai/users/current/accounts/${ACCOUNT_ID}/trade`;

  console.log('🚀 Enviando orden a MetaApi:', payload);
  console.log('🔗 ->', url);

  // ------------------------------------------------------------------
  // 4) Enviar
  // ------------------------------------------------------------------
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
