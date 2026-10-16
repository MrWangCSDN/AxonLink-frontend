<template>
  <main class="db-compare-page is-fixed-page">
    <header class="page-toolbar">
      <button class="nav-button" type="button" aria-label="打开导航" @click="$emit('toggleNavigation')">☰</button>
      <div>
        <h2>回放数据库比对字段登记（{{ latestVersion?.versionNo ? `版本：${latestVersion.versionNo}` : '尚未生成版本' }}）</h2>
        <p>共 {{ globalTableCount }} 张表 · 共 {{ globalFieldCount }} 个比对字段</p>
        <p v-if="generationMessage" class="generation-message" data-testid="generation-message">{{ generationMessage }}</p>
      </div>
      <div class="toolbar-actions">
        <button type="button" class="outlined" data-testid="open-version-history" @click="historyOpen = true">版本历史</button>
        <button type="button" class="outlined" data-testid="generate-version" :disabled="generating" @click="openGeneration">生成版本</button>
        <button type="button" class="outlined" data-testid="global-audit-query" @click="openGlobalAudit">审计日志查询</button>
        <button type="button" data-testid="reset-filters" @click="resetFilters">重置筛选条件</button>
        <button type="button" class="outlined" data-testid="open-initial-import" @click="openInitialImport">初始化导入</button>
        <button type="button" class="primary" data-testid="add-registration" @click="openAddEditor">＋ 新增登记</button>
      </div>
    </header>

    <p v-if="pageError" class="api-error" role="alert" data-testid="page-api-error">{{ pageError }}</p>
    <section class="table-shell is-scroll-viewport" data-testid="table-viewport">
      <table class="is-fixed-layout">
        <thead data-testid="database-comparison-table-head" class="is-sticky">
          <tr>
            <template v-for="column in filterColumns" :key="column.key">
              <th
                class="has-white-divider"
                :data-column-key="column.key"
                :data-testid="column.key === 'queryCondition' ? 'query-condition-header' : undefined"
                :class="{ 'primary-column': column.key === 'tableName' }"
                :style="{ width: column.width }"
              >
                <span>{{ column.label }}</span>
                <button
                  v-if="column.key !== 'sampleLimit'"
                  type="button"
                  class="replay-header-filter-button"
                  data-testid="database-comparison-header-filter"
                  :data-filter-key="column.key"
                  :class="{ active: filters[column.key]?.length }"
                  :title="`筛选${column.label}`"
                  aria-label="打开筛选"
                  @click.stop="openFilter(column.key, $event)"
                ><i aria-hidden="true"></i></button>
              </th>
            </template>
            <th
              class="operation-header"
              data-testid="operation-header"
              style="width: 130px"
            >操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in pagedRows"
            :key="row.tableName"
            data-testid="registration-row"
            :data-row-table="row.tableName"
            :class="{ 'is-fields-expanded': isExpanded(row.tableName) }"
          >
            <td
              class="primary-column compact-copy-cell table-name-cell"
              :class="{ 'is-table-missing': isTableMissing(row) || isMissingFields(row) }"
              :data-testid="`table-name-${row.tableName}`"
              :title="tableDisplayValue(row)"
            >
              <span class="compact-cell-content table-name-content"><strong>{{ row.tableName }}</strong><small>{{ row.tableComment }}</small></span>
              <span v-if="isTableMissing(row)" class="metadata-status is-table-missing-status">母库表已删除</span>
              <span v-else-if="isMetadataUnavailable(row)" class="metadata-status is-unavailable-status" :data-testid="`metadata-unavailable-${row.tableName}`">母库校验暂不可用</span>
              <span v-if="isMissingFields(row) && row.metadataValidation?.missingFieldNames?.length" class="metadata-status is-table-missing-status">比对字段母库中不存在</span>
              <span v-if="hasMissingConditionFields(row)" class="metadata-status is-table-missing-status">条件字段母库中不存在</span>
              <span v-if="hasOrderingPrimaryKeyChanged(row)" class="metadata-status is-table-missing-status">排序主键已变更</span>
              <button type="button" :data-testid="`copy-table-name-${row.tableName}`" @click="copyCellValue(tableDisplayValue(row), `table-name-${row.tableName}`)">{{ copiedCellKey === `table-name-${row.tableName}` ? '已复制' : '复制' }}</button>
            </td>
            <td
              class="compact-copy-cell"
              data-cell-role="domain-cell"
              :data-testid="`domain-${row.tableName}`"
              :title="row.domain"
            ><span class="compact-cell-content">{{ row.domain }}</span><button type="button" :data-testid="`copy-domain-${row.tableName}`" @click="copyCellValue(row.domain, `domain-${row.tableName}`)">{{ copiedCellKey === `domain-${row.tableName}` ? '已复制' : '复制' }}</button></td>
            <td
              class="fields"
              :class="{ 'is-expanded': isExpanded(row.tableName) }"
              :data-testid="`fields-${row.tableName}`"
              :title="allFields(row)"
            >
              <div v-if="isExpanded(row.tableName)" class="field-list">
                <span
                  v-for="(field, fieldIndex) in row.fields"
                  :key="field.name"
                  class="field-item"
                  :class="{ 'is-missing-in-base-preview': isListFieldMissing(row, field) }"
                  :data-testid="`list-field-${row.tableName}-${field.name}`"
                >
                  {{ formatField(field) }}<span v-if="fieldIndex < row.fields.length - 1" class="field-separator">、</span>
                </span>
              </div>
              <div v-else class="field-content">
                <span
                  v-for="(field, fieldIndex) in row.fields.slice(0, 3)"
                  :key="field.name"
                  class="field-item"
                  :class="{ 'is-missing-in-base-preview': isListFieldMissing(row, field) }"
                  :data-testid="`list-field-${row.tableName}-${field.name}`"
                >{{ formatField(field) }}<span v-if="fieldIndex < Math.min(row.fields.length, 3) - 1" class="field-separator">、</span></span><span v-if="row.fields.length > 3">…（{{ row.fields.length }}）</span>
              </div>
              <div class="field-actions">
                <button
                  class="field-action"
                  type="button"
                  :data-testid="`expand-fields-${row.tableName}`"
                  @click="toggleFields(row.tableName)"
                >{{ isExpanded(row.tableName) ? '收起' : '展开' }}</button>
                <button
                  v-if="isExpanded(row.tableName)"
                  class="field-action"
                  type="button"
                  :data-testid="`copy-fields-${row.tableName}`"
                  @click="copyFields(row)"
                >{{ copiedTable === row.tableName ? '已复制' : '复制全部字段' }}</button>
              </div>
            </td>
            <td
              class="query-condition-cell"
              :class="{ 'is-expanded': isQueryConditionExpanded(row.tableName) }"
              :data-testid="`query-condition-${row.tableName}`"
              :title="queryConditionExpression(row)"
            >
              <div class="query-condition-content">{{ queryConditionExpression(row) }}</div>
              <div v-if="hasQueryScope(row)" class="field-actions">
                <button
                  class="field-action"
                  type="button"
                  :data-testid="`expand-query-condition-${row.tableName}`"
                  @click="toggleQueryCondition(row.tableName)"
                >{{ isQueryConditionExpanded(row.tableName) ? '收起' : '展开' }}</button>
                <button
                  v-if="isQueryConditionExpanded(row.tableName)"
                  class="field-action"
                  type="button"
                  :data-testid="`copy-query-condition-${row.tableName}`"
                  @click="copyQueryCondition(row)"
                >{{ copiedConditionTable === row.tableName ? '已复制' : '复制全部条件' }}</button>
              </div>
            </td>
            <td :data-testid="`sample-limit-${row.tableName}`">{{ row.sampleLimit ?? 100 }}</td>
            <td
              class="compact-copy-cell"
              :data-testid="`reviser-${row.tableName}`"
              :title="row.reviser"
            ><span class="compact-cell-content">{{ row.reviser }}</span><button type="button" :data-testid="`copy-reviser-${row.tableName}`" @click="copyCellValue(row.reviser, `reviser-${row.tableName}`)">{{ copiedCellKey === `reviser-${row.tableName}` ? '已复制' : '复制' }}</button></td>
            <td
              class="compact-copy-cell"
              :data-testid="`group-owner-${row.tableName}`"
              :title="row.groupOwner"
            ><span class="compact-cell-content">{{ row.groupOwner }}</span><button type="button" :data-testid="`copy-group-owner-${row.tableName}`" @click="copyCellValue(row.groupOwner, `group-owner-${row.tableName}`)">{{ copiedCellKey === `group-owner-${row.tableName}` ? '已复制' : '复制' }}</button></td>
            <td
              class="compact-copy-cell"
              :data-testid="`date-${row.tableName}`"
              :title="row.date"
            ><span class="compact-cell-content">{{ row.date }}</span><button type="button" :data-testid="`copy-date-${row.tableName}`" @click="copyCellValue(row.date, `date-${row.tableName}`)">{{ copiedCellKey === `date-${row.tableName}` ? '已复制' : '复制' }}</button></td>
            <td class="operation-cell">
              <button class="operation-button" type="button" :data-testid="`view-registration-${row.tableName}`" @click="openRegistrationDetail(row)">查看</button>
              <button class="operation-button" type="button" :data-testid="`edit-registration-${row.tableName}`" @click="openEditEditor(row)">编辑</button>
              <button class="operation-button danger" type="button" :data-testid="`delete-registration-${row.tableName}`" @click="requestDeleteRegistration(row)">删除</button>
              <button class="operation-button" type="button" :data-testid="`audit-registration-${row.tableName}`" @click="openRegistrationAudit(row)">审计日志</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="activeFilterKey" class="replay-header-filter-panel" :style="filterPanelStyle" data-testid="header-filter-panel">
      <header><strong>筛选 {{ activeFilterLabel }}</strong></header>
      <div class="replay-header-filter-content">
        <div class="replay-header-filter-search"><input v-model.trim="filterSearchInput" data-testid="header-filter-search" type="search" placeholder="模糊搜索" /><button type="button" aria-label="查询筛选选项" title="查询" @click="runFilterSearch"><Search :size="14" /></button></div>
        <div class="replay-header-filter-actions"><button type="button" @click="selectAllOptions">全选</button><button type="button" @click="invertOptions">反选</button><span>筛选数({{ visibleFilterOptions.length }})</span><span>计数({{ draftMatchedCount }})</span></div>
        <div class="replay-header-filter-options">
          <p v-if="filterError" class="api-error" role="alert">{{ filterError }}</p>
          <label v-for="option in visibleFilterOptions" :key="option.value" data-testid="header-filter-option">
            <input v-model="filterDraft" type="checkbox" :value="option.value" />
            <span>{{ option.label || option.value }}</span><em>({{ option.count }})</em>
          </label>
          <p v-if="!filterError && !visibleFilterOptions.length">暂无选项</p>
        </div>
      </div>
      <footer><button class="replay-header-filter-clear is-bordered" type="button" @click="clearActiveFilter">清空筛选</button><span></span><button type="button" aria-label="关闭筛选" @click="closeFilter">取消</button><button type="button" data-testid="apply-header-filter" class="primary" :disabled="!!filterError" @click="applyFilter">确定</button></footer>
      <button class="replay-header-filter-resize-handle" type="button" aria-label="拖拽调整筛选窗口大小" data-testid="header-filter-resize-handle" @pointerdown="startFilterResize"></button>
    </section>

    <footer class="pager is-fixed-pager" data-testid="fixed-pager">
      <span data-testid="page-summary">共 {{ totalRows }} 条，第 {{ page }} / {{ pageCount }} 页</span>
      <label>每页 <select v-model.number="pageSize" data-testid="page-size" @change="changePageSize"><option :value="50">50</option><option :value="100">100</option><option :value="200">200</option></select> 条</label>
      <div class="page-actions">
        <button type="button" data-testid="previous-page" title="上一页" :disabled="page === 1" @click="goToPage(page - 1)">‹</button>
        <button type="button" data-testid="next-page" title="下一页" :disabled="page === pageCount" @click="goToPage(page + 1)">›</button>
      </div>
    </footer>
    <div v-if="initialImportOpen" class="page-dialog-backdrop" data-testid="initial-import-backdrop">
      <section class="page-dialog initial-import-dialog" data-testid="initial-import-dialog" role="dialog" aria-modal="true">
        <header><h3>初始化导入</h3><button type="button" aria-label="关闭初始化导入" :disabled="initialImporting" @click="closeInitialImport">×</button></header>
        <div class="initial-import-body">
          <p>Excel 必须包含存款、贷款、公共、结算四个 Sheet，Sheet 可以没有数据，但不能缺少。</p>
          <ul>
            <li>C 列：表英文名（必填）</li>
            <li>E 列：字段英文名（必填）</li>
            <li>G 列：原负责人列可留空；领域和负责人以数据库表人员清单为准</li>
          </ul>
          <div class="initial-import-file-field">
            <span>选择 Excel</span>
            <button type="button" class="initial-import-file-trigger" data-testid="initial-import-file-trigger" :disabled="initialImporting" @click="triggerInitialImportFile">
              <span>选择 Excel 文件</span>
              <small data-testid="initial-import-file-name">{{ initialImportFile?.name || '未选择任何文件' }}</small>
            </button>
            <input ref="initialImportFileInput" class="initial-import-file-input" data-testid="initial-import-file" type="file" accept=".xlsx,.xls" :disabled="initialImporting" @change="selectInitialImportFile" />
          </div>
          <label>导入口令<input v-model="initialImportToken" data-testid="initial-import-token" type="password" :disabled="initialImporting" autocomplete="off" /></label>
          <p v-if="initialImportMessage" class="initial-import-message is-error">{{ initialImportMessage }}</p>
          <div v-if="initialImportErrors.length" class="initial-import-errors">
            <div class="initial-import-errors-header">
              <strong>错误清单（{{ initialImportErrors.length }}）</strong>
              <button type="button" data-testid="export-initial-import-errors" :disabled="initialImportExporting" @click="exportInitialImportErrorList">
                {{ initialImportExporting ? '导出中...' : '导出 Excel' }}
              </button>
            </div>
            <table>
              <thead><tr><th v-for="header in ['Sheet', '行号', '表英文名', '字段英文名', '负责人', '原因']" :key="header" data-testid="initial-import-error-header">{{ header }}</th></tr></thead>
              <tbody><tr v-for="(error, index) in initialImportErrors" :key="`${error.sheetName}-${error.rowNumber}-${index}`" data-testid="initial-import-error-row"><td>{{ error.sheetName || '-' }}</td><td>{{ error.rowNumber ?? '-' }}</td><td>{{ error.tableName || '-' }}</td><td>{{ error.fieldName || '-' }}</td><td>{{ error.reviserInput || '-' }}</td><td>{{ error.reason }}</td></tr></tbody>
            </table>
          </div>
        </div>
        <footer><button type="button" data-testid="cancel-initial-import" :disabled="initialImporting" @click="closeInitialImport">取消</button><button type="button" class="primary" data-testid="submit-initial-import" :disabled="!initialImportFile || !initialImportToken || initialImporting" @click="submitInitialImport">{{ initialImporting ? '导入中...' : '开始导入' }}</button></footer>
      </section>
    </div>
    <div v-if="generationOpen" class="page-dialog-backdrop" data-testid="generation-backdrop">
      <section class="page-dialog generation-dialog" data-testid="generation-dialog" role="dialog" aria-modal="true">
        <header><div><h3>生成版本</h3><p>校验全部有效登记并保存不可变快照</p></div><button type="button" aria-label="关闭生成版本" :disabled="generating" @click="closeGeneration">×</button></header>
        <div class="generation-body">
          <label>生成口令<input v-model="generationToken" data-testid="generation-token" type="password" :disabled="generating" autocomplete="off" placeholder="请输入生成口令" /></label>
          <p v-if="generationError" class="generation-error" data-testid="generation-error">{{ generationError }}</p>
          <div v-if="generationGateErrors.length" class="generation-gate-errors" data-testid="generation-gate-errors">
            <strong>门禁错误清单（{{ generationGateErrors.length }}）</strong>
            <div class="generation-gate-table-wrap">
              <table>
                <thead><tr><th>表英文名 / 中文名</th><th>开发负责人</th><th>科技负责人</th><th>状态</th><th>缺失字段</th><th>原因</th></tr></thead>
                <tbody><tr v-for="(error, index) in generationGateErrors" :key="`${error.tableName}-${index}`" data-testid="generation-gate-error-row"><td><strong>{{ error.tableName }}</strong><small>{{ error.tableComment || '-' }}</small></td><td>{{ error.reviserName || '-' }}</td><td>{{ error.groupOwnerName || '-' }}</td><td><span class="gate-status">{{ gateStatusLabel[error.status] || error.status }}</span></td><td>{{ error.missingFieldNames?.join('、') || '-' }}</td><td>{{ error.reason }}</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
        <footer><button type="button" :disabled="generating" @click="closeGeneration">取消</button><button type="button" class="primary" data-testid="confirm-generate-version" :disabled="!generationToken || generating" @click="submitGeneration">{{ generating ? '生成中...' : '确认生成' }}</button></footer>
      </section>
    </div>
    <ReplayDatabaseComparisonEditor
      v-if="editorOpen"
      :registrations="rows"
      :initial-registration="editingRegistration"
      :search-tables="searchTableOptions"
      :load-columns="loadTableColumns"
      :load-keys="loadTableKeys"
      :load-registration="loadRegistrationDetail"
      :save-error="editorSaveError"
      :can-configure-sample-limit="canConfigureSampleLimit"
      @close="closeEditor"
      @save="saveRegistration"
      @delete="deleteRegistration"
    />
    <div v-if="detailRegistration" class="page-dialog-backdrop">
      <section class="page-dialog" data-testid="registration-detail-dialog">
        <header><h3>登记详情</h3><button type="button" data-testid="close-registration-detail" aria-label="关闭登记详情" @click="detailRegistration = null">×</button></header>
        <p v-if="isTableMissing(detailRegistration)" class="detail-table-warning" data-testid="detail-table-missing-warning">母库中已找不到该表，当前展示的是历史登记快照。请确认后删除整表登记。</p>
        <p v-else-if="isMetadataUnavailable(detailRegistration)" class="detail-metadata-unavailable">母库校验暂不可用，当前展示历史登记内容。</p>
        <dl>
          <dt>表英文名</dt><dd>{{ detailRegistration.tableName }}</dd>
          <dt>表中文名</dt><dd>{{ detailRegistration.tableComment || '-' }}</dd>
          <dt>领域</dt><dd>{{ detailRegistration.domain }}</dd>
          <dt>选择索引</dt><dd data-testid="detail-comparison-key">{{ formatComparisonKey(detailRegistration.comparisonKey) }}</dd>
          <dt>比对字段</dt><dd class="detail-fields">
            <p v-if="isMissingFields(detailRegistration) && missingFieldsFor(detailRegistration).length" class="detail-missing-warning" data-testid="detail-missing-fields-warning">{{ missingFieldsFor(detailRegistration).length }} 个字段已从母库删除，请尽快编辑并移除</p>
            <span
              v-for="field in detailRegistration.fields"
              :key="field.name"
              :data-testid="`detail-field-${field.name}`"
              :class="{ 'is-missing-in-base': isMissingFields(detailRegistration) && isFieldMissingInBase(detailRegistration, field) }"
            >{{ formatField(field) }}<b v-if="selectedIndexFieldLabel(detailRegistration, field)" :class="detailRegistration.comparisonKey?.indexType === 'UNIQUE_INDEX' ? 'comparison-key-badge' : 'primary-key-badge'">{{ selectedIndexFieldLabel(detailRegistration, field) }}</b><b v-if="isMissingFields(detailRegistration) && isFieldMissingInBase(detailRegistration, field)">母库已删除</b></span>
          </dd>
          <dt>比对范围</dt><dd class="detail-scope">
            <span v-if="detailRegistration.whereCondition">已配置条件</span>
            <span v-else>全表</span>
            <span v-if="detailRegistration.compareLimit">限{{ detailRegistration.compareLimit }}条</span>
            <pre v-if="detailRegistration.whereSql">{{ detailRegistration.whereSql }}</pre>
          </dd>
          <dt>样本数</dt><dd data-testid="detail-sample-limit">{{ detailRegistration.sampleLimit ?? 100 }}</dd>
          <dt>开发负责人</dt><dd>{{ detailRegistration.reviser }}</dd>
          <dt>科技负责人</dt><dd>{{ detailRegistration.groupOwner }}</dd>
          <dt>登记日期</dt><dd>{{ detailRegistration.date }}</dd>
        </dl>
        <footer v-if="isTableMissing(detailRegistration)"><button type="button" class="danger-confirm" data-testid="delete-missing-table-registration" @click="requestDetailTableDeletion">删除整表登记</button></footer>
      </section>
    </div>
    <ReplayDatabaseComparisonAuditDialog
      v-if="auditDialogOpen"
      :table-name="auditTableName"
      :events="auditEvents"
      :groups="auditGroups"
      :page="auditPage"
      :size="auditPageSize"
      :total="auditTotal"
      :total-pages="auditTotalPages"
      :loading="auditLoading"
      :error="auditError"
      @search="searchAuditGroups"
      @page-change="changeAuditPage"
      @page-size-change="changeAuditPageSize"
      @load-details="loadAuditEventDetails"
      @close="closeAuditDialog"
    />
    <ReplayDatabaseComparisonVersionHistory
      :open="historyOpen"
      @close="historyOpen = false"
    />
    <div v-if="deleteTarget" class="page-dialog-backdrop">
      <section class="page-dialog compact-dialog" data-testid="list-delete-confirmation">
        <header><h3>删除登记</h3><button type="button" aria-label="关闭删除确认" @click="deleteTarget = null">×</button></header>
        <p>确认删除表 <strong>{{ deleteTarget.tableName }}</strong> 的全部比对字段登记吗？</p>
        <p v-if="pageError" class="api-error" role="alert">{{ pageError }}</p>
        <footer><button type="button" @click="deleteTarget = null">取消</button><button type="button" class="danger-confirm" data-testid="confirm-list-delete" @click="confirmListDelete">确认删除</button></footer>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import ReplayDatabaseComparisonEditor from './ReplayDatabaseComparisonEditor.vue'
