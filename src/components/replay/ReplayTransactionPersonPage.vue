<template>
  <section class="replay-page transaction-person-page" aria-label="全量交易人员清单">
    <header class="replay-toolbar">
      <div class="replay-toolbar-title"><div><h2>全量交易人员清单</h2><p>Excel 全量覆盖导入</p></div></div>
      <div class="replay-toolbar-actions">
        <button class="replay-button" type="button" data-testid="export-transaction-persons" @click="exportAll">导出 Excel</button>
        <button class="replay-button replay-button-primary" type="button" data-testid="open-transaction-person-import" @click="openImport">导入 Excel</button>
      </div>
    </header>
    <form class="replay-filters" @submit.prevent="load">
      <label class="replay-keyword-field"><span>搜索</span><input v-model.trim="keyword" data-testid="transaction-person-keyword" type="search" placeholder="领域、老交易码、名称或人员" /></label>
      <button class="replay-button replay-button-primary" type="submit">查询</button>
    </form>
    <div v-if="notice" class="replay-import-message" :class="{ 'replay-error': noticeError }">{{ notice }}</div>
    <div class="replay-table-viewport"><table class="replay-table"><thead><tr><th>领域</th><th>老交易码</th><th>老交易名称</th><th>开发人员</th><th>行方负责人</th></tr></thead>
      <tbody><tr v-for="row in items" :key="row.id"><td>{{ row.domain }}</td><td>{{ row.oldTransactionCode }}</td><td>{{ row.oldTransactionName }}</td><td>{{ row.developer }}</td><td>{{ row.bankOwner }}</td></tr><tr v-if="!loading && !items.length"><td colspan="5" class="replay-state">暂无交易人员数据</td></tr></tbody>
    </table></div>
    <footer class="replay-pager"><span>共 {{ total }} 条，第 {{ page + 1 }} / {{ pageCount }} 页</span><div class="replay-page-actions"><button class="replay-icon-button" type="button" :disabled="page === 0" @click="page--; load()">上一页</button><button class="replay-icon-button" type="button" :disabled="page + 1 >= pageCount" @click="page++; load()">下一页</button></div></footer>

    <div v-if="importOpen" class="replay-modal-mask" @click.self="!importing && (importOpen = false)"><section class="replay-import-modal" role="dialog" aria-modal="true"><header><h3>导入全量交易人员清单</h3><button class="replay-icon-button" type="button" @click="importOpen = false">关闭</button></header><p>Excel 将全量覆盖现有清单；人员列为空允许导入。</p><input data-testid="transaction-person-file" type="file" accept=".xlsx,.xls" :disabled="importing" @change="file = $event.target.files?.[0] || null" /><input v-model="token" data-testid="transaction-person-token" type="password" placeholder="导入口令" /><button class="replay-button replay-button-primary" data-testid="submit-transaction-person-import" type="button" :disabled="!file || importing" @click="submitImport">{{ importing ? '导入中...' : '开始导入' }}</button><div v-if="errors.length" class="import-errors"><h4>错误明细（{{ errors.length }}）</h4><table><thead><tr><th>行号</th><th>字段</th><th>原值</th><th>原因</th></tr></thead><tbody><tr v-for="(error, index) in errors" :key="index"><td>{{ error.rowNumber }}</td><td>{{ error.column }}</td><td>{{ error.value }}</td><td>{{ error.reason }}</td></tr></tbody></table></div></section></div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { exportReplayTransactionPersons, importReplayTransactionPersons, listReplayTransactionPersons } from '../../api/replayTransactionPersons.js'
const items = ref([]); const total = ref(0); const page = ref(0); const pageSize = 50; const keyword = ref(''); const loading = ref(false)
const importOpen = ref(false); const file = ref(null); const token = ref(''); const importing = ref(false); const errors = ref([]); const notice = ref(''); const noticeError = ref(false)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
async function load() { loading.value = true; try { const result = await listReplayTransactionPersons({ keyword: keyword.value, limit: pageSize, offset: page.value * pageSize }); items.value = result.items || []; total.value = result.total || 0 } finally { loading.value = false } }
function openImport() { importOpen.value = true; file.value = null; errors.value = []; notice.value = ''; noticeError.value = false }
async function submitImport() { if (!file.value || importing.value) return; importing.value = true; errors.value = []; try { const result = await importReplayTransactionPersons(file.value, token.value); notice.value = `导入完成：${result.insertedRows} 条，已全量覆盖`; noticeError.value = false; importOpen.value = false; page.value = 0; await load() } catch (error) { errors.value = error.data?.errors || []; notice.value = error.data ? `导入校验失败：${error.data.errorRows} 条错误` : `导入失败：${error.message}`; noticeError.value = true } finally { importing.value = false } }
async function exportAll() { const blob = await exportReplayTransactionPersons(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = '全量交易人员清单.xlsx'; link.click(); URL.revokeObjectURL(url) }
onMounted(load)
</script>

<style scoped>
.transaction-person-page{height:100%;display:flex;flex-direction:column;background:var(--bg-primary,#f5f7fa);color:var(--text-primary,#1f2937);overflow:hidden}.replay-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border,#e5e7eb)}h2,h3,h4{margin:0}.replay-toolbar-title p{margin:3px 0 0;color:var(--text-muted,#6b7280);font-size:12px}.replay-toolbar-actions,.replay-page-actions{display:flex;gap:8px}.replay-button,.replay-icon-button{min-height:34px;padding:0 12px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit;cursor:pointer}.replay-button-primary{background:#0b70db;border-color:#0b70db;color:#fff}.replay-filters{display:flex;align-items:end;gap:8px;padding:12px 20px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border,#e5e7eb)}label{display:grid;gap:5px;font-size:12px}.replay-keyword-field{width:min(420px,70vw)}input{height:34px;padding:0 10px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit}.replay-table-viewport{flex:1;overflow:auto;padding:12px 20px}.replay-table{width:100%;border-collapse:collapse;background:var(--bg-card,#fff)}th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--border,#e5e7eb);font-size:13px}th{position:sticky;top:0;background:var(--bg-card,#fff);z-index:1}.replay-state{text-align:center;color:var(--text-muted,#6b7280)}.replay-pager{display:flex;justify-content:space-between;align-items:center;padding:10px 20px;background:var(--bg-card,#fff);border-top:1px solid var(--border,#e5e7eb)}.replay-import-message{padding:8px 20px;background:#eef7ee;color:#24713d}.replay-error{background:#fff1f0;color:#b42318}.replay-modal-mask{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(0,0,0,.38)}.replay-import-modal{width:min(780px,calc(100vw - 32px));max-height:80vh;overflow:auto;display:grid;gap:14px;padding:20px;background:var(--bg-card,#fff);border-radius:6px}.replay-import-modal header{display:flex;justify-content:space-between;align-items:center}.import-errors{overflow:auto}.import-errors table{width:100%;border-collapse:collapse}.import-errors th,.import-errors td{font-size:12px;vertical-align:top}@media(max-width:700px){.replay-toolbar{align-items:flex-start}.replay-toolbar-actions{flex-wrap:wrap}.replay-filters{align-items:stretch}.replay-keyword-field{width:100%}.replay-table{min-width:760px}}
</style>
