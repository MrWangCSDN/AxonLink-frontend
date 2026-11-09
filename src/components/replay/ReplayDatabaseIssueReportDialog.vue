<template>
  <div class="database-report-mask" @click.self="close">
    <section ref="dialog" class="database-report-dialog" role="dialog" aria-modal="true" aria-labelledby="database-report-title" tabindex="-1" data-testid="database-report-dialog" @keydown.esc.stop.prevent="close">
      <header>
        <div><h3 id="database-report-title">导出数据库问题报表</h3><p>按批次生成完整领域汇总及合计</p></div>
        <button type="button" class="report-close" :disabled="exporting" aria-label="关闭导出报表" @click="close"><X :size="17" /></button>
      </header>
      <form @submit.prevent="exportReport">
        <label for="database-report-batch">统计批次</label>
        <select id="database-report-batch" v-model="batchNo" data-testid="report-batch-select" :disabled="optionsLoading || !optionsLoaded || exporting" aria-describedby="database-report-scope">
          <option value="">最新业务批次</option>
          <option v-for="batch in batches" :key="batch" :value="batch">{{ batch }}</option>
        </select>
        <p id="database-report-scope" class="report-scope">导出所选批次的完整领域汇总，不受清单分页和筛选条件影响。字段总数取本批次关联的登记历史版本，未关联历史版本的旧批次沿用当前登记数据。问题类型按数据库实际数据统计，Excel 中附有统计口径说明。</p>
        <p v-if="optionsLoading" role="status" data-testid="report-options-loading">正在读取可导出批次…</p>
        <div v-if="optionsError" class="report-error" role="alert" data-testid="report-options-error">
          <p>{{ optionsError }}</p><button type="button" data-testid="report-options-retry" @click="loadOptions">重试读取批次</button>
        </div>
        <p v-if="exportError" class="report-error" role="alert" data-testid="report-export-error">{{ exportError }}</p>
        <footer>
          <button type="button" :disabled="exporting" @click="close">取消</button>
          <button type="submit" class="report-primary" data-testid="submit-report-export" :disabled="optionsLoading || !optionsLoaded || exporting"><Download :size="15" />{{ exporting ? '正在导出…' : '导出报表' }}</button>
        </footer>
      </form>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Download, X } from 'lucide-vue-next'
import { exportDatabaseIssueReport, getDatabaseIssueReportOptions } from '../../api/replayDatabaseIssues.js'

const emit = defineEmits(['close'])
const dialog = ref(null), batchNo = ref(''), batches = ref([])
const optionsLoading = ref(false), optionsLoaded = ref(false), optionsError = ref('')
const exporting = ref(false), exportError = ref('')
let alive = true, optionsSequence = 0, previousFocus

async function loadOptions() {
  const sequence = ++optionsSequence
  optionsLoading.value = true
  optionsLoaded.value = false
  optionsError.value = ''
  try {
    const result = await getDatabaseIssueReportOptions()
    if (!alive || sequence !== optionsSequence) return
    batches.value = [...new Set((result?.batches || []).filter(batch => typeof batch === 'string' && batch.trim()).map(batch => batch.trim()))]
    optionsLoaded.value = true
  } catch (cause) {
    if (alive && sequence === optionsSequence) optionsError.value = cause?.message || '读取批次失败，请重试'
  } finally {
    if (alive && sequence === optionsSequence) optionsLoading.value = false
  }
}
function close() {
  if (!exporting.value) emit('close')
}
async function exportReport() {
  if (exporting.value || optionsLoading.value || !optionsLoaded.value) return
  const selectedBatch = batchNo.value
  exporting.value = true
  exportError.value = ''
  try {
    await exportDatabaseIssueReport(selectedBatch ? { batchNo: selectedBatch } : {})
    if (alive) emit('close')
  } catch (cause) {
    if (alive) exportError.value = cause?.message || '报表导出失败，请重试'
  } finally {
    if (alive) exporting.value = false
  }
}
onMounted(() => {
  previousFocus = document.activeElement
  dialog.value?.focus()
  loadOptions()
})
onBeforeUnmount(() => {
  alive = false
  optionsSequence++
  if (previousFocus?.isConnected) previousFocus.focus?.()
})
</script>

<style scoped>
.database-report-mask{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.42)}
.database-report-dialog{width:min(500px,100%);max-height:calc(100vh - 40px);overflow:auto;box-sizing:border-box;padding:20px;border:1px solid var(--border,#dce4ec);border-radius:8px;background:var(--bg-card,#fff);color:var(--text-primary,#1f2937);box-shadow:0 18px 48px rgba(15,23,42,.18);font-size:13px;outline:none}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}h3{margin:0;font-size:17px;font-weight:600}header p{margin:6px 0 0;color:var(--text-secondary,#64748b)}
form{display:grid;gap:9px}label{font-weight:600}select{width:100%;height:34px;box-sizing:border-box;padding:0 9px;border:1px solid var(--border,#d7e1e8);border-radius:4px;background:var(--bg-card,#fff);color:inherit;font:inherit}
.report-scope{margin:3px 0 8px;padding:10px;border:1px solid var(--border,#e4eaef);border-radius:4px;background:var(--bg-page,#f5f8fa);color:var(--text-secondary,#64748b);line-height:1.65}
button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:5px 12px;border:1px solid var(--border,#d7e1e8);border-radius:4px;background:var(--bg-card,#fff);color:inherit;font:inherit;cursor:pointer}button:disabled,select:disabled{opacity:.55;cursor:default}button:focus-visible,select:focus-visible{outline:2px solid #0f8884;outline-offset:2px}
.report-close{padding:4px;min-height:26px;border:0}.report-primary{background:#0e8282;border-color:#0e8282;color:#fff}.report-error{margin:0;color:var(--c-error-code-text,#b42318);line-height:1.55}.report-error p{margin:0 0 7px}footer{display:flex;justify-content:flex-end;gap:9px;margin-top:10px;padding-top:12px;border-top:1px solid var(--border,#e4eaef)}
</style>