import ReplayDatabaseComparisonAuditDialog from './ReplayDatabaseComparisonAuditDialog.vue'
import ReplayDatabaseComparisonVersionHistory from './ReplayDatabaseComparisonVersionHistory.vue'
import { exportInitialImportErrors } from './initialImportErrorWorkbook.js'
import { buildScopePreview } from './replayDatabaseComparisonScope.js'
import {
  createRegistration,
  deleteRegistration as deleteRegistrationApi,
  generateVersion,
  importInitialExcel,
  loadAuditDetails,
  loadBaseColumns,
  loadBaseKeys,
  loadHeaderFilterOptions,
  loadLatestVersion,
  loadOptions,
  loadRegistration,
  loadRegistrationAudits,
  reregisterRegistration,
  searchGroupedAudits as searchGroupedAuditsApi,
  searchBaseTables,
  searchRegistrations,
  synchronizePrimaryKeys,
  updateRegistration,
} from '../../api/replayDatabaseComparison.js'

defineEmits(['toggleNavigation'])

const rows = reactive([])
const pageError = ref('')
const filterError = ref('')
const serverTotal = ref(0)
const serverGlobalTableCount = ref(0)
const serverGlobalFieldCount = ref(0)
const auditEvents = reactive([])

const filterColumns = [
  { key: 'tableName', label: '表英文名 / 中文名', width: '127px' },
  { key: 'domain', label: '领域', width: '62px' },
  { key: 'fields', label: '比对字段', width: '250px' },
  { key: 'queryCondition', label: '查询条件', width: '90px' },
  { key: 'sampleLimit', label: '样本数', width: '75px' },
  { key: 'reviser', label: '开发负责人', width: '90px' },
  { key: 'groupOwner', label: '科技负责人', width: '90px' },
  { key: 'date', label: '登记日期', width: '51px' },
]
const filters = reactive({})
const activeFilterKey = ref('')
const filterSearchInput = ref('')
const filterSearch = ref('')
const filterDraft = ref([])
const page = ref(1)
const pageSize = ref(50)
const filterPanelSize = reactive({ width: 340, height: 300 })
const filterPanelStyle = reactive({ left: '8px', top: '8px', width: '340px', height: '300px' })
let filterResizeState = null

