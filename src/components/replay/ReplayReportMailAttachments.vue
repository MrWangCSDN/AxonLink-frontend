<template>
  <section class="mail-attachments" data-testid="mail-attachments">
    <div class="mail-attachments__heading">
      <div>
        <strong>邮件附件</strong>
        <span>共 {{ attachmentCount }} 个附件 / {{ formatSize(totalSize) }}</span>
      </div>
      <div class="mail-attachments__actions">
        <button type="button" data-testid="mail-add-generated" :disabled="disabled" @click="openSelector">
          添加已生成日报
        </button>
        <label :class="{ 'is-disabled': disabled }">
          添加本地 Excel
          <input data-testid="mail-local-files" type="file" accept=".xls,.xlsx" multiple
                 :disabled="disabled" @change="onLocalFiles" />
        </label>
      </div>
    </div>

    <div class="mail-attachments__list">
      <div class="mail-attachment-row is-current" data-testid="mail-current-attachment">
        <span class="mail-attachment-row__type">当前</span>
        <div><strong>{{ currentAttachment?.fileName || '当前报表.xlsx' }}</strong><small>系统自动附加，不可删除或替换</small></div>
        <em>{{ formatSize(attachmentSize(currentAttachment)) }}</em>
      </div>
      <div v-for="report in selectedReports" :key="report.batchNo" class="mail-attachment-row">
        <span class="mail-attachment-row__type">{{ report.family || '日报' }}</span>
        <div><strong>{{ report.fileName }}</strong><small>{{ report.batchNo }}</small></div>
        <em>{{ formatSize(attachmentSize(report)) }}</em>
        <button type="button" :disabled="disabled" :aria-label="`删除附件 ${report.fileName}`"
                @click="removeReport(report.batchNo)">删除</button>
      </div>
      <div v-for="(file, index) in localFiles" :key="`${file.name}-${file.size}-${index}`" class="mail-attachment-row">
        <span class="mail-attachment-row__type">本地</span>
        <div><strong>{{ file.name }}</strong><small>仅用于本次发送</small></div>
        <em>{{ formatSize(file.size) }}</em>
        <button type="button" :disabled="disabled" :aria-label="`删除附件 ${file.name}`"
                @click="removeLocal(index)">删除</button>
      </div>
    </div>
    <small v-if="validationError" class="mail-attachments__error">{{ validationError }}</small>

    <div v-if="selectorOpen" class="mail-selector" data-testid="mail-generated-selector">
      <div class="mail-selector__toolbar">
        <input v-model="keyword" type="search" placeholder="按批次号或文件名搜索" :disabled="loading || disabled"
               @input="scheduleSearch" />
        <select v-model="family" :disabled="loading || disabled" @change="changeFamily">
          <option value="ALL">全部</option>
          <option value="RPT">查询日报</option>
          <option value="DZ">账务日报</option>
        </select>
        <button type="button" :disabled="disabled" @click="selectorOpen = false">完成</button>
      </div>
      <p v-if="loading" class="mail-selector__state">正在加载日报…</p>
      <p v-else-if="loadError" class="mail-selector__state is-error">{{ loadError }}</p>
      <p v-else-if="!options.length" class="mail-selector__state">没有找到已生成日报</p>
      <div v-else class="mail-selector__options">
        <button v-for="option in options" :key="option.batchNo" type="button"
                :data-testid="`mail-generated-option-${option.batchNo}`"
                :disabled="disabled || option.batchNo === currentAttachment?.batchNo || isSelected(option.batchNo)"
                @click="addReport(option)">
          <span><strong>{{ option.fileName }}</strong><small>{{ option.batchNo }}</small></span>
          <em v-if="option.batchNo === currentAttachment?.batchNo" data-testid="mail-generated-current-hint">当前附件</em>
          <em v-else-if="isSelected(option.batchNo)">已添加</em>
          <em v-else>{{ formatSize(attachmentSize(option)) }}</em>
        </button>
      </div>
      <footer v-if="total > size" class="mail-selector__pager">
        <button type="button" :disabled="page <= 0 || loading" @click="goPage(page - 1)">上一页</button>
        <span>{{ page + 1 }} / {{ Math.ceil(total / size) }}</span>
        <button type="button" :disabled="(page + 1) * size >= total || loading" @click="goPage(page + 1)">下一页</button>
      </footer>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getReplayReportAttachmentOptions } from '../../api/replayIssues.js'

const MAX_LOCAL_SIZE = 20 * 1024 * 1024
const MAX_TOTAL_SIZE = 50 * 1024 * 1024

const props = defineProps({
  currentAttachment: { type: Object, default: () => ({}) },
  selectedReports: { type: Array, default: () => [] },
  localFiles: { type: Array, default: () => [] },
  disabled: Boolean,
})
const emit = defineEmits(['update:selectedReports', 'update:localFiles', 'validation-change'])

const selectorOpen = ref(false)
const keyword = ref('')
const family = ref('ALL')
const page = ref(0)
const size = 20
const total = ref(0)
const options = ref([])
const loading = ref(false)
const loadError = ref('')
const localSelectionError = ref('')
let searchTimer

const attachmentSize = item => Number(item?.size ?? item?.fileSize ?? 0)
const totalSize = computed(() => attachmentSize(props.currentAttachment)
  + props.selectedReports.reduce((sum, item) => sum + attachmentSize(item), 0)
  + props.localFiles.reduce((sum, file) => sum + Number(file?.size || 0), 0))
