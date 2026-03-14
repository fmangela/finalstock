// API 接口参数校验测试
// 使用 supertest 发送 HTTP 请求，验证各接口的入参校验逻辑
// 数据库和定时任务均被 mock，测试不依赖真实数据库连接
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';

// Mock Sequelize：返回空方法对象，避免测试时尝试连接数据库
jest.mock('../src/config/database', () => ({
  define: jest.fn(() => ({
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    findOrCreate: jest.fn(),
    findAndCountAll: jest.fn(),
    upsert: jest.fn(),
    sync: jest.fn(),
  })),
  authenticate: jest.fn().mockResolvedValue(true),
  literal: jest.fn(v => v),
}));

// Mock 定时任务：避免测试时启动 cron 任务
jest.mock('../src/services/scheduler', () => ({
  start: jest.fn(),
  reloadNewsSyncSchedule: jest.fn(),
  buildCronExpr: jest.fn()
}));

const app = require('../src/app');

// ── 健康检查 ──────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('返回 200 和 { status: ok }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ── 回测接口参数校验 ──────────────────────────────────────────
describe('POST /api/backtest/run - 参数校验', () => {
  it('缺少 stock_code 时返回 400', async () => {
    const res = await request(app).post('/api/backtest/run')
      .send({ start_date: '2023-01-01', end_date: '2023-12-31' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(400);
  });

  it('start_date 格式无效时返回 400', async () => {
    const res = await request(app).post('/api/backtest/run')
      .send({ stock_code: '000001', start_date: 'not-a-date', end_date: '2023-12-31' });
    expect(res.status).toBe(400);
  });

  it('strategy_type 不在允许列表时返回 400', async () => {
    const res = await request(app).post('/api/backtest/run')
      .send({ stock_code: '000001', start_date: '2023-01-01', end_date: '2023-12-31', strategy_type: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('initial_capital 低于最小值 1000 时返回 400', async () => {
    const res = await request(app).post('/api/backtest/run')
      .send({ stock_code: '000001', start_date: '2023-01-01', end_date: '2023-12-31', initial_capital: 10 });
    expect(res.status).toBe(400);
  });
});

// ── 模拟买入参数校验 ──────────────────────────────────────────
describe('POST /api/simulation/buy - 参数校验', () => {
  it('缺少 stock_code 时返回 400', async () => {
    const res = await request(app).post('/api/simulation/buy')
      .send({ shares: 100, price: 10.5 });
    expect(res.status).toBe(400);
  });

  it('shares 为 0 时返回 400', async () => {
    const res = await request(app).post('/api/simulation/buy')
      .send({ stock_code: '000001', shares: 0, price: 10.5 });
    expect(res.status).toBe(400);
  });

  it('price 为负数时返回 400', async () => {
    const res = await request(app).post('/api/simulation/buy')
      .send({ stock_code: '000001', shares: 100, price: -1 });
    expect(res.status).toBe(400);
  });
});

// ── 模拟卖出参数校验 ──────────────────────────────────────────
describe('POST /api/simulation/sell - 参数校验', () => {
  it('缺少 position_id 时返回 400', async () => {
    const res = await request(app).post('/api/simulation/sell')
      .send({ price: 10.5 });
    expect(res.status).toBe(400);
  });

  it('price 为 0 时返回 400', async () => {
    const res = await request(app).post('/api/simulation/sell')
      .send({ position_id: 1, price: 0 });
    expect(res.status).toBe(400);
  });
});

// ── AI 选股参数校验 ───────────────────────────────────────────
describe('POST /api/prediction/generate - 参数校验', () => {
  it('缺少 stock_code 时返回 400', async () => {
    const res = await request(app).post('/api/prediction/generate').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/prediction/confirm - 参数校验', () => {
  it('stocks 为空数组时返回 400', async () => {
    const res = await request(app).post('/api/prediction/confirm')
      .send({ stocks: [] });
    expect(res.status).toBe(400);
  });

  it('stocks 中缺少 code 字段时返回 400', async () => {
    const res = await request(app).post('/api/prediction/confirm')
      .send({ stocks: [{ name: 'Test' }] });
    expect(res.status).toBe(400);
  });
});
