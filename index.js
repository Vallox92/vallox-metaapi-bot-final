import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import MetaApi from 'metaapi.cloud-sdk';

dotenv.config();

const {
  PORT = 10000,
  WEBHOOK_PASSPHRASE,
  METAAPI_TOKEN,
  METAAPI_ACCOUNT_ID,
  DEFAULT_RISK_PCT = 1,
  DAILY_TARGET_PCT = 2,
  DAILY_MAX_LOSS_PCT = 2
} = process.env;

// ===== Seguridad básica =====
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));
app.use(rateLimit({ windowMs: 60 * 1000, max: 30 })); // 30 req/min

// ===== MetaApi init =====
const metaapi = new MetaApi(METAAPI_TOKEN);
let account, connection;

// ===== Estado en memoria (simple) =====
let dayStartEquity = null;
let tradingEnabled = true;
let currentDay = null;

async function initMetaApi() {
  account = await metaapi.metatraderAccountApi.getAccount(METAAPI_ACCOUNT_ID);
  if (account.state !== 'DEPLOYED') {
    console.log('Esperando a que la cuenta se despliegue...');
    await account.deploy();
  }
  if (account.connectionStatus !== 'CONNECTED') {
    console.log('Esperando conexión a broker...');
    await account.waitConnected();
  }
  connection = account.getRPCConnection();
  await connection.connect();
  console.log('MetaApi conectado ✅');
}
initMetaApi().catch(console.error);

// ===== Helpers =====
function resetDailyIfNeeded(equity) {
  const d = new Date();
  const day = d.getUTCDate();
  if (currentDay === null || day !== currentDay) {
    currentDay = day;
    dayStartEquity = equity;
    tradingEnabled = true;
    console.log('🔄 Nuevo día UTC, reseteando límites diarios');
  }
}

function checkDailyLimits(equity) {
  const pnlPct = ((equity - dayStartEquity) / dayStartEquity) * 100;
  if (pnlPct >= DAILY_TARGET_PCT || pnlPct <= -DAILY_MAX_LOSS_PCT) {
    tradingEnabled = false;
    console.log(`⚠️ Bot apagado por límites diarios. PnL%: ${pnlPct.toFixed(2)}`);
  }
  return pnlPct;
}

async function fetchEquity() {
  const accountInfo = await connection.getAccountInformation();
  return accountInfo.equity;
}

async function calcPositionSize(symbol, entry, stop, riskPct) {
  const equity = await fetchEquity();
  const riskMoney = (equity * riskPct) / 100;

  const spec = await connection.getSymbolSpecification(symbol);
  // Para MT4/MT5: valor de 1 pip = tickValue * (pipSize / tickSize)
  const pipSize = Math.pow(10, -spec.digits);
  const pipValue = spec.tickValue * (pipSize / spec.tickSize);

  const stopDistance = Math.abs(entry - stop);
  const stopPips = stopDistance / pipSize;

  const riskPerLot = stopPips * pipValue * spec.contractSize;
  const lot = riskPerLot > 0 ? riskMoney / riskPerLot : 0.01;
  return Math.max(0.01, Number(lot.toFixed(2))); // redondea
}

// ===== Endpoint de salud =====
app.get('/', (req, res) => {
  res.json({ status: 'ok', tradingEnabled });
});

// ===== Endpoint webhook =====
app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;

    if (!data || data.passphrase !== WEBHOOK_PASSPHRASE) {
      return res.status(401).json({ error: 'Passphrase inválida' });
    }

    const { action, symbol, lot, sl, tp, riskPct, comment } = data;

    if (!action || !symbol) {
      return res.status(400).json({ error: 'action y symbol son obligatorios' });
    }

    // Actualiza equity, límites diarios
    const equity = await fetchEquity();
    resetDailyIfNeeded(equity);
    const pnlPct = checkDailyLimits(equity);

    if (!tradingEnabled) {
      return res.status(200).json({ status: 'off', reason: 'Límites diarios alcanzados', pnlPct });
    }

    const price = (await connection.getSymbolPrice(symbol)).bid;
    const _riskPct = riskPct || DEFAULT_RISK_PCT;

    let _lot = lot;
    let _sl = sl;
    let _tp = tp;

    if (!_sl || !_tp) {
      return res.status(400).json({ error: 'SL y TP son requeridos en esta versión' });
    }

    if (!_lot) {
      _lot = await calcPositionSize(symbol, price, _sl, _riskPct);
    }

    const orderRequest = {
      symbol,
      volume: _lot,
      type: action.toLowerCase() === 'buy' ? 'POSITION_TYPE_BUY' : 'POSITION_TYPE_SELL',
      stopLoss: _sl,
      takeProfit: _tp,
      comment: comment || 'Road2Vallox BOT v1'
    };

    console.log('📨 Orden recibida:', orderRequest);

    const result = await connection.createMarketOrder(orderRequest.symbol, orderRequest.type, orderRequest.volume, orderRequest.stopLoss, orderRequest.takeProfit, { comment: orderRequest.comment });

    console.log('✅ Orden ejecutada:', result);
    res.json({ status: 'ok', order: result, pnlPct, tradingEnabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Road2Vallox BOT escuchando en puerto ${PORT}`);
});
