require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 8080;

const TOKEN = process.env.METAAPI_TOKEN;
const ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID;

if (!TOKEN || !ACCOUNT_ID) {
  console.error('❌ Falta METAAPI_TOKEN o METAAPI_ACCOUNT_ID en las variables de entorno');
  process.exit(1);
}

app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  console.log('🚀 Señal recibida:', req.body);

  const data = req.body;
  if (!data.symbol || !data.action || !data.lot || !data.sl || !data.tp) {
    console.error('❌ JSON incompleto o inválido');
    return res.status(400).send('JSON incompleto o inválido');
  }

  try {
    console.log('📡 Enviando orden a MetaApi...');

    const response = await axios.post(
      `https://api.metaapi.cloud/users/current/accounts/${ACCOUNT_ID}/trade`,
      {
        actionType: 'ORDER_TYPE_MARKET',
        symbol: data.symbol,
        volume: data.lot,
        type: data.action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
        stopLoss: data.sl,
        takeProfit: data.tp
      },
      { headers: { 'auth-token': TOKEN, 'Content-Type': 'application/json' } }
    );

    console.log('✅ Orden ejecutada correctamente:', response.data);
    res.send('Orden ejecutada correctamente');
  } catch (err) {
    if (err.response) {
      console.error('❌ Error de MetaApi:', err.response.data);
      res.status(err.response.status).send(err.response.data);
    } else {
      console.error('❌ Error general:', err.message || err);
      res.status(500).send(err.message || err);
    }
  }
});

app.listen(port, () => {
  console.log(`✅ Bot escuchando en puerto ${port}`);
});