const expandedTables = ref(new Set())
const expandedConditionTables = ref(new Set())
const copiedTable = ref('')
const copiedConditionTable = ref('')
const editorOpen = ref(false)
const editingRegistration = ref(null)
const editorSaveError = ref(null)
const canConfigureSampleLimit = ref(false)
const detailRegistration = ref(null)
const auditDialogOpen = ref(false)
const auditTableName = ref('')
const auditQuery = ref({ tableKeyword: '', operatorKeyword: '', operations: [], operatedFrom: '', operatedTo: '' })
const auditGroups = ref([])
const auditPage = ref(0)
const auditPageSize = ref(20)
const auditTotal = ref(0)
const auditTotalPages = ref(0)
const auditLoading = ref(false)
const auditError = ref('')
let auditRequestSequence = 0
const deleteTarget = ref(null)
const copiedCellKey = ref('')
const initialImportOpen = ref(false)
const initialImportFileInput = ref(null)
const initialImportFile = ref(null)
const initialImportToken = ref('')
const initialImporting = ref(false)
const initialImportExporting = ref(false)
const initialImportErrors = ref([])
const initialImportMessage = ref('')
const latestVersion = ref(null)
const historyOpen = ref(false)
const generationOpen = ref(false)
const generationToken = ref('')
const generating = ref(false)
const generationError = ref('')
const generationMessage = ref('')
const generationGateErrors = ref([])
const gateStatusLabel = {
  MISSING_FIELDS: '比对字段母库中不存在',
  ORDERING_PRIMARY_KEY_CHANGED: '排序主键已变更',
  TABLE_MISSING: '母库表已删除',
  UNAVAILABLE: '母库校验暂不可用',
}
const MISSING_FIELDS_LABEL = '比对字段母库中不存在'
const MISSING_CONDITION_FIELDS_LABEL = '条件字段母库中不存在'
const TABLE_MISSING_LABEL = '母库表已删除'
const ORDERING_PRIMARY_KEY_CHANGED_LABEL = '排序主键已变更'
const EMPTY_FILTER_VALUE = '__EMPTY__'
const FULL_TABLE_FILTER_VALUE = '__FULL_TABLE__'
const METADATA_STATUS_BY_LABEL = {
  [MISSING_FIELDS_LABEL]: 'MISSING_FIELDS',
  [MISSING_CONDITION_FIELDS_LABEL]: 'MISSING_CONDITION_FIELDS',
  [TABLE_MISSING_LABEL]: 'TABLE_MISSING',
  [ORDERING_PRIMARY_KEY_CHANGED_LABEL]: 'ORDERING_PRIMARY_KEY_CHANGED',
}

