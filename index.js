require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const token = process.env.METAAPI_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

/**
 * Devuelve un string con los métodos públicos de un objeto (para depurar fácilmente en Render).
 */
function listProtoMethods(obj) {
  try {
    const proto = Object.getPrototypeOf(obj);
    return Object.getOwnPropertyNames(proto).filter(k => typeof obj[k] === 'function');
  } catch (e) {
    return [];
  }
}

/**
 * Intenta colocar una orden usando cualquiera de los métodos que existan
 * según la versión del SDK instalada.
 */
async function placeOrderSmart(connection, data) {
  // 1) Implementación “nueva” basada en connection.trade(...)
  if (connection && typeof connection.trade === 'function') {
    return connection.trade({
      actionType: 'ORDER_TYPE_MARKET',
      symbol: data.symbol,
      volume: data.lot,
      type: data.action === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      stopLoss: data.sl,
      takeProfit: data.tp
    });
  }

  // 2) Implementaciones alternativas (probamos conocidos)
  const candidates = [
    'createMarketOrder',
    'createMarketBuyOrder',
    'createMarketSellOrder',
    'createMarketBuy',
    'createMarketSell'
  ];

  for (const m of candidates) {
    if (connection && typeof connection[m] === 'function') {
      if (m.toLowerCase().includes('buy')) {
        return connection[m](data.symbol, data.lot, data.sl, data.tp);
      } else if (m.toLowerCase().includes('sell')) {
        return connection[m](data.symbol, data.lot, data.sl, data.tp);
      } else {
        // método genérico createMarketOrder(symbol, volume, side, sl, tp)
        const side = data.action === 'buy' ? 'buy' : 'sell';
        return connection[m](data.symbol, data.lot, side, data.sl, data.tp);
      }
    }
  }

  throw new Error(
    `No encontré ningún método de trading soportado en la conexión. Métodos disponibles: ${listProtoMethods(connection).join(', ')}`
  );
}

app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📨 Señal recibida:', data);

  if (!data.symbol || !data.action || !data.lot || !data.sl || !data.tp) {
    console.error('🔴 JSON incompleto o inválido');
    return res.status(400).send('JSON incompleto o inválido');
  }

  try {
    console.log('🔑 Creando cliente MetaApi…');
    const api = new MetaApi(token);

    console.log('🟡 Pidiendo cuenta…');
    const account = await api.metatraderAccountApi.getAccount(accountId);

    console.log('🛠  account.constructor.name =', account?.constructor?.name);
    console.log('🛠  typeof account =', typeof account);
    console.log('🛠  keys(account) =', Object.keys(account));
    console.log('🛠  proto methods =', listProtoMethods(account));
    console.log('🟢 state:', account.state, 'connectionStatus:', account.connectionStatus);

    if (account.state !== 'DEPLOYED') {
      console.error('🔴 La cuenta NO está desplegada en MetaApi.');
      return res.status(500).send('La cuenta no está desplegada en MetaApi.');
    }
    if (account.connectionStatus !== 'CONNECTED') {
      console.error('🔴 La cuenta NO está conectada en MetaApi.');
      return res.status(500).send('La cuenta no está conectada en MetaApi.');
    }

    console.log('⏳ Esperando a que la cuenta esté conectada del todo (waitConnected)…');
    if (typeof account.waitConnected === 'function') {
      await account.waitConnected();
    } else if (typeof account.waitDeployed === 'function') {
      // fallback por si solo existe waitDeployed
      await account.waitDeployed();
    }

    // ==== OBTENER CONEXIÓN ====
    let connection;
    if (typeof account.getRPCConnection === 'function') {
      console.log('🔌 Usando account.getRPCConnection()');
      connection = account.getRPCConnection();
    } else if (typeof account.getStreamingConnection === 'function') {
      console.log('🔌 Usando account.getStreamingConnection()');
      connection = account.getStreamingConnection();
    } else if (typeof account.connect === 'function') {
      console.log('🔌 Usando account.connect()');
      connection = await account.connect();
    } else {
      console.error('🔴 Ningún método de conexión disponible en esta versión del SDK.');
      console.log('🛠 Métodos en account:', listProtoMethods(account));
      return res.status(500).send('SDK incompatible: no hay getRPCConnection/getStreamingConnection/connect en account.');
    }

    console.log('🛠  proto methods (connection) =', listProtoMethods(connection));

    if (typeof connection.connect === 'function') {
      await connection.connect();
    }
    if (typeof connection.waitSynchronized === 'function') {
      console.log('⏳ Esperando sincronización...');
      await connection.waitSynchronized();
    }

    // ==== HACER LA OPERACIÓN ====
    console.log('🚀 Enviando orden...');
    const result = await placeOrderSmart(connection, data);

    console.log('✅ Orden ejecutada correctamente:', result);
    return res.send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err.message || err);
    return res.status(500).send('Error al ejecutar la orden: ' + (err.message || err));
  }
});

app.listen(port, () => {
  console.log(`🟢 Bot escuchando en puerto ${port}`);
});
