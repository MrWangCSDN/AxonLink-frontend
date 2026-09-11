<template>
  <main class="db-compare-page">
    <header class="page-toolbar">
      <button class="nav-button" type="button" aria-label="打开导航" @click="$emit('toggleNavigation')">☰</button>
      <div>
        <h2>回放数据库比对字段登记</h2>
        <p>共 327 张表 · 2,846 个比对字段 <span>Mock 数据</span></p>
      </div>
      <div class="toolbar-actions">
        <button type="button">重置筛选条件</button>
        <button type="button" class="outlined">初始化导入</button>
        <button type="button" class="primary">＋ 新增登记</button>
      </div>
    </header>

    <section class="table-shell">
      <table>
        <thead data-testid="database-comparison-table-head" class="is-sticky">
          <tr>
            <th>序号</th>
            <th><button data-testid="database-comparison-header-filter">领域 ▼</button></th>
            <th><button data-testid="database-comparison-header-filter">表英文名 / 中文名 ▼</button></th>
            <th><button data-testid="database-comparison-header-filter">比对字段 ▼</button></th>
            <th><button data-testid="database-comparison-header-filter">负责人 ▼</button></th>
            <th><button data-testid="database-comparison-header-filter">归属大组 ▼</button></th>
            <th><button data-testid="database-comparison-header-filter">登记日期 ▼</button></th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.tableName">
            <td>{{ index + 1 }}</td>
            <td>{{ row.domain }}</td>
            <td><strong>{{ row.tableName }}</strong><small>{{ row.tableComment }}</small></td>
            <td class="fields">{{ row.fields }}</td>
            <td>{{ row.owner }}</td>
            <td>{{ row.group }}</td>
            <td>{{ row.date }}</td>
            <td><button class="link">查看</button><button class="link">编辑</button></td>
          </tr>
        </tbody>
      </table>
    </section>
    <footer class="pager"><button disabled>‹</button><button class="active">1</button><button>2</button><button>3</button><span>每页 20 条，共 327 条</span></footer>
  </main>
</template>

<script setup>
defineEmits(['toggleNavigation'])

const rows = [
  { domain: '存款', tableName: 'kdpa_cb_acct_fzn_cntl_inf', tableComment: '对公存款账户冻结控制信息', fields: 'fzn_cntl_id、lglpern_cd、fzn_cntl_amt…（6）', owner: '周皓', group: '存款组', date: '2026-09-07' },
  { domain: '存款', tableName: 'kdpl_cb_acct_fzn_cntl_oprn_detl', tableComment: '对公存款账户冻结控制操作明细', fields: 'fzn_cntl_oprn_sn、txn_dt、cncl_fzn_dectrl_amt…（15）', owner: '周皓', group: '存款组', date: '2026-09-07' },
  { domain: '贷款', tableName: 'klna_ln_acct_base_info', tableComment: '贷款账户基础信息', fields: 'loan_acct_no、customer_no、product_code…（9）', owner: '李明', group: '贷款组', date: '2026-09-08' },
]
</script>

<style scoped>
.db-compare-page { flex: 1; min-width: 0; padding: 20px 22px; overflow: auto; background: #f4f6f9; color: #303947; }
.page-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.page-toolbar h2 { margin: 0 0 4px; font-size: 21px; }
.page-toolbar p { margin: 0; color: #778291; font-size: 13px; }
.page-toolbar p span { margin-left: 8px; padding: 2px 7px; border-radius: 10px; color: #a36b00; background: #fff4ce; }
.nav-button { display: none; }
.toolbar-actions { display: flex; gap: 8px; margin-left: auto; }
.toolbar-actions button, .pager button { padding: 7px 11px; border: 1px solid #d4dce5; border-radius: 4px; background: #fff; color: #44505e; }
.toolbar-actions .outlined { border-color: #168478; color: #107267; }
.toolbar-actions .primary, .pager .active { border-color: #168478; color: #fff; background: #168478; }
.table-shell { overflow: auto; border: 1px solid #dbe2e9; border-radius: 5px; background: #fff; box-shadow: 0 3px 12px rgba(25, 42, 60, .06); }
table { width: 100%; min-width: 1120px; border-collapse: collapse; font-size: 13px; }
thead.is-sticky { position: sticky; top: 0; z-index: 2; color: #fff; background: #176f74; }
th { padding: 0; text-align: left; white-space: nowrap; }
th:first-child, td:first-child { width: 54px; text-align: center; }
th button { width: 100%; padding: 12px 10px; border: 0; color: inherit; background: transparent; text-align: left; font-weight: 600; }
td { padding: 12px 10px; border-right: 1px solid #e2e8ee; border-bottom: 1px solid #e2e8ee; }
tbody tr:nth-child(even) { background: #edf7fb; }
td strong, td small { display: block; }
td small { margin-top: 4px; color: #7b8795; }
.fields, .link { color: #1769aa; }
.link { padding: 0 5px; border: 0; background: transparent; }
.pager { display: flex; justify-content: flex-end; align-items: center; gap: 7px; margin-top: 12px; font-size: 12px; color: #687381; }
@media (max-width: 760px) { .db-compare-page { padding: 12px; } .nav-button { display: inline-block; } .page-toolbar { align-items: flex-start; flex-wrap: wrap; } .toolbar-actions { width: 100%; margin-left: 0; } }
</style>
