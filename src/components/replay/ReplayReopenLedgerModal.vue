<template>
  <div class="reopen-mask">
    <section class="reopen-workbench" role="dialog" aria-modal="true" aria-label="重开责任调整台账">
      <header class="reopen-heading">
        <div>
          <h2>重开责任调整台账</h2>
          <p>按发生批次查看人员重开责任分布，责任调整后按当前负责人统计。</p>
        </div>
        <button type="button" aria-label="关闭重开台账" :disabled="countTransferBusy" @click="requestClose">关闭</button>
      </header>
      <p v-if="booting" role="status">正在读取台账权限…</p>
      <p v-else-if="permissions && !permissions.enabled" role="status">重开台账尚未启用，请完成数据迁移与权限配置后启用。</p>
      <p v-if="error" role="alert" class="reopen-error">{{ error }}</p>
      <p v-if="permissionsError" role="alert" class="reopen-error">{{ permissionsError }}</p>
      <p v-if="success" role="status" class="reopen-success">{{ success }}</p>
      <template v-if="permissions?.enabled">
        <h3>人员与批次统计</h3>
        <form class="reopen-filters" @submit.prevent="applyFilters">
          <label>
            交易类型
            <select v-model="filters.replayType" data-testid="replay-type-filter" :disabled="countTransferBusy" @change="changeReplayType">
              <option value="ALL">全部</option>
              <option value="QUERY">查询</option>
              <option value="DZ">动账</option>
            </select>
          </label>
          <div class="reopen-batch-filter">
            <span id="reopen-batch-label">发生批次</span>
            <details ref="batchPicker" class="reopen-batch-picker" data-testid="batch-filter" @keydown.esc="closeBatchPicker">
              <summary aria-labelledby="reopen-batch-label reopen-batch-summary">
                <span id="reopen-batch-summary">{{ filters.batchNames.length ? `已选择 ${filters.batchNames.length} 个批次` : '全部发生批次' }}</span>
              </summary>
              <div class="reopen-batch-options" role="group" aria-label="选择发生批次">
                <label class="reopen-checkbox">
                  <input type="checkbox" data-testid="all-batches-option" :checked="!filters.batchNames.length" :disabled="countTransferBusy" @change="selectAllBatches" />
                  全部发生批次
                </label>
                <p v-if="optionsLoading" role="status">正在读取发生批次…</p>
                <div class="reopen-batch-columns" :class="{ 'single-family': filters.replayType !== 'ALL' }">
                  <section v-for="family in batchFamilies" :key="family.key" class="reopen-batch-family" :class="{ 'other-family': family.key === 'OTHER' }" role="group" :aria-label="family.label">
                    <h4>{{ family.label }}</h4>
                    <div class="reopen-batch-family-list">
                      <label v-for="batch in family.batches" :key="batch" class="reopen-checkbox">
                        <input v-model="filters.batchNames" type="checkbox" :value="batch" :data-batch="batch" :disabled="countTransferBusy" />
                        <span>{{ batch }}</span>
                      </label>
                      <p v-if="!optionsLoading && !family.batches.length">暂无批次</p>
                    </div>
                  </section>
                </div>
                <p v-if="!optionsLoading && !batchOptions.length">当前交易类型暂无发生批次</p>
              </div>
            </details>
          </div>
          <label class="reopen-checkbox">
            <input v-model="filters.onlyMine" type="checkbox" data-testid="only-mine-filter" :disabled="countTransferBusy" />
            仅看本人
          </label>
          <button class="reopen-primary" type="submit" data-testid="apply-reopen-filters" :disabled="countTransferBusy">应用筛选</button>
          <button type="button" data-testid="all-reopen-batches" :disabled="countTransferBusy" @click="allBatches">全部批次</button>
        </form>
        <p v-if="optionsError" role="alert" class="reopen-error">{{ optionsError }} <button type="button" @click="loadOptions">重新读取批次</button></p>
        <p data-testid="applied-reopen-scope">当前统计范围 {{ typeLabels[applied.replayType] }} · {{ applied.batchNames.length ? applied.batchNames.join('、') : '全部发生批次' }}{{ applied.onlyMine ? ' · 仅看本人' : '' }}</p>
        <p v-if="loading" role="status">正在读取人员与批次统计…</p>
        <div v-if="countTransfer" ref="transferPanel">
          <ReplayReopenCountTransferForm :person="countTransfer.person" :scope="countTransfer.scope" :can-transfer-counts="permissions.canTransferCounts === true" @busy="countTransferBusy = $event" @close="countTransfer = null" @changed="countTransferred" />
        </div>
        <ReplayReopenStatistics v-if="statistics" :data="statistics" :can-transfer-counts="permissions.canTransferCounts === true && !countTransferBusy" @transfer="openCountTransfer" />
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { getReopenPermissions, getReopenFilters, getReopenStatistics } from '../../api/replayReopens.js'
import ReplayReopenStatistics from './ReplayReopenStatistics.vue'
import ReplayReopenCountTransferForm from './ReplayReopenCountTransferForm.vue'

