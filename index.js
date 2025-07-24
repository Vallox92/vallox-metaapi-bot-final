require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

// ====== ENV ======
const TOKEN = process.env.METAAPI_TOKEN;
const ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID;

if (!TOKEN || !ACCOUNT_ID) {
  console.error('❌ Faltan variables de entorno METAAPI_TOKEN o METAAPI_ACCOUNT_ID');
  process.exit(1);
}

// ====== SDK INIT (forzamos websocket y reconexiones) ======
const api = new MetaApi(TOKEN);
try {
  api._options = api._options || {};
  api._options.useWebsocket = true;
  api._options.reconnectOnError = true;
  api._options.requestTimeout = 60000;
  api._options.socketioClientOptions = {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000
  };
} catch (e) {
  // si la versión del SDK no expone _options, no pasa nada
}

// ====== Helpers ======

async function waitAccountReady(account, maxMs = 120000) {
  console.log('🕐 Esperando a que la cuenta esté DEPLOYED & CONNECTED...');
  const start = Date.now();
  // algunos SDK exponen waitDeployed/waitConnected, otros no. Hacemos fallback.
  if (typeof account.waitDeployed === 'function') {
    await account.waitDeployed();
  } else {
    while (true) {
      const acc = await api.metatraderAccountApi.getAccount(ACCOUNT_ID);
      if (acc.state === 'DEPLOYED') break;
      if (Date.now() - start > maxMs) throw new Error('Timeout esperando DEPLOYED');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (typeof account.waitConnected === 'function') {
    await account.waitConnected();
  } else {
    while (true) {
      const acc = await api.metatraderAccountApi.getAccount(ACCOUNT_ID);
      if (acc.connectionStatus === 'CONNECTED') break;
      if (Date.now() - start > maxMs) throw new Error('Timeout esperando CONNECTED');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log('✅ Cuenta lista (DEPLOYED & CONNECTED)');
}

/**
 * Obtiene un objeto "connection" que realmente permita operar.
 * Intenta distintos caminos porque el SDK ha cambiado nombres/métodos.
 */
async function getOperationConnection(account) {
  console.log('🔎 Descubriendo métodos disponibles en account...');
  const keys = Object.keys(account);
  console.log('   keys(account)=', keys);
  const protoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(account));
  console.log('   proto methods=', protoMethods);

  // 1) Camino clásico: getRPCConnection / getStreamingConnection
  if (typeof account.getRPCConnection === 'function') {
    console.log('➡️ Usando account.getRPCConnection()');
    const conn = await account.getRPCConnection();
    await conn.connect();
    await conn.waitSynchronized?.();
    return { type: 'rpc', conn };
  }
  if (typeof account.getStreamingConnection === 'function') {
    console.log('➡️ Usando account.getStreamingConnection()');
    const conn = await account.getStreamingConnection();
    await conn.connect();
    await conn.waitSynchronized?.();
    return { type: 'stream', conn };
  }

  // 2) Algunos builds traen account.connect() que devuelve algo operable
  if (typeof account.connect === 'function') {
    console.log('➡️ Usando account.connect()');
    const conn = await account.connect();
    await conn.waitSynchronized?.();
    return { type: 'account-connect', conn };
  }

  // 3) Último recurso: operar vía REST del SDK, si está disponible
  if (api.metatraderAccountApi && typeof api.metatraderAccountApi.trade === 'function') {
    console.log('➡️ Usaremos api.metatraderAccountApi.trade() como fallback REST');
    return { type: 'rest', conn: null };
  }

  throw new Error('No encontré ninguna forma de obtener una conexión operable en el SDK instalado.');
}

async function placeOrder(connectionInfo, data) {
  const { type, conn } = connectionInfo;

  const isBuy = data.action.toLowerCase() === 'buy';
  const actionType = isBuy ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL';

  console.log(`🛒 Ejecutando orden (${type}) => ${data.symbol} ${data.action} lot:${data.lot} sl:${data.sl} tp:${data.tp}`);

  // 1) RPC: conn.trade()
  if (type === 'rpc' && conn && typeof conn.trade === 'function') {
    return await conn.trade({
      actionType,
      symbol: data.symbol,
      volume: data.lot,
      type: actionType,
      stopLoss: data.sl,
      takeProfit: data.tp
    });
  }

  // 2) RPC alternativo: conn.createMarketOrder / conn.createMarketBuyOrder
  if (conn && typeof conn.createMarketOrder === 'function') {
    return await conn.createMarketOrder(data.symbol, data.lot, data.sl, data.tp, { comment: 'vallox-bot' }, isBuy ? 'BUY' : 'SELL');
  }
  if (conn && typeof conn.createMarketBuyOrder === 'function' && isBuy) {
    return await conn.createMarketBuyOrder(data.symbol, data.lot, data.sl, data.tp, { comment: 'vallox-bot' });
  }
  if (conn && typeof conn.createMarketSellOrder === 'function' && !isBuy) {
    return await conn.createMarketSellOrder(data.symbol, data.lot, data.sl, data.tp, { comment: 'vallox-bot' });
  }

  // 3) account.connect() suele devolver un objeto con .trade también
  if (conn && typeof conn.trade === 'function') {
    return await conn.trade({
      actionType,
      symbol: data.symbol,
      volume: data.lot,
      type: actionType,
      stopLoss: data.sl,
      takeProfit: data.tp
    });
  }

  // 4) Fallback REST (si existiera)
  if (type === 'rest' && api.metatraderAccountApi && typeof api.metatraderAccountApi.trade === 'function') {
    return await api.metatraderAccountApi.trade(ACCOUNT_ID, {
      actionType,
      symbol: data.symbol,
      volume: data.lot,
      type: actionType,
      stopLoss: data.sl,
      takeProfit: data.tp
    });
  }

  throw new Error('No encontré ningún método para enviar la orden con este SDK.');
}

// ====== RUTA WEBHOOK ======
app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📩 Señal recibida:', data);

  // validación simple
  if (!data.symbol || !data.action || data.lot == null || data.sl == null || data.tp == null) {
    console.error('🔴 JSON incompleto o inválido');
    return res.status(400).send('JSON incompleto o inválido');
  }

  try {
    console.log('🔑 Pidiendo cuenta...');
    const account = await api.metatraderAccountApi.getAccount(ACCOUNT_ID);

    // trazas para ver qué trae el SDK real
    console.log('👉 account.constructor.name =', account?.constructor?.name);
    console.log('👉 typeof account =', typeof account);
    console.log('👉 keys(account) =', Object.keys(account));
    console.log('👉 proto methods =', Object.getOwnPropertyNames(Object.getPrototypeOf(account)));
    console.log('👉 state:', account.state, 'connectionStatus:', account.connectionStatus);
    console.log('👉 has getRPCConnection?', typeof account.getRPCConnection);
    console.log('👉 has getStreamingConnection?', typeof account.getStreamingConnection);
    console.log('👉 has connect?', typeof account.connect);
    console.log('👉 has trade?', typeof account.trade);

    await waitAccountReady(account);

    console.log('🟢 Cuenta desplegada y conectada, intentando obtener conexión operativa...');
    const connectionInfo = await getOperationConnection(account);

    const result = await placeOrder(connectionInfo, data);

    console.log('✅ Orden ejecutada correctamente:', result);
    res.send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err.message || err, err);
    // reintento si es 503 o WebSocket error
    if ((err.status && err.status >= 500) || /websocket|503|poll/i.test(err.message || '')) {
      return res.status(503).send('Servicio temporalmente no disponible (reintenta)');
    }
    res.status(500).send('Error al ejecutar la orden: ' + (err.message || err));
  }
});

// ====== HEALTHCHECK ======
app.get('/', (_req, res) => res.send('OK'));

app.listen(port, () => {
  console.log(`🟢 Bot escuchando en puerto ${port}`);
});