const attachmentCount = computed(() => 1 + props.selectedReports.length + props.localFiles.length)
const validationError = computed(() => localSelectionError.value
  || (props.localFiles.find(file => Number(file?.size || 0) > MAX_LOCAL_SIZE)
    ? `单个附件不能超过20MB：${props.localFiles.find(file => Number(file?.size || 0) > MAX_LOCAL_SIZE).name}`
    : '')
  || (totalSize.value > MAX_TOTAL_SIZE ? '附件总大小不能超过50MB' : ''))

watch([validationError, totalSize, attachmentCount], () => {
  emit('validation-change', {
    valid: !validationError.value,
    error: validationError.value,
    totalSize: totalSize.value,
    count: attachmentCount.value,
  })
}, { immediate: true })

function formatSize(bytes) {
  const value = Number(bytes || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

async function loadOptions() {
  loading.value = true
  loadError.value = ''
  try {
    const result = await getReplayReportAttachmentOptions({
      keyword: keyword.value.trim(), family: family.value, page: page.value, size,
    })
    options.value = result?.items || []
    total.value = Number(result?.total || 0)
  } catch (cause) {
    options.value = []
    total.value = 0
    loadError.value = `加载已生成日报失败：${cause?.message || cause}`
  } finally {
    loading.value = false
  }
}

function openSelector() {
  selectorOpen.value = true
  loadOptions()
}

function scheduleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 0
    loadOptions()
  }, 300)
}

function changeFamily() {
  page.value = 0
  loadOptions()
}

function goPage(nextPage) {
  page.value = nextPage
  loadOptions()
}

function isSelected(batchNo) {
  return props.selectedReports.some(item => item.batchNo === batchNo)
}

function addReport(option) {
  if (option.batchNo === props.currentAttachment?.batchNo || isSelected(option.batchNo)) return
  emit('update:selectedReports', [...props.selectedReports, option])
}

function removeReport(batchNo) {
  emit('update:selectedReports', props.selectedReports.filter(item => item.batchNo !== batchNo))
}

function onLocalFiles(event) {
  const chosen = Array.from(event.target.files || [])
  const invalid = chosen.find(file => !/\.xlsx?$/i.test(file.name))
  const oversized = chosen.find(file => file.size > MAX_LOCAL_SIZE)
  localSelectionError.value = invalid
    ? `附件仅支持 Excel：${invalid.name}`
    : oversized ? `单个附件不能超过20MB：${oversized.name}` : ''
  const validFiles = chosen.filter(file => /\.xlsx?$/i.test(file.name) && file.size <= MAX_LOCAL_SIZE)
  emit('update:localFiles', [...props.localFiles, ...validFiles])
  emit('validation-change', {
    valid: !localSelectionError.value,
    error: localSelectionError.value,
    totalSize: totalSize.value + validFiles.reduce((sum, file) => sum + file.size, 0),
    count: attachmentCount.value + validFiles.length,
  })
  event.target.value = ''
}

function removeLocal(index) {
  localSelectionError.value = ''
  emit('update:localFiles', props.localFiles.filter((_, itemIndex) => itemIndex !== index))
}

onBeforeUnmount(() => clearTimeout(searchTimer))
</script>

<style scoped>
.mail-attachments { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 12px 0; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.mail-attachments__heading, .mail-selector__toolbar, .mail-selector__pager { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.mail-attachments__heading { flex-wrap: wrap; }
.mail-attachments__heading > div:first-child { display: grid; gap: 2px; }
.mail-attachments__heading span, .mail-attachment-row small { color: #64748b; font-size: 12px; }
.mail-attachments__actions { display: flex; gap: 8px; }
.mail-attachments button, .mail-attachments__actions label { border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #334155; padding: 6px 10px; font-size: 12px; cursor: pointer; }
.mail-attachments button:disabled, .mail-attachments__actions .is-disabled { opacity: .5; cursor: not-allowed; }
.mail-attachments__actions input[type="file"] { display: none; }
.mail-attachments__list { display: grid; gap: 6px; max-height: 180px; overflow: auto; }
.mail-attachment-row { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 7px; background: #f8fafc; }
.mail-attachment-row.is-current { background: #eff6ff; }
.mail-attachment-row__type { color: #2563eb; font-size: 12px; font-weight: 700; }
.mail-attachment-row div { min-width: 0; display: grid; }
.mail-attachment-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.mail-attachment-row em, .mail-selector em { color: #64748b; font-size: 12px; font-style: normal; white-space: nowrap; }
.mail-attachment-row button { border: 0; padding: 3px 5px; background: transparent; color: #dc2626; }
.mail-attachments__error, .mail-selector__state.is-error { color: #dc2626; }
.mail-selector { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 10px; border: 1px solid #dbeafe; border-radius: 8px; background: #f8fbff; }
.mail-selector__toolbar input { min-width: 0; flex: 1; }
.mail-selector__toolbar input, .mail-selector__toolbar select { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 9px; background: #fff; }
.mail-selector__state { margin: 8px 0; text-align: center; color: #64748b; font-size: 13px; }
.mail-selector__options { display: grid; gap: 5px; max-height: 210px; overflow: auto; }
.mail-selector__options > button { display: flex; align-items: center; justify-content: space-between; text-align: left; }
.mail-selector__options span { display: grid; min-width: 0; }
.mail-selector__options small { color: #64748b; }
.mail-selector__pager { justify-content: center; }
</style>