const props = defineProps({ replayType: { type: String, default: 'ALL' } })
const emit = defineEmits(['close'])
const permissions = ref(null)
const booting = ref(true)
const error = ref('')
const permissionsError = ref('')
const success = ref('')
const optionsError = ref('')
const loading = ref(false)
const optionsLoading = ref(false)
const batchNames = ref([])
const batchPicker = ref(null)
const statistics = ref(null)
const countTransfer = ref(null)
const countTransferBusy = ref(false)
const transferPanel = ref(null)
const filters = reactive({ replayType: props.replayType, batchNames: [], onlyMine: false })
const applied = ref({ ...filters, batchNames: [] })
const typeLabels = { ALL: '全部交易类型', QUERY: '查询', DZ: '动账' }
const batchOptions = computed(() => batchNames.value.filter(batchMatchesType)
  .map((batch, index) => ({ batch, index, chronology: batchChronologyKey(batch) }))
  .sort((left, right) => right.chronology.localeCompare(left.chronology) || left.index - right.index)
  .map(item => item.batch))
const batchFamilies = computed(() => {
  const families = [
    { key: 'RPT', label: 'RPT 查询' },
    { key: 'DZ', label: 'DZ 动账' },
  ].filter(family => filters.replayType === 'ALL' || family.key === (filters.replayType === 'QUERY' ? 'RPT' : 'DZ'))
    .map(family => ({ ...family, batches: batchOptions.value.filter(batch => batch.startsWith(family.key)) }))
  const other = batchOptions.value.filter(batch => !batch.startsWith('RPT') && !batch.startsWith('DZ'))
  if (filters.replayType === 'ALL' && other.length) families.push({ key: 'OTHER', label: '其他批次', batches: other })
  return families
})
let listSerial = 0
let optionsSerial = 0
let permissionsSerial = 0
let alive = true

function batchChronologyKey(batch) {
  const match = batch.match(/^(?:RPT|DZ)(\d{8})(?:-(.*))?$/)
  if (!match) return ''
  const year = Number(match[1].slice(0, 4)), month = Number(match[1].slice(4, 6)), day = Number(match[1].slice(6, 8))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return ''
  const time = match[2]?.match(/^(\d{2})(\d{2})(\d{2})(?:-|$)/)
  if (time && (Number(time[1]) > 23 || Number(time[2]) > 59 || Number(time[3]) > 59)) return ''
  const clock = time ? time[1] + time[2] + time[3] : '000000'
  return match[1] + clock
}

function batchMatchesType(batch) {
  if (filters.replayType === 'QUERY') return batch.startsWith('RPT')
  if (filters.replayType === 'DZ') return batch.startsWith('DZ')
  return true
}

async function loadStatistics() {
  const serial = ++listSerial
  loading.value = true
  error.value = ''
  statistics.value = null
  try {
    const result = await getReopenStatistics({ ...applied.value, batchNames: [...applied.value.batchNames] })
    if (alive && serial === listSerial) statistics.value = result
  } catch (cause) {
    if (alive && serial === listSerial) error.value = cause.message || '统计读取失败，请重试'
  } finally {
    if (alive && serial === listSerial) loading.value = false
  }
}

async function loadOptions() {
  const serial = ++optionsSerial
  const replayType = filters.replayType
  optionsLoading.value = true
  optionsError.value = ''
  batchNames.value = []
  try {
    const result = await getReopenFilters({ replayType })
    if (!alive || serial !== optionsSerial) return
    batchNames.value = [...new Set(result.batchNames || [])]
    filters.batchNames = filters.batchNames.filter(batch => batchOptions.value.includes(batch))
  } catch (cause) {
    if (alive && serial === optionsSerial) optionsError.value = cause.message || '发生批次读取失败，请重试'
  } finally {
    if (alive && serial === optionsSerial) optionsLoading.value = false
  }
}

function changeReplayType() {
  if (countTransferBusy.value) return
  countTransfer.value = null
  success.value = ''
  filters.batchNames = filters.batchNames.filter(batchMatchesType)
  loadOptions()
}

function closeBatchPicker() {
  if (batchPicker.value) batchPicker.value.open = false
}

function applyFilters() {
  if (countTransferBusy.value) return
  countTransfer.value = null
  success.value = ''
  closeBatchPicker()
  applied.value = { ...filters, batchNames: [...filters.batchNames] }
  loadStatistics()
}

function selectAllBatches(event) {
  filters.batchNames = []
  event.target.checked = true
}

function allBatches() {
  if (countTransferBusy.value) return
  filters.batchNames = []
  applyFilters()
}

function requestClose() {
  if (!countTransferBusy.value) emit('close')
}

async function refreshPermissions() {
  const serial = ++permissionsSerial
  permissionsError.value = ''
  try {
    const result = await getReopenPermissions()
    if (alive && serial === permissionsSerial) permissions.value = result
  } catch (cause) {
    if (alive && serial === permissionsSerial) {
      permissionsError.value = cause.message || '权限读取失败，请重试'
      if (permissions.value) permissions.value = { ...permissions.value, canTransferCounts: false }
    }
  }
}

async function openCountTransfer(person) {
  if (!permissions.value?.canTransferCounts || countTransferBusy.value || person.currentCount <= 0) return
  countTransfer.value = {
    person: { ...person },
    scope: { ...applied.value, batchNames: [...applied.value.batchNames] },
  }
  success.value = ''
  await nextTick()
  transferPanel.value?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
}

async function countTransferred(result) {
  countTransferBusy.value = false
  countTransfer.value = null
  success.value = `已转移 ${result.count} 次`
  await Promise.all([refreshPermissions(), loadStatistics()])
}

onMounted(async () => {
  await refreshPermissions()
  if (alive) booting.value = false
  if (alive && permissions.value?.enabled) {
    loadOptions()
    loadStatistics()
  }
})
onBeforeUnmount(() => { alive = false; listSerial++; optionsSerial++; permissionsSerial++ })
</script>
<style src="./replayReopen.css"></style>
