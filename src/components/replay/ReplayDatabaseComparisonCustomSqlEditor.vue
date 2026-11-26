<template>
  <div class="custom-sql-backdrop">
    <section class="custom-sql-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-sql-title" data-testid="custom-sql-dialog">
      <header>
        <div><h3 id="custom-sql-title">{{ initialRegistration?.deleted ? '重新登记自定义 SQL' : initialRegistration ? '编辑自定义 SQL' : '自定义 SQL 登记' }}</h3><p>两侧共用一条单表 SELECT，支持计算列及聚合查询</p></div>
        <button type="button" aria-label="关闭自定义 SQL" data-testid="close-custom-sql" :disabled="saving" @click="emit('close')">×</button>
      </header>
      <div class="custom-sql-body">
        <label>SQL<textarea v-model="sql" data-testid="custom-sql-text" rows="10" spellcheck="false" :disabled="saving" placeholder="SELECT currency, SUM(amount) AS total_amt FROM account GROUP BY currency" /></label>
        <p class="help">使用无 schema 的基础表名，按 BASE 母库解析校验并自动提取表英文名和中文注释。计算列需提供唯一英文别名，LIMIT 请通过下方比对条数设置。</p>
        <button type="button" class="analyze-button" data-testid="analyze-custom-sql" :disabled="!sql.trim() || analyzing || saving" @click="analyze">{{ analyzing ? '解析中…' : '校验并解析结果字段' }}</button>
        <dl v-if="analysis || lockedSource" class="source-metadata">
          <dt>表英文名</dt><dd><span data-testid="custom-sql-table-name">{{ registeredTableName }}</span><small v-if="lockedSource">登记表在创建后固定</small></dd>
          <dt>表中文名</dt><dd data-testid="custom-sql-table-comment">{{ registeredTableComment || '-' }}</dd>
          <dt>领域</dt><dd>{{ analysis?.domainName || initialRegistration?.domainName || initialRegistration?.domain || '-' }}</dd>
          <dt>开发负责人</dt><dd>{{ analysis?.reviserName || initialRegistration?.reviserName || initialRegistration?.reviser || '-' }}</dd>
          <dt>科技负责人</dt><dd>{{ analysis?.groupOwnerName || initialRegistration?.groupOwnerName || initialRegistration?.groupOwner || '-' }}</dd>
        </dl>
        <section v-if="analysis" class="result-columns">
          <h4>选择并排序结果字段</h4>
          <p class="help">键字段须参与比对。结果键需非空且唯一，BD 归一化后的组合键 JSON 长度上限为 1000。全表 SUM 可显式返回常量键 ALL。</p>
          <div class="columns-scroll"><table>
            <thead><tr><th>参与比对</th><th>结果字段</th><th>类型</th><th>结果比对键</th></tr></thead>
            <tbody><tr v-for="column in analysis.resultColumns" :key="column.columnName">
              <td><input type="checkbox" :aria-label="`参与比对 ${column.columnName}`" :data-testid="`sql-select-${column.columnName}`" :checked="selectedNames.includes(column.columnName)" :disabled="saving || keyNames.includes(column.columnName)" @change="toggleField(column.columnName, $event.target.checked)" /></td>
              <td>{{ column.columnName }}<small v-if="column.columnLabel && column.columnLabel !== column.columnName">{{ column.columnLabel }}</small></td>
              <td>{{ column.dataType || '-' }}</td>
              <td><input type="checkbox" :aria-label="`结果比对键 ${column.columnName}`" :data-testid="`sql-key-${column.columnName}`" :checked="keyNames.includes(column.columnName)" :disabled="saving || !selectedNames.includes(column.columnName)" @change="toggleKey(column.columnName, $event.target.checked)" /></td>
            </tr></tbody>
          </table></div>
          <h4>输出顺序</h4>
          <ol class="output-order"><li v-for="(name, index) in selectedNames" :key="name"><span>{{ name }} <b v-if="keyNames.includes(name)">结果比对键</b></span><button type="button" :data-testid="`sql-move-up-${name}`" :aria-label="`上移 ${name}`" :disabled="saving || index === 0" @click="moveField(index, -1)">↑</button><button type="button" :aria-label="`下移 ${name}`" :disabled="saving || index === selectedNames.length - 1" @click="moveField(index, 1)">↓</button></li></ol>
        </section>
        <p v-else class="help">SQL 修改后需重新解析结果字段，再确认参与比对的字段和结果键。</p>
        <div class="limits">
          <label>比对条数<input v-model="compareLimit" type="number" min="1" max="10000000" data-testid="custom-sql-limit" :disabled="saving" placeholder="留空表示全部结果" /></label>
          <label>样本数<select v-model="sampleLimitMode" data-testid="custom-sql-sample-mode" :disabled="saving || !canConfigurePartitions"><option value="LIMITED">指定数量</option><option value="ALL">全量</option></select></label>
          <label v-show="sampleLimitMode === 'LIMITED'">指定样本数<input v-model.number="sampleLimit" type="number" min="0" max="10000" step="1" data-testid="custom-sql-sample" :disabled="sampleLimitMode === 'ALL' || saving || !canConfigurePartitions" /></label>
          <label>最大hash分区数<input v-model.number="maxPartitionNum" type="number" min="1" max="256" step="1" data-testid="custom-sql-max-partition" :disabled="saving" /></label>
          <label>读取分区数<input v-model.number="partitionNum" type="number" min="1" max="256" data-testid="custom-sql-partition" :disabled="saving || !canConfigurePartitions" /></label>
        </div>
        <p class="help">比对条数在聚合查询外层按结果键排序后截取。最大hash分区数为 1–256 的整数，默认 64。指定样本数为 0–10000，默认 100；0 表示仅汇总。全量保存比对范围内的全部差异行，字段值展示长度沿用现有限制。样本数与读取分区数由有配置权限的人员修改。</p>
        <p v-if="validationMessage" class="validation-message" role="status">{{ validationMessage }}</p>
        <div v-if="errorMessage" class="sql-error" data-testid="custom-sql-error" role="alert"><p>{{ errorMessage }}</p><ul v-if="saveError?.data?.errors?.length"><li v-for="(item, index) in saveError.data.errors" :key="index">{{ item.fieldName || item.path || '' }} {{ item.reason }}</li></ul><button v-if="canOpenExistingRegistration" type="button" data-testid="open-existing-custom-sql" :disabled="saving || loadingExisting" @click="emit('open-existing', saveError.data.existingId)">{{ loadingExisting ? '加载中…' : '进入原登记' }}</button></div>
      </div>
      <footer><button type="button" :disabled="saving" @click="emit('close')">取消</button><button type="button" class="primary" data-testid="save-custom-sql" :disabled="!canSave" @click="save">{{ saving ? '保存中…' : initialRegistration?.deleted ? '重新登记' : '保存' }}</button></footer>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { analyzeCustomSql } from '../../api/replayDatabaseComparison.js'