const formatField = field => field.comment?.trim()
  ? `${field.name}(${field.comment.trim()})`
  : field.name

const tableDisplayValue = row => row.tableComment?.trim()
  ? `${row.tableName} / ${row.tableComment.trim()}`
  : row.tableName

const allFields = row => row.fields.map(formatField).join('、')
const formatComparisonKey = key => key
  ? `${key.indexType === 'PRIMARY_KEY' ? '主键' : '唯一索引'} · ${key.indexName} · ${key.columnNames.join('、')}`
  : '未记录索引选择（按母库默认）'
const selectedIndexFieldLabel = (row, field) => {
  if (!row.comparisonKey) return field.primaryKey ? '主键' : ''
  if (!row.comparisonKey.columnNames.some(name => name.toLocaleLowerCase() === (field.name || field.columnName)?.toLocaleLowerCase())) return ''
  return row.comparisonKey.indexType === 'UNIQUE_INDEX' ? '唯一索引' : '主键'
}
const primaryKeyColumnsFor = row => {
  if (row.comparisonKey) return row.comparisonKey.columnNames
  if (row.primaryKeyNames?.length) return row.primaryKeyNames
  return row.fields.filter(field => field.primaryKey).map(field => field.name)
}
const queryConditionCopyValue = row => {
  const preview = buildScopePreview(
    row.whereCondition,
    [],
    row.compareLimit,
    primaryKeyColumnsFor(row),
  )
  return preview === '全表比对' ? '全表' : preview
}
const queryConditionExpression = row => queryConditionCopyValue(row)
const hasQueryCondition = row => Boolean(row?.whereCondition?.groups?.length)
const hasQueryScope = row => hasQueryCondition(row) || Boolean(row?.compareLimit)
const metadataStatus = row => row?.metadataValidation?.status || 'VALID'
const isTableMissing = row => metadataStatus(row) === 'TABLE_MISSING'
const isMetadataUnavailable = row => metadataStatus(row) === 'UNAVAILABLE'
const isMissingFields = row => metadataStatus(row) === 'MISSING_FIELDS'
const hasMissingConditionFields = row => Boolean(
  row?.metadataValidation?.missingConditionFieldNames?.length,
)
const hasOrderingPrimaryKeyChanged = row => Boolean(
  row?.metadataValidation?.orderingPrimaryKeyChanged,
)
const missingFieldNamesFor = row => new Set(
  (row?.metadataValidation?.missingFieldNames || []).map(name => String(name).trim().toLocaleLowerCase()),
)
const isListFieldMissing = (row, field) => isMissingFields(row)
  && missingFieldNamesFor(row).has(String(field?.name || '').trim().toLocaleLowerCase())
const isFieldMissingInBase = (row, field) => field.missingInBase === true
  || field.existsInBase === false
  || missingFieldNamesFor(row).has(String(field?.name || '').trim().toLocaleLowerCase())
const missingFieldsFor = row => row.fields.filter(field => isFieldMissingInBase(row, field))

const globalTableCount = computed(() => serverGlobalTableCount.value)
const globalFieldCount = computed(() => serverGlobalFieldCount.value)
const totalRows = computed(() => serverTotal.value)
const pageCount = computed(() => Math.max(1, Math.ceil(totalRows.value / pageSize.value)))
const pagedRows = computed(() => rows)
const activeFilterLabel = computed(() => filterColumns.find(column => column.key === activeFilterKey.value)?.label || '')
const serverFilterOptions = ref([])
const serverFilterMatchedCount = ref(0)
const filterOptions = computed(() => activeFilterKey.value ? serverFilterOptions.value : [])
const visibleFilterOptions = computed(() => {
  const keyword = filterSearch.value.toLocaleLowerCase()
  if (!keyword) return filterOptions.value
  return filterOptions.value.filter(option => `${option.value} ${option.label || ''}`.toLocaleLowerCase().includes(keyword))
})
const draftMatchedCount = computed(() => serverFilterMatchedCount.value)

const isExpanded = tableName => expandedTables.value.has(tableName)
const isQueryConditionExpanded = tableName => expandedConditionTables.value.has(tableName)

const toggleFields = tableName => {
  const next = new Set(expandedTables.value)
  if (next.has(tableName)) next.delete(tableName)
  else next.add(tableName)
  expandedTables.value = next
  copiedTable.value = ''
}

const toggleQueryCondition = tableName => {
  const next = new Set(expandedConditionTables.value)
  if (next.has(tableName)) next.delete(tableName)
  else next.add(tableName)
  expandedConditionTables.value = next
  copiedConditionTable.value = ''
}

