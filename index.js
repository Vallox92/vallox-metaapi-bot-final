const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;
require('dotenv').config();

const app = express();
const port = 8080;

app.use(bodyParser.json());

const token = process.env.METAAPI_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

const api = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  const data = req.body;

  console.log('📩 Señal recibida:', data);

  if (!data.symbol || !data.action || !data.lot || !data.sl || !data.tp) {
    console.error('❌ JSON inválido');
    return res.status(400).send('JSON inválido');
  }

  try {
    const account = await api.metatraderAccountApi.getAccount(accountId);
    console.log('⏳ Conectando con MetaApi...');
    await account.connect();

    const trade = {
      symbol: data.symbol,
      type: data.action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      volume: data.lot,
      stopLoss: data.sl,
      takeProfit: data.tp,
      comment: 'Orden ejecutada por Vallox',
      magic: 123456,
    };

    const result = await account.executeTrade(trade);

    if (result.stringCode === 'TRADE_RETCODE_DONE') {
      console.log('✅ Orden ejecutada correctamente');
      return res.status(200).send('Orden ejecutada correctamente');
    } else {
      console.error('❌ Falló la orden:', result);
      return res.status(500).send('Fallo en ejecución: ' + result.stringCode);
    }
  } catch (err) {
    console.error('❌ Error general:', err.message);
    return res.status(500).send('Error al ejecutar la orden');
  }
});

app.listen(port, () => {
  console.log(`✅ Bot funcionando en el puerto ${port}`);
});