import { validateScopeDraft } from './replayDatabaseComparisonScope.js'

const props = defineProps({
  initialRegistration: { type: Object, default: null },
  analyzeSql: { type: Function, default: analyzeCustomSql },
  canConfigurePartitions: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  loadingExisting: { type: Boolean, default: false },
  saveError: { type: Object, default: null },
})
const emit = defineEmits(['close', 'save', 'clear-error', 'open-existing'])
const initial = props.initialRegistration
const lockedSource = initial?.customSql?.sourceTableName || initial?.sourceTableName || initial?.tableName || ''
const sql = ref(initial?.customSql?.sql || '')
const compareLimit = ref(initial?.compareLimit ?? '')
const sampleLimitMode = ref(initial?.sampleLimit === -1 ? 'ALL' : 'LIMITED')
const sampleLimit = ref(initial?.sampleLimit === -1 ? 100 : initial?.sampleLimit ?? 100)
const partitionNum = ref(initial?.partitionNum ?? 1)
const maxPartitionNum = ref(initial?.maxPartitionNum ?? 64)
const analysis = ref(initial?.customSql ? { ...initial.customSql } : null)
const registeredTableName = computed(() => analysis.value?.sourceTableName || lockedSource)
const registeredTableComment = computed(() => analysis.value?.sourceTableComment !== undefined
  ? analysis.value.sourceTableComment
  : initial?.tableComment ?? '')
const selectedNames = ref((initial?.fields || []).map(field => field.columnName || field.name))
const keyNames = ref([...(initial?.comparisonKey?.columnNames || [])])
const analyzedInput = ref(initial?.customSql?.sql || '')
const analyzing = ref(false)
const analysisError = ref('')
let analysisSequence = 0

watch(sql, () => {
  analysisSequence++
  analyzing.value = false
  analysis.value = null
  analyzedInput.value = ''
  selectedNames.value = []
  keyNames.value = []
  analysisError.value = ''
  emit('clear-error')
})
const validationMessage = computed(() => {
  if (new TextEncoder().encode(sql.value).length > 65535) return 'SQL 的 UTF-8 大小不能超过 65535 字节'
  if (!analysis.value || analyzedInput.value !== sql.value) return '请先校验并解析 SQL'
  if (!selectedNames.value.length) return '请选择参与比对的结果字段'
  if (!keyNames.value.length) return '请选择非空且唯一的结果比对键'
  const scopeError = validateScopeDraft(null, compareLimit.value)[0]
  if (scopeError) return scopeError.reason
  if (!Number.isInteger(maxPartitionNum.value) || maxPartitionNum.value < 1 || maxPartitionNum.value > 256) return '最大hash分区数必须为 1 至 256 的整数'
  if (props.canConfigurePartitions && sampleLimitMode.value !== 'ALL' && (!Number.isInteger(sampleLimit.value) || sampleLimit.value < 0 || sampleLimit.value > 10000)) return '样本数必须为 0 至 10000 的整数'
  if (props.canConfigurePartitions && (!Number.isInteger(partitionNum.value) || partitionNum.value < 1 || partitionNum.value > 256)) return '读取分区数必须为 1 至 256 的整数'
  return ''
})
const canSave = computed(() => !props.saving && !props.loadingExisting && !analyzing.value && !validationMessage.value)
const errorMessage = computed(() => analysisError.value || props.saveError?.message || '')
const canOpenExistingRegistration = computed(() => props.saveError?.status === 409
  && props.saveError?.code === 'DUPLICATE_REGISTRATION' && props.saveError?.data?.existingId != null)