const copyText = async value => {
  const text = String(value ?? '')
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

const copyFields = async row => {
  if (await copyText(allFields(row))) copiedTable.value = row.tableName
}

const copyQueryCondition = async row => {
  if (await copyText(queryConditionCopyValue(row))) copiedConditionTable.value = row.tableName
}

const copyCellValue = async (value, key) => {
  if (await copyText(value)) copiedCellKey.value = key
}

const mapField = field => ({
  name: field.columnName || field.name,
  comment: field.columnComment || field.comment || '',
  primaryKey: Boolean(field.primaryKey),
  existsInBase: field.existsInBase,
  missingInBase: field.existsInBase === false || Boolean(field.missingInBase),
})
const formatPerson = (name, username, employeeNumber) => {
  const displayName = String(name || '').trim()
  const account = String(username || employeeNumber || '').trim()
  if (displayName.includes('(') && displayName.endsWith(')')) return displayName
  if (displayName && account) return `${displayName}(${account})`
  return displayName || account
}
const mapRegistration = registration => ({
  id: registration.id,
  version: registration.version,
  sampleLimit: registration.sampleLimit ?? 100,
  tableName: registration.tableName,
  tableComment: registration.tableComment || '',
  domain: registration.domainName || registration.domain || '',
  fields: (registration.fields || []).map(mapField),
  reviser: formatPerson(registration.reviserName, registration.reviserUsername, registration.reviserEmpNo)
    || registration.reviser || '',
  reviserEmpNo: registration.reviserEmpNo,
  groupOwnerUsername: registration.groupOwnerEmpNo || registration.groupOwnerUsername || '',
  groupOwnerName: registration.groupOwnerName || '',
  groupOwner: registration.groupOwnerName
    ? `${registration.groupOwnerName}(${registration.groupOwnerEmpNo || ''})`
    : registration.groupOwner || '',
  date: registration.registeredDate || registration.date || '',
  metadataValidation: registration.metadataValidation || null,
  whereCondition: registration.whereCondition || null,
  whereConditionConfigured: registration.whereConditionConfigured ?? Boolean(registration.whereCondition),
  whereSql: registration.whereSql || null,
  compareLimit: registration.compareLimit ?? null,
  primaryKeyNames: registration.primaryKeyNames || [],
  comparisonKey: registration.comparisonKey || null,
})
const loadRegistrationDetail = async id => mapRegistration(await loadRegistration(id))
const hydrateRegistration = row => loadRegistrationDetail(row.id)
const openRegistrationDetail = async row => {
  pageError.value = ''
  try { detailRegistration.value = await hydrateRegistration(row) }
  catch (error) { pageError.value = error?.message || '登记详情加载失败，请重试' }
}
const requestDetailTableDeletion = () => {
  deleteTarget.value = detailRegistration.value
  detailRegistration.value = null
}
const openRegistrationAudit = async row => {
  auditTableName.value = row.tableName
  auditQuery.value = { tableKeyword: row.tableName, operatorKeyword: '', operations: [], operatedFrom: '', operatedTo: '' }
  auditDialogOpen.value = true
  auditGroups.value = []
  auditError.value = ''
  auditEvents.splice(0, auditEvents.length)
  try {
    const result = await loadRegistrationAudits(row.id, 0, 50)
    auditEvents.splice(0, auditEvents.length, ...(result.items || []))
  } catch (error) { auditError.value = error?.message || '审计日志加载失败，请重试' }
}
const openGlobalAudit = async () => {
  auditTableName.value = ''
  auditQuery.value = { tableKeyword: '', operatorKeyword: '', operations: [], operatedFrom: '', operatedTo: '' }
  auditPage.value = 0
  auditPageSize.value = 20
  auditDialogOpen.value = true
  await loadGroupedAudits()
}
const loadGroupedAudits = async () => {
  const sequence = ++auditRequestSequence
  auditLoading.value = true
  auditError.value = ''
  auditGroups.value = []
  try {
    const result = await searchGroupedAuditsApi({ ...auditQuery.value, page: auditPage.value, size: auditPageSize.value })
    if (sequence !== auditRequestSequence) return
    auditGroups.value = result.content || []
    auditPage.value = result.page ?? auditPage.value
    auditPageSize.value = result.size ?? auditPageSize.value
    auditTotal.value = result.totalElements || 0
    auditTotalPages.value = result.totalPages || 0
  } catch (error) {
    if (sequence !== auditRequestSequence) return
    auditGroups.value = []
    auditTotal.value = 0
    auditTotalPages.value = 0
    auditError.value = error?.message || '审计日志加载失败，请重试'
  } finally {
    if (sequence === auditRequestSequence) auditLoading.value = false
  }
}
const searchAuditGroups = async query => {
  auditQuery.value = query
  auditPage.value = 0
  await loadGroupedAudits()
}
const changeAuditPage = async nextPage => { auditPage.value = nextPage; await loadGroupedAudits() }
const changeAuditPageSize = async nextSize => { auditPageSize.value = nextSize; auditPage.value = 0; await loadGroupedAudits() }
const loadAuditEventDetails = async event => {
  try { event.details = await loadAuditDetails(event.id) }
  catch (error) { auditError.value = error?.message || '审计详情加载失败，请重试' }
}
const closeAuditDialog = () => {
  auditDialogOpen.value = false
  auditTableName.value = ''
  auditGroups.value = []
}
const requestDeleteRegistration = row => {
  pageError.value = ''
  deleteTarget.value = row
}

const confirmListDelete = async () => {
  if (!deleteTarget.value) return
  const deletedRow = deleteTarget.value
  pageError.value = ''
  try { await deleteRegistrationApi(deletedRow.id, { version: deletedRow.version, reason: '删除登记' }) }
  catch (error) { pageError.value = error?.message || '删除失败，请重试'; return }
  deleteTarget.value = null
  await loadPage()
}

const openAddEditor = () => {
  editorSaveError.value = null
  editingRegistration.value = null
  editorOpen.value = true
}

const openEditEditor = async row => {
  editorSaveError.value = null
  pageError.value = ''
  try {
    editingRegistration.value = await hydrateRegistration(row)
    editorOpen.value = true
  } catch (error) { pageError.value = error?.message || '登记详情加载失败，请重试' }
}

const closeEditor = () => {
  editorOpen.value = false
  editingRegistration.value = null
  editorSaveError.value = null
}

const saveRegistration = async payload => {
  editorSaveError.value = null
  const body = {
    tableName: payload.tableName,
    fieldNames: payload.fieldNames,
    comparisonKeyName: payload.comparisonKeyName,
    domainName: payload.domain,
    groupOwnerEmpNo: payload.groupOwnerEmpNo || payload.groupOwnerUsername,
    version: payload.version,
    deleteWhenNoFields: false,
    whereCondition: payload.whereCondition,
    compareLimit: payload.compareLimit,
    ...(canConfigureSampleLimit.value && payload.sampleLimit !== undefined ? { sampleLimit: payload.sampleLimit } : {}),
  }
  try {
    if (payload.mode === 'edit') await updateRegistration(payload.id, body)
    else if (payload.mode === 'reregister') {
      await reregisterRegistration(payload.id, { ...body, reason: '重新登记' })
    } else await createRegistration(body)
  } catch (error) {
    if (error.code === 'BASE_PRIMARY_KEYS_REQUIRED') {
      editorSaveError.value = {
        type: 'PRIMARY_KEY_CHANGED',
        missingPrimaryKeyNames: error.data?.missingPrimaryKeyNames || [],
      }
      return
    }
    if (error.code === 'BASE_PRIMARY_KEY_MISSING') {
      editorSaveError.value = {
        type: 'PRIMARY_KEY_MISSING',
        tableName: error.data?.tableName || payload.tableName,
      }
      return
    }
    if (error.code === 'COMPARISON_KEY_CHANGED') {
      editorSaveError.value = { type: 'COMPARISON_KEY_CHANGED', message: error.message }
      return
    }
    if (error.code === 'COMPARISON_SCOPE_INVALID') {
      editorSaveError.value = {
        type: 'SCOPE_INVALID',
        message: error.message || '比对范围配置存在问题',
        errors: error.data?.errors || [],
      }
      return
    }
    editorSaveError.value = {
      type: 'SAVE_FAILED',
      message: error.message || '保存失败，请稍后重试',
    }
    return
  }
  closeEditor()
  await loadPage()
  return
}

const deleteRegistration = async payload => {
  editorSaveError.value = null
  try {
    await deleteRegistrationApi(payload.id, { version: payload.version, reason: payload.reason })
  } catch (error) {
    editorSaveError.value = { type: 'SAVE_FAILED', message: error.message || '删除失败，请稍后重试' }
    return
  }
  closeEditor()
  await loadPage()
}

const positionFilterPanel = anchor => {
  const margin = 8
  const gap = 6
  const rect = anchor?.getBoundingClientRect?.() || { left: margin, top: margin, bottom: margin }
  const viewportWidth = window.innerWidth || 1280
  const viewportHeight = window.innerHeight || 800
  const maxWidth = Math.max(300, viewportWidth - margin * 2)
  const maxHeight = Math.max(220, viewportHeight - margin * 2)
  filterPanelSize.width = Math.min(filterPanelSize.width, maxWidth)
  filterPanelSize.height = Math.min(filterPanelSize.height, maxHeight)
  const left = Math.max(margin, Math.min(rect.left, viewportWidth - filterPanelSize.width - margin))
  const belowTop = rect.bottom + gap
  const top = belowTop + filterPanelSize.height <= viewportHeight - margin
    ? belowTop
    : Math.max(margin, rect.top - filterPanelSize.height - gap)
  filterPanelStyle.left = `${Math.round(left)}px`
  filterPanelStyle.top = `${Math.round(top)}px`
  filterPanelStyle.width = `${Math.round(filterPanelSize.width)}px`
  filterPanelStyle.height = `${Math.round(filterPanelSize.height)}px`
}

const openFilter = async (key, event) => {
  const anchor = event?.currentTarget
    || event?.target?.closest?.('.replay-header-filter-button')
  filterSearchInput.value = ''
  filterSearch.value = ''
  filterDraft.value = [...(filters[key] || [])]
  positionFilterPanel(anchor)
  activeFilterKey.value = key
  await nextTick()
  await fetchFilterOptions(key, '')
}

const closeFilter = () => {
  activeFilterKey.value = ''
  filterSearchInput.value = ''
  filterSearch.value = ''
  filterDraft.value = []
}

const runFilterSearch = async () => {
  filterSearch.value = filterSearchInput.value
  await fetchFilterOptions(activeFilterKey.value, filterSearch.value)
}

const selectAllOptions = () => { filterDraft.value = visibleFilterOptions.value.map(option => option.value) }
const invertOptions = () => {
  const selected = new Set(filterDraft.value)
  filterDraft.value = visibleFilterOptions.value.map(option => option.value).filter(value => !selected.has(value))
}
const applyFilter = async () => {
  filters[activeFilterKey.value] = [...filterDraft.value]
  page.value = 1
  closeFilter()
  await loadPage()
}
const clearActiveFilter = async () => {
  delete filters[activeFilterKey.value]
  page.value = 1
  closeFilter()
  await loadPage()
}
const resetFilters = async () => {
  Object.keys(filters).forEach(key => delete filters[key])
  page.value = 1
  closeFilter()
  await loadPage()
}
const goToPage = async nextPage => {
  page.value = Math.min(Math.max(1, nextPage), pageCount.value)
  await loadPage()
}

const filterKeyMap = {
  tableName: 'tableName', domain: 'domainName', fields: 'fieldName',
  queryCondition: 'whereCondition',
  reviser: 'reviser', groupOwner: 'groupOwner', date: 'registeredDate',
}
const criteria = () => {
  const tableFilters = filters.tableName || []
  const metadataStatuses = tableFilters
    .map(value => METADATA_STATUS_BY_LABEL[value])
    .filter(Boolean)
  return {
    page: page.value - 1,
    size: pageSize.value,
    tableKeyword: '',
    fieldKeyword: '',
    tableNames: tableFilters.filter(value => !METADATA_STATUS_BY_LABEL[value]),
    fieldNames: filters.fields || [],
    whereConditionValues: filters.queryCondition || [],
    domains: filters.domain || [],
    reviserEmpNos: filters.reviser || [],
    groupOwnerEmpNos: filters.groupOwner || [],
    registeredDateFrom: null,
    registeredDateTo: null,
    registeredDates: filters.date || [],
    metadataStatuses,
  }
}
const mapListItem = item => mapRegistration({
  ...item,
  fields: (item.fieldPreview || []).map(display => {
    const match = display.match(/^([^()]+)(?:\((.*)\))?$/)
    return { columnName: match?.[1] || display, columnComment: match?.[2] || '' }
  }),
})
const loadPage = async () => {
  pageError.value = ''
  try {
    const result = await searchRegistrations(criteria())
    rows.splice(0, rows.length, ...(result.items || []).map(mapListItem))
    serverTotal.value = Number(result.total || 0)
    serverGlobalTableCount.value = Number(result.globalTableCount || 0)
    serverGlobalFieldCount.value = Number(result.globalFieldCount || 0)
  } catch (error) { pageError.value = error?.message || '登记清单加载失败，请重试' }
}
const openInitialImport = () => {
  initialImportOpen.value = true
  initialImportFile.value = null
  initialImportToken.value = ''
  initialImportErrors.value = []
  initialImportMessage.value = ''
  nextTick(() => {
    if (initialImportFileInput.value) initialImportFileInput.value.value = ''
  })
}
const closeInitialImport = () => {
  if (initialImporting.value) return
  initialImportOpen.value = false
}
const triggerInitialImportFile = () => initialImportFileInput.value?.click()
const selectInitialImportFile = event => {
  initialImportFile.value = event.target.files?.[0] || null
  initialImportErrors.value = []
  initialImportMessage.value = ''
}
const submitInitialImport = async () => {
  if (!initialImportFile.value || !initialImportToken.value || initialImporting.value) return
  initialImporting.value = true
  initialImportErrors.value = []
  initialImportMessage.value = ''
  try {
    await importInitialExcel(initialImportFile.value, initialImportToken.value)
    initialImportOpen.value = false
    page.value = 1
    await loadPage()
  } catch (error) {
    initialImportErrors.value = error.data?.errors || []
    initialImportMessage.value = error.message || '初始化导入失败'
  } finally {
    initialImporting.value = false
  }
}
const exportInitialImportErrorList = async () => {
  if (!initialImportErrors.value.length || initialImportExporting.value) return
  initialImportExporting.value = true
  try {
    await exportInitialImportErrors(initialImportErrors.value)
  } catch (error) {
    initialImportMessage.value = error.message || '错误清单导出失败'
  } finally {
    initialImportExporting.value = false
  }
}
const fetchFilterOptions = async (key, keyword) => {
  filterError.value = ''
  serverFilterOptions.value = []
  serverFilterMatchedCount.value = 0
  try {
    const result = await loadHeaderFilterOptions({
      ...criteria(), targetColumn: filterKeyMap[key], keyword, limit: 200,
    })
    serverFilterOptions.value = (result.options || [])
      .filter(option => option.metadataStatus !== 'PRIMARY_KEY_CHANGED')
    serverFilterMatchedCount.value = Number(result.matchedRegistrationCount || 0)
  } catch (error) { filterError.value = error?.message || '筛选选项加载失败，请重试' }
}
const searchTableOptions = keyword => searchBaseTables(keyword, 20)
const loadTableColumns = tableName => loadBaseColumns(tableName)
const loadTableKeys = tableName => loadBaseKeys(tableName)
const changePageSize = async () => {
  page.value = 1
  await loadPage()
}

const stopFilterResize = () => {
  filterResizeState = null
  window.removeEventListener('pointermove', resizeFilterPanel)
  window.removeEventListener('pointerup', stopFilterResize)
}

const resizeFilterPanel = event => {
  if (!filterResizeState) return
  const left = Number.parseFloat(filterPanelStyle.left) || 8
  const top = Number.parseFloat(filterPanelStyle.top) || 8
  const maxWidth = Math.max(300, window.innerWidth - left - 8)
  const maxHeight = Math.max(220, window.innerHeight - top - 8)
  filterPanelSize.width = Math.max(300, Math.min(filterResizeState.width + event.clientX - filterResizeState.x, maxWidth))
  filterPanelSize.height = Math.max(220, Math.min(filterResizeState.height + event.clientY - filterResizeState.y, maxHeight))
  filterPanelStyle.width = `${Math.round(filterPanelSize.width)}px`
  filterPanelStyle.height = `${Math.round(filterPanelSize.height)}px`
}

const startFilterResize = event => {
  filterResizeState = { x: event.clientX, y: event.clientY, width: filterPanelSize.width, height: filterPanelSize.height }
  window.addEventListener('pointermove', resizeFilterPanel)
  window.addEventListener('pointerup', stopFilterResize)
}

const openGeneration = () => {
  generationOpen.value = true
  generationToken.value = ''
  generationError.value = ''
  generationGateErrors.value = []
}

const closeGeneration = () => {
  if (generating.value) return
  generationOpen.value = false
  generationToken.value = ''
  generationError.value = ''
  generationGateErrors.value = []
}

const generationErrorMessage = error => {
  if (error.code === 'INVALID_TRIGGER_TOKEN') return '口令错误，请重新输入'
  if (error.code === 'CONFIGURATION_UNCHANGED') return '当前登记与最新版本一致，无需重复生成'
  if (error.code === 'REGISTRATION_CHANGED') return '登记数据在校验期间发生变化，请刷新后重新生成'
  if (error.code === 'VERSION_NUMBER_CONFLICT') return '当前秒已生成版本，请稍后重试'
  return error.message || '版本生成失败'
}

const submitGeneration = async () => {
  if (!generationToken.value || generating.value) return
  generating.value = true
  generationError.value = ''
  generationGateErrors.value = []
  generationMessage.value = ''
  try {
    const generated = await generateVersion(generationToken.value)
    latestVersion.value = generated
    generationMessage.value = `已生成版本，共 ${generated.tableCount} 张表、${generated.fieldCount} 个字段`
    generationOpen.value = false
    generationToken.value = ''
    page.value = 1
    await loadPage()
  } catch (error) {
    generationError.value = generationErrorMessage(error)
    generationGateErrors.value = error.data?.errors || []
    if (error.code === 'INVALID_TRIGGER_TOKEN') generationToken.value = ''
    if (error.code === 'CONFIGURATION_UNCHANGED') generationOpen.value = false
  } finally {
    generating.value = false
  }
}

onBeforeUnmount(stopFilterResize)
onMounted(async () => {
  const latestVersionPromise = loadLatestVersion()
    .then(version => { latestVersion.value = version })
    .catch(() => { latestVersion.value = null })
  const initialLoadPromise = Promise.all([
    loadOptions()
      .then(options => { canConfigureSampleLimit.value = options?.canConfigurePartitions === true })
      .catch(() => { canConfigureSampleLimit.value = false }),
    loadPage(),
  ])
  const synchronizationPromise = Promise.resolve(synchronizePrimaryKeys()).catch(() => null)
  const [, synchronization] = await Promise.all([initialLoadPromise, synchronizationPromise])
  if (Number(synchronization?.addedFieldCount || 0) > 0) await loadPage()
  await latestVersionPromise
})
</script>

<style scoped>
.db-compare-page { flex: 1; min-width: 0; min-height: 0; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #f4f6f9; color: #303947; }
.page-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.page-toolbar { flex: 0 0 auto; padding: 20px 22px 0; }
.page-toolbar h2 { margin: 0 0 4px; font-size: 21px; }
.page-toolbar p { margin: 0; color: #778291; font-size: 13px; }
.page-toolbar p span { margin-left: 8px; padding: 2px 7px; border-radius: 10px; color: #a36b00; background: #fff4ce; }
.page-toolbar .generation-message { margin-top: 5px; color: #107267; }
.api-error { margin: 0 22px 10px; padding: 8px 10px; color: #9f2f2c; background: #fff1f0; border-left: 4px solid #d94a47; }
.page-dialog .api-error, .replay-header-filter-panel .api-error { margin: 8px 0; }
.nav-button { display: none; }
.toolbar-actions { display: flex; gap: 8px; margin-left: auto; }
.toolbar-actions button, .pager button { padding: 7px 11px; border: 1px solid #d4dce5; border-radius: 4px; background: #fff; color: #44505e; }
.toolbar-actions .outlined { border-color: #168478; color: #107267; }
.toolbar-actions .primary, .pager .active { border-color: #168478; color: #fff; background: #168478; }
.toolbar-actions button:disabled, .operation-button:disabled { cursor: not-allowed; opacity: .48; }
.table-shell { min-width: 0; min-height: 0; height: 0; flex: 1 1 auto; margin: 0 22px; overflow: auto; overscroll-behavior: contain; border: 1px solid #dbe2e9; border-radius: 5px; background: #fff; box-shadow: 0 3px 12px rgba(25, 42, 60, .06); scrollbar-gutter: stable; }
table { width: 100%; min-width: 950px; border-collapse: collapse; font-size: 13px; }
table.is-fixed-layout { table-layout: fixed; }
thead.is-sticky { position: sticky; top: 0; z-index: 2; color: #fff; background: #176f74; }
th { position: relative; padding: 12px 8px; text-align: left; white-space: nowrap; }
thead th.has-white-divider { border-right: 1px solid rgba(255, 255, 255, .78); }
th[data-column-key="reviser"] > span, th[data-column-key="groupOwner"] > span, th[data-column-key="date"] > span { display: block; padding-right: 15px; overflow: hidden; text-overflow: ellipsis; }
th[data-column-key="reviser"] .replay-header-filter-button, th[data-column-key="groupOwner"] .replay-header-filter-button, th[data-column-key="date"] .replay-header-filter-button { position: absolute; right: 1px; top: 50%; margin: 0; transform: translateY(-50%); }
.replay-header-filter-button { display: inline-grid; place-items: center; width: 18px; height: 18px; margin-left: 3px; padding: 0; border: 0; background: transparent; cursor: pointer; vertical-align: middle; }
.replay-header-filter-button i { display: block; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 7px solid #e9fff9; filter: drop-shadow(0 0 1px rgba(0,0,0,.7)); }
.replay-header-filter-button:hover i, .replay-header-filter-button:focus-visible i { border-top-color: #fff; }
.replay-header-filter-button.active i { border-top-color: #ffd166; }
.replay-header-filter-button:focus-visible { outline: 1px solid #fff; outline-offset: 1px; }
td { padding: 12px 10px; border-right: 1px solid #e2e8ee; border-bottom: 1px solid #e2e8ee; }
tbody tr:nth-child(even) { background: #edf7fb; }
.primary-column { position: sticky; left: 0; z-index: 1; }
thead .primary-column { z-index: 3; background: #176f74; }
tbody .primary-column { background: #fff; }
tbody tr:nth-child(even) .primary-column { background: #edf7fb; }
.table-name-cell.is-table-missing { border-left: 4px solid #d94a47; background: #fff0ef; }
tbody tr:nth-child(even) .table-name-cell.is-table-missing { background: #ffe9e7; }
.metadata-status { display: inline-block; margin-top: 6px; padding: 2px 6px; border-radius: 9px; font-size: 10px; line-height: 1.4; }
.scope-status { color: #176f74; background: #e2f4f1; }
.is-table-missing-status { color: #fff; background: #d94a47; }
.is-unavailable-status { color: #596673; background: #e8edf1; }
td strong, td small { display: block; }
td small { margin-top: 4px; color: #7b8795; }
.fields { color: #1769aa; }
.field-content { overflow: hidden; line-height: 1.65; text-overflow: ellipsis; }
.field-list { display: flex; flex-wrap: wrap; gap: 6px 0; align-items: flex-start; }
.field-item { max-width: 100%; color: #1769aa; line-height: 1.65; overflow-wrap: anywhere; }
.field-item.is-missing-in-base-preview { color: #d92d20; text-decoration: line-through; text-decoration-thickness: 1.5px; }
.field-separator { margin-right: 6px; }
.field-actions { display: flex; gap: 10px; margin-top: 5px; }
.field-action { padding: 0; border: 0; color: #168478; background: transparent; font-size: 12px; cursor: pointer; }
.fields:not(.is-expanded) .field-content { white-space: nowrap; }
.query-condition-cell { color: #44505e; vertical-align: top; }
.query-condition-content { line-height: 1.65; overflow-wrap: anywhere; }
.query-condition-cell.is-expanded .query-condition-content { white-space: pre-line; }
.query-condition-cell:not(.is-expanded) .query-condition-content { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compact-copy-cell { position: relative; min-width: 0; max-width: 0; overflow: hidden; }
.compact-cell-content { display: block; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.table-name-content strong, .table-name-content small { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compact-copy-cell > button { display: none; position: absolute; z-index: 1; right: 4px; bottom: 3px; padding: 1px 4px; border: 1px solid #a9c8c5; border-radius: 3px; color: #14766d; background: #fff; font-size: 10px; cursor: pointer; }
.compact-copy-cell:hover > button, .compact-copy-cell:focus-within > button { display: block; }
.operation-cell { padding-right: 5px; padding-left: 5px; white-space: nowrap; }
.operation-button { margin-right: 2px; padding: 4px 4px; border: 1px solid #9fbab8; border-radius: 3px; color: #176f74; background: #fff; font-size: 11px; cursor: pointer; }
.operation-button:hover { border-color: #176f74; background: #eff9f8; }
.operation-button.danger { border-color: #e7aaa9; color: #c83d3a; }
.page-dialog-backdrop { position: fixed; inset: 0; z-index: 1700; display: grid; place-items: center; padding: 20px; background: rgba(22, 31, 41, .46); }
.page-dialog { width: min(680px, calc(100vw - 40px)); max-height: calc(100vh - 40px); overflow: auto; border-radius: 7px; background: #fff; box-shadow: 0 18px 50px rgba(0, 0, 0, .24); }
.page-dialog.compact-dialog { width: min(480px, calc(100vw - 40px)); }
.page-dialog > header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #dfe6eb; }
.page-dialog > header h3 { margin: 0; font-size: 17px; }
.page-dialog > header button { width: 28px; height: 28px; border: 0; color: #66727e; background: transparent; font-size: 22px; cursor: pointer; }
.page-dialog dl { display: grid; grid-template-columns: 100px minmax(0, 1fr); margin: 0; padding: 18px; }
.page-dialog dt, .page-dialog dd { margin: 0; padding: 10px; border-bottom: 1px solid #edf0f2; overflow-wrap: anywhere; }
.page-dialog dt { color: #6f7a85; background: #f6f8f9; }
.detail-fields { display: flex; flex-wrap: wrap; gap: 6px; }
.detail-fields > span { display: inline-flex; align-items: center; gap: 5px; padding: 4px 7px; border: 1px solid #dbe3e8; border-radius: 4px; background: #fff; }
.detail-fields > span.is-missing-in-base { border-color: #e35a56; color: #b52f2b; background: #fff0ef; }
.detail-fields > span b { padding: 1px 5px; border-radius: 8px; color: #fff; background: #d94a47; font-size: 10px; }
.detail-fields > span b.primary-key-badge { color: #c7332f; background: #ffe5e3; }
.detail-fields > span b.comparison-key-badge { color: #176f74; background: #e3f5f2; }
.detail-missing-warning { flex: 1 0 100%; margin: 0 0 4px; padding: 7px 9px; border-left: 4px solid #d94a47; color: #b52f2b; background: #fff0ef; font-weight: 600; }
.detail-table-warning, .detail-metadata-unavailable { margin: 14px 18px 0 !important; padding: 10px 12px !important; line-height: 1.6; }
.detail-table-warning { border-left: 4px solid #d94a47; color: #a92f2b; background: #fff0ef; font-weight: 600; }
.detail-metadata-unavailable { border-left: 4px solid #97a3ad; color: #596673; background: #f2f5f7; }
.page-dialog > p { margin: 0; padding: 24px 18px; line-height: 1.7; }
.page-dialog > footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid #e3e8ec; }
.page-dialog > footer button { padding: 7px 14px; border: 1px solid #ccd5dc; border-radius: 4px; background: #fff; cursor: pointer; }
.page-dialog > footer .danger-confirm { border-color: #d94a47; color: #fff; background: #d94a47; }
.page-dialog > footer .primary { border-color: #168478; color: #fff; background: #168478; }
.page-dialog button:disabled { cursor: not-allowed; opacity: .5; }
.initial-import-dialog { width: min(960px, calc(100vw - 40px)); }
.initial-import-body { display: grid; gap: 12px; padding: 18px; }
.initial-import-body p, .initial-import-body ul { margin: 0; line-height: 1.7; }
.initial-import-body label { display: grid; gap: 6px; font-size: 13px; }
.initial-import-body input { min-height: 36px; padding: 5px 9px; border: 1px solid #ccd5dc; border-radius: 4px; }
.initial-import-file-field { display: grid; gap: 6px; font-size: 13px; }
.initial-import-file-trigger { display: flex; align-items: center; width: 100%; min-height: 42px; padding: 6px 10px; overflow: hidden; border: 1px solid #ccd5dc; border-radius: 4px; color: #263746; background: #fff; text-align: left; cursor: pointer; }
.initial-import-file-trigger > span { flex: 0 0 auto; padding: 5px 10px; border: 1px solid #93a5b4; border-radius: 3px; background: #f7f9fa; }
.initial-import-file-trigger > small { min-width: 0; margin-left: 10px; overflow: hidden; color: #667985; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.initial-import-file-trigger:focus-visible { outline: 2px solid #178c84; outline-offset: 2px; }
.initial-import-file-trigger:disabled { cursor: not-allowed; opacity: .65; }
.initial-import-file-input { position: absolute; width: 1px; height: 1px; padding: 0 !important; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0 !important; }
.initial-import-message.is-error { padding: 8px 10px; border-left: 4px solid #d94a47; color: #a92f2b; background: #fff0ef; }
.initial-import-errors { max-height: 320px; overflow: auto; border: 1px solid #dbe2e9; }
.initial-import-errors-header { display: flex; position: sticky; top: 0; z-index: 2; align-items: center; justify-content: space-between; padding: 7px 10px; color: #a92f2b; background: #fff7f6; }
.initial-import-errors-header button { padding: 5px 10px; border: 1px solid #d9a19e; border-radius: 4px; color: #9f2f2c; background: #fff; cursor: pointer; }
.initial-import-errors-header button:disabled { cursor: not-allowed; opacity: .65; }
.initial-import-errors table { min-width: 820px; table-layout: auto; }
.initial-import-errors th { position: sticky; top: 34px; color: #fff; background: #176f74; }
.initial-import-errors th, .initial-import-errors td { padding: 8px; }
.generation-dialog { width: min(1040px, calc(100vw - 40px)); }
.generation-dialog > header > div { display: grid; gap: 3px; }
.generation-dialog > header p { margin: 0; color: #778291; font-size: 12px; }
.generation-body { display: grid; gap: 14px; padding: 18px; }
.generation-body > label { display: grid; gap: 7px; max-width: 440px; color: #42515f; font-size: 13px; }
.generation-body input { min-height: 38px; padding: 7px 10px; border: 1px solid #cbd5dc; border-radius: 4px; }
.generation-error { margin: 0; padding: 9px 11px; border-left: 4px solid #d94a47; color: #9f2f2c; background: #fff1f0; }
.generation-gate-errors { display: grid; gap: 8px; }
.generation-gate-errors > strong { color: #a92f2b; }
.generation-gate-table-wrap { max-height: 380px; overflow: auto; border: 1px solid #dbe2e9; border-radius: 4px; }
.generation-gate-table-wrap table { min-width: 940px; table-layout: auto; }
.generation-gate-table-wrap th { position: sticky; top: 0; z-index: 1; color: #fff; background: #176f74; }
.generation-gate-table-wrap th, .generation-gate-table-wrap td { padding: 9px; vertical-align: top; }
.generation-gate-table-wrap td { border-bottom: 1px solid #edf0f2; }
.generation-gate-table-wrap td:first-child { display: grid; gap: 3px; }
.generation-gate-table-wrap td small { color: #7b8792; }
.gate-status { display: inline-block; padding: 2px 7px; border-radius: 10px; color: #a92f2b; background: #ffe4e1; white-space: nowrap; }
.replay-header-filter-panel { position: fixed; z-index: 1500; box-sizing: border-box; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 6px; padding: 8px; overflow: hidden; border: 1px solid #8e8e8e; border-radius: 3px; color: #222; background: #454545; box-shadow: 0 8px 22px rgba(0, 0, 0, .32); }
.replay-header-filter-panel > header, .replay-header-filter-panel > footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.replay-header-filter-panel > header { padding: 0 2px; color: #fff; }
.replay-header-filter-panel > header strong { font-size: 13px; }
.replay-header-filter-content { min-height: 0; display: grid; grid-template-rows: auto auto minmax(78px, 1fr); gap: 5px; padding: 7px; border-radius: 4px; background: #454545; }
.replay-header-filter-search { display: flex; gap: 5px; }
.replay-header-filter-search input { flex: 1; min-width: 0; height: 28px; padding: 0 8px; border: 1px solid #777; border-radius: 3px; color: #eee; background: #555; }
.replay-header-filter-search button { width: 28px; border: 1px solid #42b883; border-radius: 3px; color: #fff; background: #42b883; cursor: pointer; }
.replay-header-filter-actions { display: flex; gap: 6px; }
.replay-header-filter-actions button { padding: 3px 7px; border: 0; color: #ddd; background: transparent; cursor: pointer; font-size: 11px; }
.replay-header-filter-actions span { align-self: center; color: #c7c7c7; font-size: 11px; white-space: nowrap; }
.replay-header-filter-options { min-height: 0; overflow: auto; display: grid; align-content: start; gap: 1px; padding: 3px; border-radius: 3px; background: #555; }
.replay-header-filter-options label { display: flex; align-items: flex-start; gap: 6px; width: max-content; min-width: 100%; min-height: 23px; padding: 3px 4px; border-radius: 3px; color: #eee; font-size: 12px; line-height: 1.35; cursor: pointer; }
.replay-header-filter-options label:hover { background: #666; }
.replay-header-filter-options label span { white-space: nowrap; }
.replay-header-filter-options label em { position: sticky; right: 0; flex: 0 0 auto; min-width: 52px; margin-left: auto; padding-left: 10px; color: #c7c7c7; background: #555; text-align: right; font-style: normal; white-space: nowrap; }
.replay-header-filter-options label:hover em { background: #666; }
.replay-header-filter-options input { flex: 0 0 auto; margin-top: 2px; accent-color: #42d1a5; }
.replay-header-filter-options p { margin: 12px 4px; color: #bbb; text-align: center; font-size: 12px; }
.replay-header-filter-panel > footer { padding-top: 5px; border-top: 1px solid #666; }
.replay-header-filter-panel > footer > span { flex: 1; }
.replay-header-filter-panel > footer button { min-height: 25px; padding: 4px 9px; border: 1px solid #777; border-radius: 3px; color: #eee; background: #555; cursor: pointer; }
.replay-header-filter-panel > footer .primary { border-color: #42b883; background: #42b883; }
.replay-header-filter-panel > footer .replay-header-filter-clear { border-color: #777; color: #ffcf8a; background: #555; }
.replay-header-filter-resize-handle { position: absolute; right: 1px; bottom: 1px; width: 16px; height: 16px; padding: 0; border: 0; cursor: nwse-resize; touch-action: none; background: linear-gradient(135deg, transparent 0 42%, #bbb 43% 49%, transparent 50% 61%, #ddd 62% 68%, transparent 69%); }
.pager { flex: 0 0 auto; min-height: 52px; display: flex; justify-content: flex-end; align-items: center; gap: 14px; padding: 10px 22px; border-top: 1px solid #e2e8ee; background: #fff; font-size: 12px; color: #687381; }
.pager label { display: inline-flex; align-items: center; gap: 6px; }
.pager select { width: 66px; height: 31px; padding: 0 7px; border: 1px solid #d4dce5; border-radius: 4px; color: #44505e; background: #fff; }
.page-actions { display: flex; gap: 6px; }
.page-actions button { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; font-size: 20px; line-height: 1; }
@media (max-width: 760px) { .page-toolbar { align-items: flex-start; flex-wrap: wrap; padding: 12px 12px 0; } .table-shell { margin: 0 12px; } .pager { padding: 8px 12px; justify-content: space-between; } .nav-button { display: inline-block; } .toolbar-actions { width: 100%; margin-left: 0; } }
</style>
