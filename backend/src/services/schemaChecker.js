// 启动阶段数据库结构检查
// 目标：在关键字段不兼容时快速失败，避免运行时才暴露问题
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

async function getTableColumns(tableName) {
  const rows = await sequelize.query(`SHOW COLUMNS FROM \`${tableName}\``, {
    type: QueryTypes.SELECT
  });
  const result = new Map();
  for (const row of rows) {
    result.set(row.Field, row.Type || '');
  }
  return result;
}

function ensureEnumContains(typeDef, values, tableName, columnName) {
  const normalized = String(typeDef || '').toLowerCase();
  const missing = values.filter(v => !normalized.includes(`'${String(v).toLowerCase()}'`));
  if (missing.length > 0) {
    throw new Error(
      `[SchemaCheck] ${tableName}.${columnName} 缺少枚举值: ${missing.join(', ')}`
    );
  }
}

async function ensureSchemaCompatible() {
  const checks = [
    {
      table: 'stock_predictions',
      requiredColumns: ['stockup_date', 'status'],
      enumChecks: [{ column: 'status', values: ['active', 'success', 'failed', 'abandoned', 'expired'] }]
    },
    {
      table: 'app_logs',
      requiredColumns: ['level', 'source', 'message', 'content']
    }
  ];

  for (const check of checks) {
    const columns = await getTableColumns(check.table);
    for (const column of check.requiredColumns || []) {
      if (!columns.has(column)) {
        throw new Error(`[SchemaCheck] 表 ${check.table} 缺少字段 ${column}`);
      }
    }
    for (const enumCheck of check.enumChecks || []) {
      ensureEnumContains(
        columns.get(enumCheck.column),
        enumCheck.values,
        check.table,
        enumCheck.column
      );
    }
  }
}

module.exports = { ensureSchemaCompatible };
