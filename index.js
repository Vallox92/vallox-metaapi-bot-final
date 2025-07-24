require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const token = process.env.METAAPI_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

const api = new MetaApi(token);

app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📩 Señal recibida:', data);

  try {
    console.log('🔑 Pidiendo cuenta…');
    const account = await api.metatraderAccountApi.getAccount(accountId);

    // --- DEBUG DURO: qué clase es y qué métodos tiene realmente
    console.log('👉 account.constructor.name =', account && account.constructor && account.constructor.name);
    console.log('👉 typeof account =', typeof account);
    if (account) {
      console.log('👉 keys(account) =', Object.keys(account));
      console.log('👉 proto methods =', Object.getOwnPropertyNames(Object.getPrototypeOf(account)));
    }

    console.log('state:', account.state, 'connectionStatus:', account.connectionStatus);

    // También probamos a ver si existen estos métodos antes de llamarlos
    console.log('has getRPCConnection?', typeof account.getRPCConnection);
    console.log('has getStreamingConnection?', typeof account.getStreamingConnection);
    console.log('has connect?', typeof account.connect);
    console.log('has trade?', typeof account.trade);

    return res.send('Debug impreso, revisa logs');
  } catch (err) {
    console.error('❌ Error debug:', err);
    return res.status(500).send(err.message || String(err));
  }
});

app.listen(port, () => {
  console.log(`🟢 Bot escuchando en puerto ${port}`);
});
