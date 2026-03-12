<template>
  <div>
    <el-card shadow="hover">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>股票回测</span>
          <el-button type="primary" @click="openStockDialog">选择股票</el-button>
        </div>
      </template>

      <!-- 当前选股 -->
      <div v-if="form.stock_code" class="selected-stock">
        <el-tag type="primary" size="large">{{ form.stock_name }} ({{ form.stock_code }})</el-tag>
        <el-button type="text" @click="openStockDialog">更换股票</el-button>
      </div>
      <div v-else class="tip-text">请点击"选择股票"按钮从LLM选股的股票中选择</div>

      <!-- 回测参数配置 -->
      <el-form :model="form" label-width="120px" style="margin-top:20px;max-width:900px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开始日期">
              <el-date-picker v-model="form.start_date" type="date" placeholder="选择开始日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束日期">
              <el-date-picker v-model="form.end_date" type="date" placeholder="选择结束日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="初始资金">
              <el-input-number v-model="form.initial_capital" :min="10000" :step="10000" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="选择策略">
              <el-select v-model="form.strategy_id" placeholder="请选择策略" style="width:100%" @change="onStrategyChange">
                <el-option v-for="s in strategyList" :key="s.id" :label="s.name" :value="s.id">
                  <span>{{ s.name }}</span>
                  <span style="color:#999;font-size:12px;margin-left:8px">{{ s.category }}</span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 策略实例选择 -->
        <el-row :gutter="20" v-if="form.strategy_id">
          <el-col :span="12">
            <el-form-item label="策略实例">
              <el-select v-model="form.strategy_instance_id" placeholder="选择保存的实例" clearable style="width:100%" @change="onInstanceChange">
                <el-option v-for="ins in instanceList" :key="ins.id" :label="ins.name" :value="ins.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="selectedStrategy">
            <el-form-item label="实例名称">
              <el-input v-model="form.instance_name" placeholder="保存为新实例" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 动态策略参数 -->
        <div v-if="selectedStrategy" class="strategy-params">
          <div class="params-title">{{ selectedStrategy.name }} 参数配置</div>
          
          <!-- 均线策略参数 -->
          <template v-if="selectedStrategy.strategy_type === 'ma' || selectedStrategy.strategy_type === 'ma_cross'">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item>
                  <template #label>
                    短期均线
                    <el-tooltip content="短期均线的周期天数，如5日均线" placement="top">
                      <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                  <el-input-number v-model="form.params.short_period" :min="1" :max="60" style="width:100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item>
                  <template #label>
                    长期均线
                    <el-tooltip content="长期均线的周期天数，如20日均线" placement="top">
                      <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                  <el-input-number v-model="form.params.long_period" :min="5" :max="120" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>
          </template>

          <!-- RSI策略参数 -->
          <template v-if="selectedStrategy.strategy_type === 'rsi'">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item>
                  <template #label>
                    RSI周期
                    <el-tooltip content="计算RSI的天数周期，常用14天" placement="top">
                      <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                  <el-input-number v-model="form.params.rsi_period" :min="1" :max="30" style="width:100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item>
                  <template #label>
                    超卖阈值
                    <el-tooltip content="RSI低于此值时视为超卖，可能出现买入信号" placement="top">
                      <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                  <el-input-number v-model="form.params.oversold" :min="10" :max="50" style="width:100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item>
                  <template #label>
                    超买阈值
                    <el-tooltip content="RSI高于此值时视为超买，可能出现卖出信号" placement="top">
                      <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                  <el-input-number v-model="form.params.overbought" :min="50" :max="90" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>
          </template>

          <!-- MACD策略参数 -->
          <template v-if="selectedStrategy.strategy_type === 'macd'">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item>
                  <template #label>
                    快线周期
                    <el-tooltip content="MACD快速EMA的周期，常用12天" placement="top">
                      <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                  <el-input-number v-model="form.params.fast_period" :min="1" :max="30" style="width:100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item>
                  <template #label>
                    慢线周期
                    <el-tooltip content="MACD慢速EMA的周期，常用26天" placement="top">
                      <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                  <el-input-number v-model="form.params.slow_period" :min="5" :max="60" style="width:100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item>
                  <template #label>
                    信号线周期
                    <el-tooltip content="DEA信号线的周期，常用9天" placement="top">
                      <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                  <el-input-number v-model="form.params.signal_period" :min="1" :max="20" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>
          </template>

          <!-- 布林带策略参数 -->
          <template v-if="selectedStrategy.strategy_type === 'boll'">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item>
                  <template #label>
                    布林带周期
                    <el-tooltip content="计算布林带中轨的周期天数，常用20天" placement="top">
                      <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                  <el-input-number v-model="form.params.boll_period" :min="5" :max="50" style="width:100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item>
                  <template #label>
                    标准差倍数
                    <el-tooltip content="布林带上下轨与中轨的距离倍数，常用2倍" placement="top">
                      <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                  <el-input-number v-model="form.params.std_dev" :min="1" :max="4" :step="0.5" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>
          </template>

          <!-- 突破策略参数 -->
          <template v-if="selectedStrategy.strategy_type === 'breakout'">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item>
                  <template #label>
                    周期
                    <el-tooltip content="计算前N天的最高价和最低价作为突破阈值" placement="top">
                      <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </template>
                  <el-input-number v-model="form.params.breakout_period" :min="5" :max="60" style="width:100%" />
                </el-form-item>
              </el-col>
            </el-row>
          </template>

          <!-- 通用参数：止盈止损 -->
          <el-divider>止盈止损设置</el-divider>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item>
                <template #label>
                  止损比例
                  <el-tooltip content="亏损达到此比例时强制卖出，如5%表示亏损超过5%就止损" placement="top">
                    <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </template>
                <el-input-number v-model="form.params.stop_loss_pct" :min="0" :max="0.5" :step="0.01" :precision="2" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item>
                <template #label>
                  止盈比例
                  <el-tooltip content="盈利达到此比例时自动卖出，如15%表示盈利超过15%就止盈" placement="top">
                    <el-icon style="margin-left:4px;cursor:help"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </template>
                <el-input-number v-model="form.params.take_profit_pct" :min="0" :max="1" :step="0.01" :precision="2" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <el-form-item>
          <el-button type="primary" @click="runBacktest" :loading="running" :disabled="!form.stock_code || !form.start_date || !form.end_date || !form.strategy_id">
            开始回测
          </el-button>
          <el-button type="success" @click="saveInstance" :disabled="!form.strategy_id || !form.instance_name" :loading="savingInstance">
            保存实例
          </el-button>
          <el-button @click="resetForm">重置参数</el-button>
          <el-button type="info" @click="openInstanceManageDialog">管理实例</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 回测结果展示 -->
    <el-card v-if="result" shadow="hover" style="margin-top:16px">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>回测结果 - {{ result.stock_name }} ({{ result.stock_code }}) <el-tag size="small" type="success" style="margin-left:8px">{{ selectedStrategy?.name }}</el-tag></span>
          <el-button type="text" @click="result = null">关闭结果</el-button>
        </div>
      </template>

      <!-- 核心指标 -->
      <el-row :gutter="20" class="result-stats">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">总收益率</div>
            <div class="stat-value" :class="Number(result.total_return) >= 0 ? 'positive' : 'negative'">
              {{ Number(result.total_return || 0).toFixed(2) }}%
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">年化收益率</div>
            <div class="stat-value" :class="Number(result.annual_return) >= 0 ? 'positive' : 'negative'">
              {{ Number(result.annual_return || 0).toFixed(2) }}%
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">最大回撤</div>
            <div class="stat-value negative">{{ Number(result.max_drawdown || 0).toFixed(2) }}%</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">夏普比率</div>
            <div class="stat-value">{{ Number(result.sharpe_ratio || 0).toFixed(2) }}</div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="20" class="result-stats">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">总交易次数</div>
            <div class="stat-value">{{ result.total_trades }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">盈利次数</div>
            <div class="stat-value positive">{{ result.profit_trades }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">亏损次数</div>
            <div class="stat-value negative">{{ result.loss_trades }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">胜率</div>
            <div class="stat-value" :class="Number(result.win_rate) >= 50 ? 'positive' : 'negative'">
              {{ Number(result.win_rate || 0).toFixed(2) }}%
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- K线图表 -->
      <div v-if="result.kline_data && result.kline_data.length > 0" class="chart-section">
        <div class="section-title">股票走势与买卖点</div>
        <div ref="chartRef" style="width: 100%; height: 400px;"></div>
      </div>

      <!-- 资金曲线 -->
      <div class="chart-section">
        <div class="section-title">资金曲线</div>
        <div class="equity-curve">
          <div v-for="(point, idx) in getEquityCurve()" :key="idx" 
               class="curve-point" 
               :style="{left: idx / (getEquityCurve().length - 1 || 1) * 100 + '%', bottom: ((point.value - minEquity) / ((maxEquity - minEquity) || 1) * 100) + '%'}"
               :title="point.date + ': ' + point.value">
          </div>
          <div class="curve-line" :style="{background: Number(result.total_return) >= 0 ? '#f56c6c' : '#67c23a'}"></div>
        </div>
        <div class="curve-labels">
          <span>{{ result.start_date }}</span>
          <span>初始: {{ Number(result.initial_capital || 0).toFixed(0) }}</span>
          <span>最终: {{ Number(result.final_capital || 0).toFixed(0) }}</span>
          <span>{{ result.end_date }}</span>
        </div>
      </div>

      <!-- 交易记录 -->
      <div class="trades-section">
        <div class="section-title">交易记录</div>
        <el-table :data="getTrades()" stripe max-height="350">
          <el-table-column prop="date" label="交易日期" width="100" />
          <el-table-column prop="type" label="操作" width="70">
            <template #default="{ row }">
              <el-tag :type="row.type === 'buy' ? 'primary' : 'success'" size="small">
                {{ row.type === 'buy' ? '买入' : '卖出' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="price" label="股价" width="80">
            <template #default="{ row }">{{ Number(row.price || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="shares" label="股数" width="80" />
          <el-table-column prop="amount" label="交易金额" width="100">
            <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="account_balance" label="账户余额" width="100">
            <template #default="{ row }">{{ row.account_balance ? formatMoney(row.account_balance) : '-' }}</template>
          </el-table-column>
          <el-table-column prop="profit" label="收益" width="80">
            <template #default="{ row }">
              <span v-if="row.profit !== undefined" :class="row.profit >= 0 ? 'positive' : 'negative'">
                {{ row.profit >= 0 ? '+' : '' }}{{ formatMoney(row.profit) }}
              </span>
              <span v-else style="color:#999">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="hold_days" label="持仓天数" width="80">
            <template #default="{ row }">
              <span v-if="row.hold_days !== undefined">{{ row.hold_days }}天</span>
              <span v-else style="color:#999">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="price_change" label="持仓涨跌" width="85">
            <template #default="{ row }">
              <span v-if="row.price_change !== undefined" :class="row.price_change >= 0 ? 'positive' : 'negative'">
                {{ row.price_change >= 0 ? '+' : '' }}{{ row.price_change.toFixed(2) }}%
              </span>
              <span v-else style="color:#999">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="sell_reason" label="卖出原因" width="85">
            <template #default="{ row }">
              <el-tag v-if="row.sell_reason" :type="getSellReasonType(row.sell_reason)" size="small">
                {{ row.sell_reason }}
              </el-tag>
              <span v-else style="color:#999">-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 历史回测记录 -->
    <el-card shadow="hover" style="margin-top:16px">
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>历史回测记录</span>
          <div>
            <el-button size="small" @click="handleSelectAll" :disabled="paginatedHistory.length === 0">
              {{ isAllSelected ? '取消全选' : '全选' }}
            </el-button>
            <el-button size="small" type="danger" @click="handleBatchDelete" :disabled="selectedRows.length === 0">
              批量删除
            </el-button>
            <el-button size="small" type="success" @click="handleBatchExport" :disabled="selectedRows.length === 0">
              批量导出
            </el-button>
          </div>
        </div>
      </template>
      <el-table :data="paginatedHistory" v-loading="historyLoading" stripe @selection-change="handleSelectionChange" :row-key="row => row.id">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="stock_name" label="股票" width="120">
          <template #default="{ row }">{{ row.stock_name }} ({{ row.stock_code }})</template>
        </el-table-column>
        <el-table-column prop="start_date" label="开始日期" width="100" />
        <el-table-column prop="end_date" label="结束日期" width="100" />
        <el-table-column prop="total_return" label="收益率" width="90">
          <template #default="{ row }">
            <span :class="Number(row.total_return || 0) >= 0 ? 'positive' : 'negative'">{{ Number(row.total_return || 0).toFixed(2) }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="max_drawdown" label="最大回撤" width="90">
          <template #default="{ row }">{{ Number(row.max_drawdown || 0).toFixed(2) }}%</template>
        </el-table-column>
        <el-table-column prop="total_trades" label="交易次数" width="80" />
        <el-table-column prop="win_rate" label="胜率" width="70">
          <template #default="{ row }">{{ Number(row.win_rate || 0).toFixed(0) }}%</template>
        </el-table-column>
        <el-table-column prop="created_at" label="回测时间" width="160">
          <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" @click="viewResult(row)">查看</el-button>
            <el-button size="small" type="danger" @click="deleteResult(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <!-- 分页组件 -->
      <div style="display:flex;justify-content:flex-end;margin-top:16px">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 选择股票对话框 -->
    <el-dialog v-model="stockDialogVisible" title="选择回测股票" width="500px">
      <el-alert type="info" :closable="false" style="margin-bottom:12px">请从LLM选股中正常状态的股票选择</el-alert>
      <el-table :data="stockList" v-loading="stockLoading" @row-click="selectStock" stripe :height="300" style="cursor:pointer">
        <el-table-column prop="stock_code" label="代码" width="100" />
        <el-table-column prop="stock_name" label="名称" width="120" />
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button type="primary" size="small">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 策略实例管理对话框 -->
    <el-dialog v-model="instanceManageVisible" title="策略实例管理" width="800px">
      <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #909399; font-size: 13px;">查看、编辑和删除已保存的策略实例</span>
        <el-button type="primary" size="small" @click="loadAllInstances">刷新列表</el-button>
      </div>
      <el-table :data="allInstances" v-loading="instanceManageLoading" stripe :height="400">
        <el-table-column prop="name" label="实例名称" width="150" />
        <el-table-column label="策略类型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.strategy_name || '未知策略' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="参数" min-width="200">
          <template #default="{ row }">
            <el-tooltip :content="formatParamsTooltip(row.params_json)" placement="top">
              <span style="cursor: help; color: #409eff;">
                {{ formatParamsShort(row.params_json) }}
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="use_count" label="使用次数" width="80" />
        <el-table-column prop="created_at" label="创建时间" width="160">
          <template #default="{ row }">
            {{ row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="editInstance(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteInstance(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 编辑实例对话框 -->
    <el-dialog v-model="editInstanceVisible" title="编辑策略实例" width="500px">
      <el-form :model="editInstanceForm" label-width="100px">
        <el-form-item label="实例名称">
          <el-input v-model="editInstanceForm.name" placeholder="请输入实例名称" />
        </el-form-item>
        <el-form-item label="策略类型">
          <el-input :value="editInstanceForm.strategy_name" disabled />
        </el-form-item>
        <el-form-item label="参数配置">
          <div v-if="editInstanceForm.params_json" class="params-display">
            <div v-for="(value, key) in editInstanceForm.params_json" :key="key" class="param-item">
              <span class="param-key">{{ formatParamKey(key) }}:</span>
              <span class="param-value">{{ value }}</span>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editInstanceForm.description" type="textarea" :rows="2" placeholder="可选描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editInstanceVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEditInstance" :loading="savingInstance">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox, ElTooltip } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { backtestApi, strategyApi } from '@/api'

// 图表引用
const chartRef = ref(null)
let chartInstance = null

// 表单数据
const form = ref({
  stock_code: '',
  stock_name: '',
  start_date: '',
  end_date: '',
  initial_capital: 100000,
  strategy_id: null,
  strategy_instance_id: null,
  instance_name: '',
  params: {
    short_period: 5,
    long_period: 20,
    rsi_period: 14,
    oversold: 30,
    overbought: 70,
    fast_period: 12,
    slow_period: 26,
    signal_period: 9,
    boll_period: 20,
    std_dev: 2,
    breakout_period: 20,
    stop_loss_pct: 0.05,
    take_profit_pct: 0.15
  }
})

// 状态
const running = ref(false)
const savingInstance = ref(false)
const stockDialogVisible = ref(false)
const stockLoading = ref(false)
const stockList = ref([])
const strategyList = ref([])
const instanceList = ref([])
const historyResults = ref([])
const historyLoading = ref(false)
// 分页相关状态
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const selectedRows = ref([])

// 计算属性：分页后的历史记录
const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return historyResults.value.slice(start, end)
})

// 计算属性：是否全选
const isAllSelected = computed(() => {
  if (paginatedHistory.value.length === 0) return false
  return paginatedHistory.value.every(row => selectedRows.value.some(s => s.id === row.id))
})
// 实例管理
const instanceManageVisible = ref(false)
const instanceManageLoading = ref(false)
const allInstances = ref([])
const editInstanceVisible = ref(false)
const editInstanceForm = ref({ id: null, name: '', strategy_name: '', strategy_id: null, params_json: {}, description: '' })

// 回测结果
const result = ref(null)

// 计算属性
const selectedStrategy = computed(() => {
  if (!form.value.strategy_id) return null
  return strategyList.value.find(s => s.id === form.value.strategy_id)
})

const getEquityCurve = () => {
  const curve = result.value?.equity_curve
  if (!curve || !Array.isArray(curve)) return []
  if (typeof curve === 'string') {
    try { return JSON.parse(curve) } catch { return [] }
  }
  return curve
}

// 格式化金额（千分位）
const formatMoney = (value) => {
  if (value === null || value === undefined) return '-'
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 获取交易记录（处理字符串格式）
const getTrades = () => {
  const trades = result.value?.trades_json
  if (!trades) return []
  if (typeof trades === 'string') {
    try { return JSON.parse(trades) } catch { return [] }
  }
  return trades
}

// 卖出原因标签类型
const getSellReasonType = (reason) => {
  if (reason === '止盈') return 'success'
  if (reason === '止损') return 'danger'
  if (reason === '死叉' || reason === '金叉') return 'warning'
  return 'info'
}

const minEquity = computed(() => {
  const curve = getEquityCurve()
  if (curve.length === 0) return 0
  return Math.min(...curve.map(p => p.value))
})

const maxEquity = computed(() => {
  const curve = getEquityCurve()
  if (curve.length === 0) return 1
  return Math.max(...curve.map(p => p.value))
})

// 加载策略列表
const loadStrategies = async () => {
  const res = await strategyApi.getStrategies()
  strategyList.value = res?.data || []
}

// 加载策略实例
const loadInstances = async () => {
  const res = await strategyApi.getInstances({})
  instanceList.value = res?.data || []
}

// 选择策略变化
const onStrategyChange = async (strategyId) => {
  form.value.strategy_instance_id = null
  form.value.instance_name = ''
  
  if (strategyId) {
    // 获取策略详情和参数
    const res = await strategyApi.getStrategyDetail(strategyId)
    if (res.code === 0 && res.data.params) {
      // 设置默认参数
      res.data.params.forEach(p => {
        if (p.param_name === 'short_period') form.value.params.short_period = Number(p.default_value)
        if (p.param_name === 'long_period') form.value.params.long_period = Number(p.default_value)
        if (p.param_name === 'period' && res.data.strategy_type === 'rsi') form.value.params.rsi_period = Number(p.default_value)
        if (p.param_name === 'oversold') form.value.params.oversold = Number(p.default_value)
        if (p.param_name === 'overbought') form.value.params.overbought = Number(p.default_value)
        if (p.param_name === 'fast_period') form.value.params.fast_period = Number(p.default_value)
        if (p.param_name === 'slow_period') form.value.params.slow_period = Number(p.default_value)
        if (p.param_name === 'signal_period') form.value.params.signal_period = Number(p.default_value)
        if (p.param_name === 'boll_period') form.value.params.boll_period = Number(p.default_value)
        if (p.param_name === 'std_dev') form.value.params.std_dev = Number(p.default_value)
        if (p.param_name === 'breakout_period') form.value.params.breakout_period = Number(p.default_value)
        if (p.param_name === 'stop_loss_pct') form.value.params.stop_loss_pct = Number(p.default_value)
        if (p.param_name === 'take_profit_pct') form.value.params.take_profit_pct = Number(p.default_value)
      })
    }
    // 加载该策略的实例
    const instanceRes = await strategyApi.getInstances({ strategy_id: strategyId })
    instanceList.value = instanceRes?.data || []
  }
}

// 选择实例变化
const onInstanceChange = async (instanceId) => {
  if (!instanceId) return
  const instance = instanceList.value.find(i => i.id === instanceId)
  if (instance && instance.params_json) {
    Object.assign(form.value.params, instance.params_json)
  }
}

// 选择股票
const openStockDialog = async () => {
  stockDialogVisible.value = true
  stockLoading.value = true
  try {
    const res = await backtestApi.getStocks()
    stockList.value = res?.data || []
  } finally {
    stockLoading.value = false
  }
}

const selectStock = (row) => {
  form.value.stock_code = row.stock_code
  form.value.stock_name = row.stock_name
  stockDialogVisible.value = false
  ElMessage.success(`已选择 ${row.stock_name}`)
}

// 绑制K线图表
const renderChart = async () => {
  if (!result.value || !result.value.kline_data || result.value.kline_data.length === 0) {
    // 尝试解析
    if (typeof result.value.kline_data === 'string') {
      try {
        result.value.kline_data = JSON.parse(result.value.kline_data)
      } catch {}
    }
    if (!result.value.kline_data || result.value.kline_data.length === 0) return
  }

  await nextTick()
  if (!chartRef.value) return
  
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  let klineData = result.value.kline_data
  if (typeof klineData === 'string') {
    try { klineData = JSON.parse(klineData) } catch { return }
  }
  
  const ma5 = result.value.ma5 || []
  const ma20 = result.value.ma20 || []
  const buyPoints = result.value.buy_points || []
  const sellPoints = result.value.sell_points || []

  const ohlcData = klineData.map(k => [k.open, k.close, k.low, k.high])
  const dates = klineData.map(k => k.date)

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['K线', 'MA5', 'MA20'] },
    grid: [
      { left: '10%', right: '10%', height: '50%' },
      { left: '10%', right: '10%', top: '70%', height: '20%' }
    ],
    xAxis: [
      { type: 'category', data: dates, scale: true, boundaryGap: false },
      { type: 'category', gridIndex: 1, data: dates, scale: true, boundaryGap: false, axisLabel: { show: false } }
    ],
    yAxis: [
      { scale: true, splitArea: { show: true } },
      { scale: true, gridIndex: 1, splitNumber: 2, axisLabel: { show: false }, axisLine: { show: false }, splitLine: { show: false } }
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 50, end: 100 },
      { show: true, xAxisIndex: [0, 1], type: 'slider', top: '95%', start: 50, end: 100 }
    ],
    series: [
      {
        name: 'K线', type: 'candlestick', data: ohlcData,
        itemStyle: { color: '#ef232a', color0: '#14b143', borderColor: '#ef232a', borderColor0: '#14b143' }
      },
      { name: 'MA5', type: 'line', data: ma5.slice(-klineData.length), smooth: true, lineStyle: { opacity: 0.5 }, symbol: 'none' },
      { name: 'MA20', type: 'line', data: ma20.slice(-klineData.length), smooth: true, lineStyle: { opacity: 0.5 }, symbol: 'none' },
      { name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: klineData.map(k => k.volume) }
    ]
  }

  // 添加买卖点
  if (buyPoints.length > 0) {
    const buyMarks = buyPoints.map(b => {
      const idx = dates.indexOf(b.date)
      return idx >= 0 ? { coord: [idx, b.price], value: '买', itemStyle: { color: '#f56c6c' } } : null
    }).filter(Boolean)
    option.series.push({
      name: '买入', type: 'effectScatter', symbolSize: 15, data: buyMarks,
      markPoint: { data: buyMarks }
    })
  }
  
  if (sellPoints.length > 0) {
    const sellMarks = sellPoints.map(s => {
      const idx = dates.indexOf(s.date)
      return idx >= 0 ? { coord: [idx, s.price], value: s.profit > 0 ? '卖+' : '卖-', itemStyle: { color: s.profit > 0 ? '#f56c6c' : '#67c23a' } } : null
    }).filter(Boolean)
    option.series.push({
      name: '卖出', type: 'effectScatter', symbolSize: 15, symbolRotate: 180, data: sellMarks,
      markPoint: { data: sellMarks }
    })
  }

  chartInstance.setOption(option)
}

// 执行回测
const runBacktest = async () => {
  running.value = true
  try {
    const res = await backtestApi.run({
      stock_code: form.value.stock_code,
      stock_name: form.value.stock_name,
      start_date: form.value.start_date,
      end_date: form.value.end_date,
      initial_capital: form.value.initial_capital,
      strategy_id: form.value.strategy_id,
      strategy_instance_id: form.value.strategy_instance_id,
      strategy_type: selectedStrategy.value?.strategy_type,
      params: form.value.params
    })
    if (res.code === 0) {
      result.value = res.data
      ElMessage.success('回测完成')
      loadHistory()
      
      // 保存为实例
      if (form.value.instance_name && selectedStrategy.value) {
        await strategyApi.createInstance({
          name: form.value.instance_name,
          strategy_id: form.value.strategy_id,
          params_json: form.value.params,
          description: `${selectedStrategy.value.name} - ${form.value.stock_code}`
        })
        ElMessage.success('策略实例已保存')
        loadInstances()
      }
      
      // 绑制图表
      if (res.data.kline_data && res.data.kline_data.length > 0) {
        setTimeout(renderChart, 100)
      }
    } else {
      ElMessage.error(res.message || '回测失败')
    }
  } catch (e) {
    ElMessage.error('回测失败: ' + (e.message || '未知错误'))
  } finally {
    running.value = false
  }
}

// 加载历史
const loadHistory = async () => {
  historyLoading.value = true
  try {
    const res = await backtestApi.getResults({})
    historyResults.value = res?.data || []
    total.value = historyResults.value.length
  } catch (e) {
    console.error('加载历史记录失败:', e)
  } finally {
    historyLoading.value = false
  }
}

// 批量选择变化
const handleSelectionChange = (rows) => {
  selectedRows.value = rows
}

// 每页数量变化
const handleSizeChange = () => {
  currentPage.value = 1
}

// 页码变化
const handleCurrentChange = () => {
  // 页码改变时自动处理
}

// 全选/取消全选
const handleSelectAll = () => {
  if (isAllSelected.value) {
    // 取消当前页全选
    const currentIds = new Set(paginatedHistory.value.map(r => r.id))
    selectedRows.value = selectedRows.value.filter(r => !currentIds.has(r.id))
  } else {
    // 全选当前页
    const newSelected = paginatedHistory.value.filter(r => !selectedRows.value.some(s => s.id === r.id))
    selectedRows.value = [...selectedRows.value, ...newSelected]
  }
}

// 批量删除
const handleBatchDelete = async () => {
  if (selectedRows.value.length === 0) return
  await ElMessageBox.confirm(`确认删除选中的 ${selectedRows.value.length} 条记录？`, '提示', { type: 'warning' })
  try {
    for (const row of selectedRows.value) {
      await backtestApi.deleteResult(row.id)
    }
    ElMessage.success(`已删除 ${selectedRows.value.length} 条记录`)
    selectedRows.value = []
    loadHistory()
  } catch (e) {
    ElMessage.error('批量删除失败')
  }
}

// 批量导出
const handleBatchExport = () => {
  if (selectedRows.value.length === 0) return
  const exportData = selectedRows.value.map(row => ({
    stock_code: row.stock_code,
    stock_name: row.stock_name,
    start_date: row.start_date,
    end_date: row.end_date,
    total_return: row.total_return,
    max_drawdown: row.max_drawdown,
    total_trades: row.total_trades,
    win_rate: row.win_rate,
    created_at: row.created_at
  }))
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `backtest_history_${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${selectedRows.value.length} 条记录`)
}

const viewResult = async (row) => {
  try {
    const res = await backtestApi.getResult(row.id)
    if (res.code === 0) {
      const data = res.data
      // 解析JSON
      if (typeof data.equity_curve === 'string') data.equity_curve = JSON.parse(data.equity_curve)
      if (typeof data.trades_json === 'string') data.trades_json = JSON.parse(data.trades_json)
      if (typeof data.kline_data === 'string') data.kline_data = JSON.parse(data.kline_data)
      if (typeof data.buy_points === 'string') data.buy_points = JSON.parse(data.buy_points)
      if (typeof data.sell_points === 'string') data.sell_points = JSON.parse(data.sell_points)
      if (typeof data.ma5 === 'string') data.ma5 = JSON.parse(data.ma5)
      if (typeof data.ma20 === 'string') data.ma20 = JSON.parse(data.ma20)
      result.value = data
      if (data.kline_data && data.kline_data.length > 0) {
        setTimeout(renderChart, 100)
      }
    }
  } catch (e) {
    console.error('加载回测结果失败:', e)
    ElMessage.error('加载回测结果失败')
  }
}

const deleteResult = async (row) => {
  await ElMessageBox.confirm('确认删除此回测记录？', '提示', { type: 'warning' })
  await backtestApi.deleteResult(row.id)
  ElMessage.success('已删除')
  loadHistory()
}

const resetForm = () => {
  form.value.start_date = ''
  form.value.end_date = ''
  form.value.initial_capital = 100000
  form.value.strategy_id = null
  form.value.strategy_instance_id = null
  form.value.instance_name = ''
  form.value.params = {
    short_period: 5, long_period: 20, rsi_period: 14, oversold: 30, overbought: 70,
    fast_period: 12, slow_period: 26, signal_period: 9, boll_period: 20, std_dev: 2,
    breakout_period: 20, stop_loss_pct: 0.05, take_profit_pct: 0.15
  }
}

// 保存实例（独立按钮）
const saveInstance = async () => {
  if (!form.value.instance_name) {
    ElMessage.warning('请输入实例名称')
    return
  }
  if (!form.value.strategy_id) {
    ElMessage.warning('请先选择策略')
    return
  }
  savingInstance.value = true
  try {
    await strategyApi.createInstance({
      name: form.value.instance_name,
      strategy_id: form.value.strategy_id,
      params_json: form.value.params,
      description: `${selectedStrategy.value?.name || ''} 参数配置`
    })
    ElMessage.success('策略实例已保存')
    loadInstances()
    form.value.instance_name = ''
  } catch (e) {
    ElMessage.error('保存实例失败: ' + (e.message || '未知错误'))
  } finally {
    savingInstance.value = false
  }
}

// 打开实例管理对话框
const openInstanceManageDialog = async () => {
  instanceManageVisible.value = true
  loadAllInstances()
}

// 加载所有实例
const loadAllInstances = async () => {
  instanceManageLoading.value = true
  try {
    const res = await strategyApi.getInstances({})
    allInstances.value = res?.data || []
  } catch (e) {
    ElMessage.error('加载实例列表失败')
  } finally {
    instanceManageLoading.value = false
  }
}

// 格式化参数 tooltip
const formatParamsTooltip = (params) => {
  if (!params) return '-'
  return Object.entries(params).map(([k, v]) => `${formatParamKey(k)}: ${v}`).join(', ')
}

// 格式化参数简略显示
const formatParamsShort = (params) => {
  if (!params) return '-'
  const entries = Object.entries(params).slice(0, 3)
  const str = entries.map(([k, v]) => `${formatParamKey(k)}=${v}`).join(', ')
  if (Object.keys(params).length > 3) {
    return str + '...'
  }
  return str
}

// 格式化参数 key 为中文
const formatParamKey = (key) => {
  const keyMap = {
    short_period: '短期均线',
    long_period: '长期均线',
    rsi_period: 'RSI周期',
    oversold: '超卖阈值',
    overbought: '超买阈值',
    fast_period: '快线周期',
    slow_period: '慢线周期',
    signal_period: '信号线周期',
    boll_period: '布林带周期',
    std_dev: '标准差倍数',
    breakout_period: '突破周期',
    stop_loss_pct: '止损比例',
    take_profit_pct: '止盈比例'
  }
  return keyMap[key] || key
}

// 编辑实例
const editInstance = (row) => {
  editInstanceForm.value = {
    id: row.id,
    name: row.name,
    strategy_name: row.strategy_name || '未知策略',
    strategy_id: row.strategy_id,
    params_json: row.params_json ? { ...row.params_json } : {},
    description: row.description || ''
  }
  editInstanceVisible.value = true
}

// 保存编辑后的实例
const saveEditInstance = async () => {
  if (!editInstanceForm.value.name) {
    ElMessage.warning('请输入实例名称')
    return
  }
  savingInstance.value = true
  try {
    await strategyApi.updateInstance(editInstanceForm.value.id, {
      name: editInstanceForm.value.name,
      params_json: editInstanceForm.value.params_json,
      description: editInstanceForm.value.description
    })
    ElMessage.success('实例已更新')
    editInstanceVisible.value = false
    loadAllInstances()
  } catch (e) {
    ElMessage.error('更新实例失败: ' + (e.message || '未知错误'))
  } finally {
    savingInstance.value = false
  }
}

// 删除实例
const deleteInstance = async (row) => {
  await ElMessageBox.confirm(`确认删除策略实例"${row.name}"？`, '提示', { type: 'warning' })
  await strategyApi.deleteInstance(row.id)
  ElMessage.success('已删除')
  loadAllInstances()
}

const initDates = () => {
  const now = new Date()
  const oneYearAgo = new Date(now)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  form.value.end_date = now.toISOString().slice(0, 10)
  form.value.start_date = oneYearAgo.toISOString().slice(0, 10)
}

onMounted(() => {
  initDates()
  loadStrategies()
  loadInstances()
  loadHistory()
  window.addEventListener('resize', () => { if (chartInstance) chartInstance.resize() })
})
</script>

<style scoped>
.selected-stock { display: flex; align-items: center; gap: 12px; }
.tip-text { color: #909399; font-size: 14px; }
.strategy-params { background: #f5f7fa; padding: 16px; border-radius: 8px; margin: 16px 0; }
.params-title { font-weight: 600; margin-bottom: 12px; color: #303133; }
.result-stats { margin-bottom: 20px; }
.stat-item { text-align: center; padding: 12px; background: #f5f7fa; border-radius: 8px; }
.stat-label { font-size: 13px; color: #909399; margin-bottom: 4px; }
.stat-value { font-size: 20px; font-weight: 600; }
.positive { color: #f56c6c; }
.negative { color: #67c23a; }
.chart-section, .trades-section { margin-top: 20px; }
.section-title { font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #303133; }
.equity-curve { position: relative; height: 150px; background: linear-gradient(to bottom, #f0f2f5, #fff); border: 1px solid #ebeef5; border-radius: 4px; }
.curve-point { position: absolute; width: 2px; height: 2px; background: #409eff; transform: translateX(-50%); }
.curve-line { position: absolute; bottom: 0; left: 0; right: 0; height: 2px; opacity: 0.3; }
.curve-labels { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #909399; }

/* 调整 el-input-number 内部输入框宽度 */
:deep(.el-input-number .el-input__wrapper) {
  padding-left: 8px;
  padding-right: 8px;
}
:deep(.el-input-number .el-input__inner) {
  text-align: center;
  min-width: 50px;
}

/* 参数显示样式 */
.params-display {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  max-height: 150px;
  overflow-y: auto;
}
.param-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid #ebeef5;
}
.param-item:last-child {
  border-bottom: none;
}
.param-key {
  color: #909399;
  font-size: 13px;
}
.param-value {
  color: #303133;
  font-weight: 500;
}
</style>