const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const token = process.env.TOKEN;
const accountId = process.env.ACCOUNT_ID;

const metaapi = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;

    // Validar estructura del JSON
    if (!data.symbol || !data.action || !data.lot || !data.sl || !data.tp) {
      return res.status(400).json({ error: 'Faltan campos en el JSON' });
    }

    console.log('✅ Señal recibida:', data);

    const account = await metaapi.metatraderAccountApi.getAccount(accountId);

    if (account.state !== 'DEPLOYED') {
      return res.status(400).json({ error: 'La cuenta no está desplegada' });
    }

    if (!account.connectionStatus || account.connectionStatus !== 'CONNECTED') {
      return res.status(400).json({ error: 'La cuenta no está conectada a MetaTrader' });
    }

    const connection = await account.getRPCConnection();
    await connection.connect();

    const action = data.action.toLowerCase();
    const trade = {
      symbol: data.symbol,
      volume: data.lot,
      stopLoss: data.sl,
      takeProfit: data.tp,
      type: action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL'
    };

    const result = await connection.trade(trade);

    if (result.stringCode === 'TRADE_RETCODE_DONE') {
      console.log('🚀 Orden ejecutada correctamente');
      return res.status(200).json({ message: 'Orden ejecutada correctamente' });
    } else {
      console.error('⚠️ Error en la ejecución:', result);
      return res.status(500).json({ error: 'Fallo en ejecución de orden', result });
    }
  } catch (error) {
    console.error('❌ Error general:', error);
    res.status(500).json({ error: 'Error al procesar la orden', details: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Vallox MetaAPI Bot en línea ✅');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express escuchando en el puerto ${PORT}`);
});

