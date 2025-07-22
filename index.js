const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const MetaApi = require('metaapi.cloud-sdk').default;

dotenv.config();

const app = express();
const port = 8080;

app.use(bodyParser.json());

const token = process.env.METAAPI_TOKEN;
const accountId = process.env.METAAPI_ACCOUNT_ID;

const api = new MetaApi(token);

app.post('/', async (req, res) => {
  const { symbol, action, lot, sl, tp } = req.body;

  // Validación de estructura
  if (!symbol || !action || !lot || !sl || !tp) {
    console.error('❌ Error: JSON mal estructurado');
    return res.status(400).json({ error: 'JSON mal estructurado' });
  }

  console.log('🚀 Señal recibida:', req.body);
  console.log('⏳ Conectando con MetaApi...');

  try {
    const account = await api.metatraderAccountApi.getAccount(accountId);

    if (!account || !account.id) {
      throw new Error('Cuenta MetaApi no válida o no encontrada');
    }

    // Conectamos correctamente usando la versión 6.3.2
    await account.connect();

    // Esperamos hasta que esté listo
    await account.waitConnected();

    const connection = account.getAccountConnection();

    if (!connection) {
      throw new Error('No se pudo obtener conexión a la cuenta');
    }

    const position = await connection.createMarketOrder(symbol, action, lot, {
      stopLoss: sl,
      takeProfit: tp
    });

    console.log('✅ Orden ejecutada:', position);
    res.status(200).send('Orden ejecutada correctamente');
  } catch (err) {
    console.error('❌ Error al ejecutar la orden:', err.message || err);
    res.status(500).json({ error: err.message || 'Error desconocido' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Bot corriendo en el puerto ${port}`);
});
