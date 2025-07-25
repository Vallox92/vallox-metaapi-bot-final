require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const token = process.env.METAAPI_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

if (!token || !accountId) {
  console.error('❌ Faltan variables de entorno METAAPI_TOKEN o METAAPI_ACCOUNT_ID');
  process.exit(1);
}

const api = new MetaApi(token);

// ====== MAPEOS DE SÍMBOLOS POR BROKER ======
const SYMBOL_MAP = {
  XAUUSD: 'GOLD',
  XAUUSDm: 'GOLD',
  // agrega aquí los que necesites
};

function mapSymbol(sym) {
  const s = (sym || '').toUpperCase();
  return SYMBOL_MAP[s] || sym;
}

app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📩 Señal recibida:', data);

  if (!data.symbol || !data.action || !data.lot || !data.sl || !data.tp) {
    console.error('🔴 JSON incompleto o inválido');
    return res.status(400).send('JSON incompleto o inválido');
  }

  // Normalizamos símbolo para el broker
  const symbol = mapSymbol(data.symbol);

  try {
    console.log('🔑 Pidiendo cuenta…');
    const account = await api.metatraderAccountApi.getAccount(accountId);

    console.log('👉 state:', account.state, 'connectionStatus:', account.connectionStatus);

    // Espera a que esté DEPLOYED & CONNECTED
    await account.waitConnected();
    console.log('✅ Cuenta lista (DEPLOYED & CONNECTED)');

    // Usamos el cliente REST interno del SDK (más estable que los métodos antiguos)
    const httpClient = api.metatraderAccountApi._httpClient; // interno pero funciona
    const baseUrl = httpClient._host; // host actual que usa el SDK

    // Construimos payload con el formato que acepta el REST de MetaApi
    const payload = {
      symbol,
      volume: Number(data.lot),
      type: data.action.toLowerCase() === 'buy' ? 'BUY' : 'SELL', // <-- tipo correcto
      positionId: null,
      stopLoss: Number(data.sl),
      takeProfit: Number(data.tp)
    };

    console.log('🚀 Enviando orden a MetaApi:', payload);

    const url = `${baseUrl}/users/current/accounts/${accountId}/trade`;
    const response = await httpClient.request({
      url,
      method: 'POST',
      data: payload
    });

    console.log('✅ Orden ejecutada:', response.data);
    res.send(response.data);
  } catch (err) {
    // Intenta imprimir mensaje legible
    const status = err?.response?.status;
    const body = err?.response?.data;
    console.error('❌ Error al ejecutar orden:',
      status ? `HTTP ${status}` : '',
      body ? JSON.stringify(body) : err.message || err);

    res.status(500).send(
      'Error al ejecutar la orden: ' +
      (body ? JSON.stringify(body) : (err.message || 'desconocido'))
    );
  }
});

app.get('/', (_, res) => res.send('Bot ok'));
app.listen(port, () => console.log(`🟢 Bot escuchando en puerto ${port}`));


