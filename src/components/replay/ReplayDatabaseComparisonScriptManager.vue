<template>
  <div v-if="open" class="script-manager-backdrop" @click.self="requestClose" @keydown.esc.stop.prevent="requestClose">
    <section class="script-manager-dialog" role="dialog" aria-modal="true" aria-label="脚本管理">
      <header class="manager-header">
        <div><h3>脚本管理</h3><p>独立维护命名配置，保存时生成并冻结 SQL 脚本</p></div>
        <button type="button" data-testid="close-script-manager" :disabled="busy" @click="requestClose">关闭</button>
      </header>
      <div class="manager-layout">
        <aside class="profile-list">
          <button type="button" class="primary" data-testid="new-script-config" :disabled="busy" @click="newDraft">＋ 新建配置</button>
          <p v-if="listLoading" role="status">正在读取配置…</p>
          <button v-for="profile in profiles" :key="profile.id" type="button" class="profile-item" :class="{ active: profile.id === selectedId }" :data-testid="`script-profile-${profile.id}`" :disabled="busy" @click="selectProfile(profile.id)">
            <strong>{{ profile.name }}</strong><small>修订 {{ profile.revision }} · {{ profile.tableCount }} 张表</small>
          </button>
          <p v-if="!listLoading && !profiles.length" class="muted">暂无命名配置，可新建并导入表清单。</p>
        </aside>
        <main class="manager-editor">
          <p v-if="detailLoading" role="status">正在读取配置明细…</p>
          <div v-if="error" class="manager-error" data-testid="script-manager-errors" role="alert">
            <strong>{{ error }}</strong>
            <ul v-if="validationErrors.length"><li v-for="(item, index) in validationErrors" :key="index"><template v-if="item.row || item.rowNumber">第 {{ item.row || item.rowNumber }} 行 · </template>{{ item.tableName || '' }}<template v-if="item.fieldName"> / {{ item.fieldName }}</template>：{{ item.reason }}</li></ul>
          </div>
          <fieldset :disabled="busy || detailLoading" class="editor-fields">
            <label>配置名称<input v-model="draft.name" data-testid="script-config-name" placeholder="例如：平台全量比对" :disabled="busy || detailLoading" /></label>
            <label>全局忽略字段<textarea v-model="globalText" data-testid="script-global-ignored-fields" :disabled="busy || detailLoading" rows="3" placeholder="字段名用逗号或换行分隔，也可粘贴 ('field_a'), ('field_b')" /></label>
            <p class="muted">全局规则只作用于本套配置；命中主键时自动保留。单表可追加忽略字段。</p>
            <div class="import-toolbar">
              <label>表清单 Excel<input ref="fileInput" type="file" accept=".xlsx,.xls" data-testid="script-tables-file" :disabled="busy || detailLoading" @change="file = $event.target.files?.[0] || null" /></label>
              <button type="button" data-testid="preview-script-tables" :disabled="!file || busy || detailLoading" @click="previewTables">{{ importing ? '预览中…' : '导入预览' }}</button>
            </div>
            <p class="muted">Excel 列：表名、表中文名、分组、负责人、最大hash分区数。导入预览会替换草稿表清单，保存前不落库；分区上限默认 64，支持 1 到 256 的任意整数。</p>
            <div class="table-list-shell">
              <table class="config-tables"><thead><tr><th>表名 / 中文名</th><th>分组</th><th>负责人</th><th>最大hash分区数</th><th>操作</th></tr></thead>
                <tbody><tr v-for="(table, index) in draft.tables" :key="table.tableName" :class="{ selected: index === selectedTableIndex }">
                  <td><button type="button" :data-testid="`select-script-table-${table.tableName}`" :disabled="busy || detailLoading" @click="selectedTableIndex = index">{{ table.tableName }}</button><input v-model="table.tableComment" aria-label="表中文名" :disabled="busy || detailLoading" /></td>
                  <td><select v-model="table.domainName" :aria-label="`${table.tableName} 分组`" :disabled="busy || detailLoading"><option v-for="domain in domains" :key="domain" :value="domain">{{ domain }}</option></select></td>
                  <td><input v-model="table.ownerName" :aria-label="`${table.tableName} 负责人`" :disabled="busy || detailLoading" /></td>
                  <td><input v-model.number="table.maxPartitionNum" type="number" min="1" max="256" step="1" :data-testid="`script-table-max-partitions-${table.tableName}`" :disabled="busy || detailLoading" /></td>
                  <td><button type="button" :data-testid="`remove-script-table-${table.tableName}`" :disabled="busy || detailLoading" @click="removeTable(index)">移除</button></td>
                </tr><tr v-if="!draft.tables.length"><td colspan="5" class="muted">请导入表清单后配置字段</td></tr></tbody>
              </table>
            </div>
            <section v-if="selectedTable" class="field-section" :aria-label="`${selectedTable.tableName} 忽略字段`">
              <h4>{{ selectedTable.tableName }} · 单表忽略字段</h4>
              <p class="muted">勾选表示忽略；主键始终保留。全局忽略字段需在上方统一调整。</p>
              <div class="field-list"><label v-for="field in selectedTable.fields" :key="field.columnName" class="field-option">
                <input type="checkbox" :data-testid="`ignore-script-field-${field.columnName}`" :checked="isIgnored(field)" :disabled="busy || detailLoading || field.primaryKey || globalIgnoredFields.includes(field.columnName)" @change="toggleIgnored(field, $event.target.checked)" />
                <span>{{ field.columnName }}<small v-if="field.columnComment"> / {{ field.columnComment }}</small></span>
                <b v-if="field.primaryKey">主键始终保留</b><small v-else-if="globalIgnoredFields.includes(field.columnName)">全局忽略</small>
              </label></div>
            </section>
          </fieldset>
        </main>
      </div>
      <footer class="manager-footer"><span class="muted">{{ draft.tables.length }} 张表 · {{ selectedId ? `当前修订 ${draft.revision}` : '新配置草稿' }}</span><button type="button" :disabled="busy" @click="requestClose">取消</button><button type="button" class="primary" data-testid="save-script-config" :disabled="busy || detailLoading || listLoading" @click="save">{{ saving ? '保存并生成中…' : '保存并生成脚本' }}</button></footer>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { listScriptConfigurations, getScriptConfiguration, createScriptConfiguration, updateScriptConfiguration, importScriptConfigurationTables } from '../../api/replayDatabaseComparison.js'