const analyze = async () => {
  const requestedSql = sql.value
  const request = ++analysisSequence
  const previousFields = [...selectedNames.value]
  const previousKeys = [...keyNames.value]
  analysisError.value = ''
  analysis.value = null
  emit('clear-error')
  analyzing.value = true
  try {
    const result = await props.analyzeSql(requestedSql)
    if (request !== analysisSequence || sql.value !== requestedSql) return
    if (lockedSource && result.sourceTableName?.toLocaleLowerCase() !== lockedSource.toLocaleLowerCase()) {
      analysisError.value = `登记表在创建后固定为 ${lockedSource}`
      return
    }
    analysis.value = result
    analyzedInput.value = requestedSql
    const names = result.resultColumns.map(column => column.columnName)
    selectedNames.value = previousFields.length ? previousFields.filter(name => names.includes(name)) : names
    keyNames.value = previousKeys.length ? previousKeys.filter(name => selectedNames.value.includes(name))
      : (result.candidateKeyColumns || []).filter(name => selectedNames.value.includes(name))
  } catch (error) {
    if (request === analysisSequence) analysisError.value = error?.message || 'SQL 解析失败，请修正后重试'
  } finally {
    if (request === analysisSequence) analyzing.value = false
  }
}
const toggleField = (name, selected) => {
  if (keyNames.value.includes(name)) return
  selectedNames.value = selected ? [...selectedNames.value, name] : selectedNames.value.filter(value => value !== name)
}
const toggleKey = (name, selected) => {
  keyNames.value = selected ? [...keyNames.value, name] : keyNames.value.filter(value => value !== name)
}
const moveField = (index, offset) => {
  const ordered = [...selectedNames.value]
  const [name] = ordered.splice(index, 1)
  ordered.splice(index + offset, 0, name)
  selectedNames.value = ordered
}
const save = () => {
  if (!canSave.value) return
  emit('save', {
    ...(initial ? { id: initial.id, version: initial.version } : {}),
    sourceTableName: lockedSource || analysis.value.sourceTableName,
    sql: analysis.value.sql || sql.value,
    fieldNames: [...selectedNames.value],
    resultKeyColumns: selectedNames.value.filter(name => keyNames.value.includes(name)),
    compareLimit: compareLimit.value === '' ? null : Number(compareLimit.value),
    maxPartitionNum: maxPartitionNum.value,
    ...(props.canConfigurePartitions ? { sampleLimit: sampleLimitMode.value === 'ALL' ? -1 : sampleLimit.value, partitionNum: partitionNum.value } : {}),
  })
}
onBeforeUnmount(() => { analysisSequence++ })
</script>

<style scoped>
.custom-sql-backdrop { position: fixed; inset: 0; z-index: 1700; display: grid; place-items: center; padding: 20px; background: color-mix(in srgb, var(--text-primary) 35%, transparent); }
.custom-sql-dialog { width: min(1050px, calc(100vw - 40px)); max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); color: var(--text-primary); }
header, footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; border-bottom: 1px solid var(--border); }
footer { border-top: 1px solid var(--border); border-bottom: 0; justify-content: flex-end; }
h3, h4, p { margin: 0; }
header p, .help, small { color: var(--text-muted); font-size: 12px; line-height: 1.6; }
.custom-sql-body { display: grid; gap: 12px; padding: 18px; overflow: auto; }
label { display: grid; gap: 6px; font-size: 13px; }
input, select, textarea, button { padding: 8px 10px; border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary); background: var(--bg-input); font: inherit; }
textarea { resize: vertical; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
button { cursor: pointer; background: var(--bg-card); }
button:disabled, input:disabled, select:disabled { opacity: .65; cursor: not-allowed; }
.primary { background: var(--text-active); color: var(--btn-primary-text); }
.analyze-button { justify-self: start; }
.source-metadata { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 7px 12px; margin: 0; font-size: 13px; }
dd { margin: 0; overflow-wrap: anywhere; }
small { display: block; }
.result-columns { display: grid; gap: 10px; }
.columns-scroll { max-height: 280px; overflow: auto; border: 1px solid var(--border); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 8px; text-align: left; border-bottom: 1px solid var(--border); }
th { position: sticky; top: 0; background: var(--code-header-bg); }
.output-order { display: grid; gap: 6px; padding-left: 24px; margin: 0; }
.output-order li { display: flex; align-items: center; gap: 8px; }
.output-order span { flex: 1; overflow-wrap: anywhere; }
.output-order b { color: var(--text-muted); font-size: 12px; }
.limits { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.limits input, .limits select { min-width: 0; }
.validation-message { font-size: 12px; color: var(--text-muted); }
.sql-error { padding: 10px; border: 1px solid var(--c-error-code-text); color: var(--c-error-code-text); background: var(--bg-card); }
@media (max-width: 700px) { .limits { grid-template-columns: 1fr; } }
</style>
