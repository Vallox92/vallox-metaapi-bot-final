require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const TOKEN = process.env.METAAPI_TOKEN;
const ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID;
const REGION = process.env.METAAPI_REGION || 'new-york';

const TRADE_URL = `https://mt-client-api-v1.${REGION}.agiliumtrade.ai/users/current/accounts/${ACCOUNT_ID}/trade`;
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

app.post('/webhook', async (req, res) => {
  console.log('📩 Señal recibida:', req.body);

  const { symbol, action, lot, sl, tp } = req.body || {};
  if (!symbol || !action || lot == null || sl == null || tp == null) {
    return res.status(400).send('JSON incompleto o inválido');
  }

  const payload = {
    symbol,
    volume: Number(lot),
    type: action.toLowerCase() === 'buy' ? 'BUY' : 'SELL',
    positionId: null,
    stopLoss: Number(sl),
    takeProfit: Number(tp)
  };

  try {
    console.log('🚀 Enviando orden a MetaApi:', payload);
    const r = await axios.post(TRADE_URL, payload, {
      headers: { 'auth-token': TOKEN, 'Content-Type': 'application/json' },
      httpsAgent
    });
    console.log('✅ Orden ejecutada correctamente:', r.data);
    return res.status(200).send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('❌ Error al ejecutar orden:',
      err.response?.status,
      err.response?.data || err.message
    );
    return res.status(500).send(`Error al ejecutar la orden: ${err.message}`);
  }
});

app.listen(PORT, () => console.log(`🚀 Bot escuchando en puerto ${PORT}`));