const props = defineProps({ open: Boolean })
const emit = defineEmits(['close', 'saved'])
const profiles = ref([]), selectedId = ref(null), selectedTableIndex = ref(0)
const draft = reactive({ name: '', revision: 0, tables: [] })
const globalText = ref(''), file = ref(null), error = ref(''), validationErrors = ref([])
const fileInput = ref(null)
const listLoading = ref(false), detailLoading = ref(false), importing = ref(false), saving = ref(false)
const busy = computed(() => importing.value || saving.value)
const domains = ['存款组', '贷款组', '公共组', '结算组', '平台组']
const selectedTable = computed(() => draft.tables[selectedTableIndex.value])
let session = 0, detailSerial = 0, alive = true
function parseIgnoredFields(value) {
  const source = String(value || '').trim().replace(/[,，\r\n]+$/, '').trim()
  if (!source) return []
  const identifier = '[a-z_][a-z0-9_$]*'
  const token = `(?:${identifier}|'${identifier}'|"${identifier}"|\`${identifier}\`)`
  const listPattern = new RegExp(`^\\s*\\(*\\s*${token}\\s*\\)*(?:\\s*[,，\\r\\n]+\\s*\\(*\\s*${token}\\s*\\)*)*\\s*$`, 'i')
  let depth = 0
  let balanced = true
  for (const character of source) {
    if (character === '(') depth++
    if (character === ')' && --depth < 0) balanced = false
  }
  if (!listPattern.test(source) || !balanced || depth !== 0) throw new Error('全局忽略字段只接受字段名，请使用逗号或换行分隔')
  const values = source.replace(/[()'"`]/g, '').split(/[,，\r\n]+/).map(item => item.trim().toLowerCase()).filter(Boolean)
  if (values.some(value => !/^[a-z_][a-z0-9_$]*$/.test(value))) throw new Error('全局忽略字段只接受字段名，请使用逗号或换行分隔')
  return [...new Set(values)]
}
const globalIgnoredFields = computed(() => { try { return parseIgnoredFields(globalText.value) } catch { return [] } })
const canonicalNames = values => [...new Set((values || []).map(value => String(value).trim().toLowerCase()).filter(Boolean))]
function normalizeTable(table) {
  return { tableName: String(table.tableName || '').trim().toLowerCase(), tableComment: table.tableComment || '', domainName: table.domainName || '', ownerName: table.ownerName || '', maxPartitionNum: table.maxPartitionNum ?? 64,
    ignoredFields: canonicalNames(table.ignoredFields), fields: (table.fields || []).map(field => ({ ...field, columnName: String(field.columnName || '').toLowerCase() })) }
}
function clearError() { error.value = ''; validationErrors.value = [] }
function showError(cause, fallback) { error.value = cause?.message || fallback; validationErrors.value = cause?.data?.errors || [] }
function resetFileSelection() { file.value = null; if (fileInput.value) fileInput.value.value = '' }
function resetDraft() { selectedId.value = null; Object.assign(draft, { name: '', revision: 0, tables: [] }); globalText.value = ''; resetFileSelection(); selectedTableIndex.value = 0; clearError() }
function current(token, serial = detailSerial) { return alive && props.open && token === session && serial === detailSerial }
function newDraft() { if (busy.value) return; detailSerial++; detailLoading.value = false; resetDraft() }
function requestClose() { if (!busy.value) emit('close') }
async function loadList(token) {
  listLoading.value = true
  try { const result = await listScriptConfigurations(); if (alive && props.open && token === session) profiles.value = result?.items || [] }
  catch (cause) { if (alive && props.open && token === session) showError(cause, '配置列表读取失败') }
  finally { if (alive && token === session) listLoading.value = false }
}
async function selectProfile(id) {
  if (busy.value) return
  const token = session, serial = ++detailSerial
  resetDraft(); selectedId.value = id; detailLoading.value = true
  try {
    const result = await getScriptConfiguration(id)
    if (!current(token, serial)) return
    Object.assign(draft, { name: result.name, revision: result.revision, tables: (result.tables || []).map(normalizeTable) })
    globalText.value = canonicalNames(result.globalIgnoredFields).join('\n'); selectedTableIndex.value = 0; resetFileSelection()
  } catch (cause) { if (current(token, serial)) showError(cause, '配置明细读取失败') }
  finally { if (current(token, serial)) detailLoading.value = false }
}
async function previewTables() {
  if (!file.value || busy.value || detailLoading.value) return
  const token = session, serial = ++detailSerial
  importing.value = true; clearError()
  try { const result = await importScriptConfigurationTables(file.value); if (current(token, serial)) { draft.tables = (result.tables || []).map(normalizeTable); selectedTableIndex.value = 0 } }
  catch (cause) { if (current(token, serial)) showError(cause, '表清单预览失败') }
  finally { if (current(token, serial)) importing.value = false }
}
function removeTable(index) { if (busy.value || detailLoading.value) return; draft.tables.splice(index, 1); selectedTableIndex.value = Math.min(selectedTableIndex.value, Math.max(0, draft.tables.length - 1)) }
function isIgnored(field) { return !field.primaryKey && (globalIgnoredFields.value.includes(field.columnName) || selectedTable.value?.ignoredFields.includes(field.columnName)) }
function toggleIgnored(field, checked) {
  if (busy.value || detailLoading.value || field.primaryKey || globalIgnoredFields.value.includes(field.columnName)) return
  selectedTable.value.ignoredFields = checked ? [...new Set([...selectedTable.value.ignoredFields, field.columnName])] : selectedTable.value.ignoredFields.filter(name => name !== field.columnName)
}
async function save() {
  if (busy.value || detailLoading.value || listLoading.value) return
  clearError()
  let payload
  try {
    if (!draft.name.trim()) throw new Error('请填写配置名称')
    if (!draft.tables.length) throw new Error('请先导入至少一张表')
    const globalIgnoredFields = parseIgnoredFields(globalText.value)
    const tables = draft.tables.map(({ fields, ...table }) => {
      if (!Number.isInteger(Number(table.maxPartitionNum)) || Number(table.maxPartitionNum) < 1 || Number(table.maxPartitionNum) > 256) throw new Error(`${table.tableName} 最大hash分区数必须为 1 到 256 的整数`)
      return { ...table, maxPartitionNum: Number(table.maxPartitionNum), ignoredFields: canonicalNames(table.ignoredFields) }
    })
    payload = { name: draft.name.trim(), revision: draft.revision, globalIgnoredFields, tables }
  } catch (cause) { showError(cause, '配置校验失败'); return }
  const token = session, serial = ++detailSerial, id = selectedId.value
  saving.value = true
  try { const result = id === null ? await createScriptConfiguration(payload) : await updateScriptConfiguration(id, payload); if (current(token, serial)) { emit('saved', result); emit('close') } }
  catch (cause) { if (current(token, serial)) showError(cause, '保存配置失败') }
  finally { if (current(token, serial)) saving.value = false }
}
watch(() => props.open, value => {
  const token = ++session; detailSerial++; importing.value = false; saving.value = false; detailLoading.value = false
  resetDraft()
  if (value) loadList(token)
}, { immediate: true })
onBeforeUnmount(() => { alive = false; session++; detailSerial++ })
</script>

<style scoped>
.script-manager-backdrop{position:fixed;inset:0;z-index:1700;display:grid;place-items:center;padding:20px;background:rgba(18,29,43,.5)}.script-manager-dialog{box-sizing:border-box;width:min(1380px,96vw);height:min(900px,94vh);display:flex;flex-direction:column;overflow:hidden;border-radius:8px;background:#f8fafb;color:#334155;box-shadow:0 20px 60px #14243555;font-size:13px}.manager-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:white;border-bottom:1px solid #dbe3eb}.manager-header h3,.field-section h4{margin:0}.manager-header p{margin:4px 0 0;color:#7a8795;font-size:12px}.manager-layout{display:grid;grid-template-columns:220px minmax(0,1fr);flex:1;min-height:0}.profile-list{display:flex;flex-direction:column;gap:8px;padding:14px;overflow:auto;background:white;border-right:1px solid #dbe3eb}.profile-item{text-align:left}.profile-item strong,.profile-item small{display:block;overflow-wrap:anywhere}.profile-item small{margin-top:5px;color:#788595}.profile-item.active{border-color:#168478;background:#edf8f6}.manager-editor{min-width:0;padding:16px 20px;overflow:auto}.editor-fields{display:grid;gap:10px;min-width:0;margin:0;padding:0;border:0}.editor-fields>label{display:grid;gap:6px}.editor-fields input,.editor-fields select,.editor-fields textarea{box-sizing:border-box;min-width:0;width:100%;border:1px solid #cfd9e3;border-radius:4px;padding:7px 9px;font:inherit;color:inherit;background:white}.editor-fields textarea{resize:vertical}.script-manager-dialog button{padding:7px 12px;border:1px solid #cbd5df;border-radius:4px;background:white;color:inherit;font:inherit;cursor:pointer}.script-manager-dialog button.primary{background:#168478;color:white;border-color:#168478}.script-manager-dialog :disabled{opacity:.6;cursor:not-allowed}.script-manager-dialog :focus-visible{outline:2px solid #168478;outline-offset:2px}.muted{margin:0;color:#758294;font-size:12px;line-height:1.6}.import-toolbar{display:flex;align-items:end;gap:10px}.import-toolbar label{display:grid;gap:6px;flex:1;min-width:0}.import-toolbar button{white-space:nowrap}.table-list-shell{max-height:280px;overflow:auto;border:1px solid #dbe3eb;border-radius:5px;background:white}.config-tables{width:100%;min-width:720px;border-collapse:collapse;font-size:12px}.config-tables th,.config-tables td{padding:8px;text-align:left;border-bottom:1px solid #e5ebf0;vertical-align:top}.config-tables th{position:sticky;top:0;background:#edf3f7;z-index:1;white-space:nowrap}.config-tables td:first-child{min-width:180px}.config-tables td:first-child button{border:0;padding:2px 0;color:#087b70;font-weight:600;text-align:left;overflow-wrap:anywhere}.config-tables td:first-child input{margin-top:5px}.config-tables td:nth-child(2){min-width:95px}.config-tables td:nth-child(3){min-width:120px}.config-tables td:nth-child(4){width:140px}.config-tables tr.selected{background:#f0faf7}.field-section{padding:12px;border:1px solid #dbe3eb;border-radius:5px;background:white}.field-section>p{margin:6px 0 10px}.field-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px;max-height:260px;overflow:auto}.field-option{display:flex;align-items:center;gap:7px;padding:8px 0;min-width:0;overflow-wrap:anywhere}.field-option input{width:auto;flex-shrink:0}.field-option span{min-width:0}.field-option b{font-size:11px;color:#b06a15}.field-option small{color:#81909e}.manager-error{margin-bottom:12px;padding:10px 12px;border:1px solid #edb6b6;border-radius:4px;background:#fff1f1;color:#a43434}.manager-error ul{max-height:140px;overflow:auto;padding-left:20px;margin:6px 0 0}.manager-footer{display:flex;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid #dbe3eb;background:white}.manager-footer>span{margin-right:auto}@media(max-width:760px){.script-manager-backdrop{padding:8px}.script-manager-dialog{width:100%;height:96vh}.manager-layout{grid-template-columns:minmax(0,1fr);grid-template-rows:140px minmax(0,1fr)}.profile-list{border-right:0;border-bottom:1px solid #dbe3eb}.manager-editor{padding:12px}.field-list{grid-template-columns:minmax(0,1fr)}.manager-header,.manager-footer{padding:12px}.import-toolbar{flex-wrap:wrap}}
</style>
