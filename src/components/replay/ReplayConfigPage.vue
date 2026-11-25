<template>
  <section class="replay-page replay-config-page" aria-label="忽略清单" data-testid="replay-ignore-list">
    <header class="replay-toolbar"><h2>忽略清单</h2></header>

    <nav class="replay-tabs" role="tablist" aria-label="忽略清单分类">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        role="tab"
        class="replay-tab"
        :class="{ active: activeTab === tab.key }"
        :aria-selected="activeTab === tab.key ? 'true' : 'false'"
        :data-testid="`tab-${tab.key}`"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <form class="replay-filters" @submit.prevent="search">
      <div class="replay-filter-group">
        <label class="replay-checkbox">
          <input v-model="reviewableByMe" type="checkbox" data-testid="filter-reviewable-by-me" />
          <span data-testid="filter-reviewable-by-me-label">仅我可以审核</span>
        </label>
        <label class="replay-checkbox">
          <input v-model="developedByMe" type="checkbox" data-testid="filter-developed-by-me" />
          <span>仅看我开发的</span>
        </label>
        <label class="replay-checkbox">
          <input v-model="reasonEmpty" type="checkbox" data-testid="filter-reason-empty" />
          <span data-testid="filter-reason-empty-label">{{ reasonEmptyLabel }}</span>
        </label>
        <label v-if="CHINESE_NAME_COLUMNS[activeTab]" class="replay-checkbox">
          <input v-model="fieldChineseNameEmpty" type="checkbox" data-testid="filter-field-chinese-name-empty" />
          <span>仅看中文字段为空</span>
        </label>
      </div>
      <div class="replay-filter-actions">
        <button class="replay-button replay-button-primary" type="submit" data-testid="search">查询</button>
        <button class="replay-button" type="button" data-testid="reset" @click="reset">重置筛选条件</button>
        <button class="replay-button replay-button-primary" type="button" data-testid="batch-review" :disabled="!selectedIds.length || loading" @click="batchReview">
          批量审核{{ selectedIds.length ? `（${selectedIds.length}）` : '' }}
        </button>
        <button class="replay-button replay-button-danger" type="button" data-testid="batch-delete" :disabled="!selectedIds.length || loading" @click="batchDelete">
          批量删除{{ selectedIds.length ? `（${selectedIds.length}）` : '' }}
        </button>
        <button class="replay-button replay-button-primary" type="button" data-testid="create-config" @click="openCreate">新增</button>
        <button v-if="reasonImportColumns" class="replay-button" type="button" data-testid="import-empty-reasons" @click="openReasonImport">忽略原因为空数据导入</button>
        <button v-if="CHINESE_NAME_COLUMNS[activeTab]" class="replay-button" type="button" data-testid="import-empty-chinese-names" @click="openReasonImport(true)">字段中文名称为空数据导入</button>
        <button class="replay-button" type="button" :data-testid="isMessageSequenceTab ? 'export-message-sequences' : isOneSideTab ? 'export-one-side-error-codes' : 'export-excel'" :disabled="exporting" @click="exportConfigs">
          {{ exporting ? '导出中...' : isMessageSequenceTab ? '导出流水号忽略' : isOneSideTab ? '导出单边失败错误码' : '导出Excel' }}
        </button>
      </div>
    </form>

    <div class="replay-table-viewport">
      <table class="replay-table">
        <thead>
          <tr>
            <th class="replay-select-column"><input type="checkbox" :checked="allSelected" :disabled="!items.length" data-testid="select-all" @change="toggleAll" /></th>
            <th v-for="column in schema.columns" :key="column.key" :class="{ 'replay-column-with-help': column.help }">
              <span class="replay-column-heading">
                <span>{{ column.label }}</span>
                <button
                  v-if="headerFilterFor(column)"
                  class="replay-header-filter-button"
                  type="button"
                  :class="{ active: isHeaderFilterActive(column.key) }"
                  :data-testid="`column-filter-${column.key}`"
                  :title="`筛选${column.label}`"
                  :aria-label="`筛选${column.label}`"
                  :aria-expanded="headerFilterKey === column.key"
                  @click.stop="openHeaderFilter(column, $event)"
                ><i aria-hidden="true"></i></button>
                <button
                  v-if="column.help"
                  class="replay-column-help"
                  type="button"
                  :aria-label="column.help"
                  :aria-describedby="reviewerHelp.visible ? 'bank-owner-tooltip' : undefined"
                  :data-tooltip="column.help"
                  data-testid="bank-owner-help"
                  @mouseenter="showReviewerHelp"
                  @mouseleave="hideReviewerHelp"
                  @focus="showReviewerHelp"
                  @blur="hideReviewerHelp"
                >
                  <CircleHelp :size="14" :stroke-width="2" aria-hidden="true" />
                </button>
              </span>
            </th>
            <th class="replay-operation-column">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id">
            <td class="replay-select-column"><input type="checkbox" :value="row.id" v-model="selectedIds" :data-testid="`select-${row.id}`" /></td>
            <td v-for="column in schema.columns" :key="column.key" :class="{ 'replay-cell-long': column.long, 'replay-cell-ellipsis': column.ellipsis }" :title="displayValue(column, row)">
              <template v-if="column.condition && row[column.key]?.trim()">
                <div class="replay-condition" :class="{ 'is-expanded': expandedConditions.has(conditionKey(row, column)) }">{{ row[column.key] }}</div>
                <div class="replay-condition-actions">
                  <button type="button" @click="toggleCondition(row, column)">{{ expandedConditions.has(conditionKey(row, column)) ? '收起' : '展开' }}</button>
                  <button v-if="expandedConditions.has(conditionKey(row, column))" type="button" @click="copyCondition(row, column)">{{ copiedCondition === conditionKey(row, column) ? '已复制' : '复制全部条件' }}</button>
                </div>
              </template>
              <template v-else>{{ displayValue(column, row) }}</template>
            </td>
            <td class="replay-operation-column">
              <div class="replay-operation-buttons">
                <button
                  class="replay-button replay-button-compact"
                  type="button"
                  :data-testid="`review-${row.id}`"
                  :disabled="!row.canReview"
                  :title="reviewButtonTitle(row)"
                  @click="reviewRow(row)"
                >审核</button>
                <button class="replay-button replay-button-compact" type="button" :data-testid="`edit-${row.id}`" @click="openEdit(row)">修改</button>
                <button class="replay-button replay-button-compact" type="button" :data-testid="`delete-${row.id}`" @click="removeRow(row)">删除</button>
                <button class="replay-button replay-button-compact" type="button" :data-testid="`history-${row.id}`" @click="openHistory(row)">历史</button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && !items.length">
            <td :colspan="schema.columns.length + 2" class="replay-state">暂无配置数据</td>
          </tr>
          <tr v-else-if="loading">
            <td :colspan="schema.columns.length + 2" class="replay-state">加载中...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <form
      v-if="headerFilterKey"
      class="replay-header-filter-panel"
      :class="{ 'is-developer-filter': activeHeaderFilter.kind === 'person' }"
      :style="headerFilterPanelStyle"
      data-testid="header-filter-panel"
      ref="headerFilterPanel"
      :aria-label="`筛选${headerFilterLabel}`"
      @submit.prevent="applyHeaderFilter"
      @keydown.esc.stop.prevent="closeHeaderFilter"
    >
      <header><strong>筛选 {{ headerFilterLabel }}</strong></header>
      <div class="replay-header-filter-content">
        <input v-if="activeHeaderFilter.kind === 'text'" v-model.trim="headerFilterDraft" type="search" :placeholder="activeHeaderFilter.placeholder || '模糊搜索'" :aria-label="headerFilterLabel" />
        <template v-else>
              <input v-if="['person', 'domain'].includes(activeHeaderFilter.kind)" v-model.trim="headerFilterSearch" type="search" placeholder="模糊搜索" aria-label="搜索筛选选项" @keydown.enter.prevent />
          <div class="replay-header-filter-options">
            <label v-for="option in headerFilterOptions" :key="option.value">
                  <input v-model="headerFilterDraft" type="radio" name="header-filter-value" :value="option.value" />
                  <span>{{ option.label }}</span>
            </label>
            <p v-if="!headerFilterOptions.length">暂无选项</p>
          </div>
        </template>
      </div>
      <footer>
        <button class="replay-button replay-button-compact replay-header-filter-clear" type="button" @click="clearHeaderFilter">清空筛选</button>
        <span class="replay-header-filter-footer-spacer"></span>
        <button class="replay-button replay-button-compact" type="button" @click="closeHeaderFilter">取消</button>
        <button class="replay-button replay-button-primary replay-button-compact" type="submit">确定</button>
      </footer>
    </form>

    <div
      v-if="reviewerHelp.visible"
      id="bank-owner-tooltip"
      class="replay-column-tooltip"
      role="tooltip"
      :style="reviewerHelp.style"
      data-testid="bank-owner-tooltip"
    >{{ REVIEWER_HELP_TEXT }}</div>

    <footer class="replay-pager">
      <span>共 {{ total }} 条，第 {{ page + 1 }} / {{ pageCount }} 页</span>
      <label class="replay-page-size">每页
        <select v-model.number="pageSize" data-testid="page-size" @change="changePageSize">
          <option :value="10">10</option>
          <option :value="30">30</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select> 条
      </label>
      <div class="replay-page-actions">
        <button class="replay-button replay-button-compact" type="button" data-testid="previous-page" :disabled="page === 0 || loading" @click="goPrevious">上一页</button>
        <button class="replay-button replay-button-compact" type="button" data-testid="next-page" :disabled="page + 1 >= pageCount || loading" @click="goNext">下一页</button>
      </div>
    </footer>

    <div v-if="editOpen" class="replay-modal-mask">
      <section class="replay-edit-modal" role="dialog" aria-modal="true" :aria-label="editTitle">
        <header>
          <h3>{{ editTitle }}</h3>
          <button class="replay-icon-button" type="button" data-testid="close-edit" :disabled="saving" @click="closeEdit">关闭</button>
        </header>
        <form class="replay-edit-grid" @submit.prevent="submitForm">
          <template v-for="(row, index) in formRows" :key="index">
            <p v-if="isMultiCreate" class="replay-field-wide replay-create-row-title">第 {{ index + 1 }} 条</p>
            <label v-for="field in activeForm" :key="field.key" class="replay-field" :class="{ 'replay-field-wide': field.kind === 'textarea' }">
              <span>{{ field.label }}<em v-if="field.required"> *</em></span>
              <select v-if="field.kind === 'ownership'" v-model="row[field.key]" :data-testid="fieldTestId(field, index)">
                <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <select v-else-if="field.kind === 'select'" v-model.number="row[field.key]" :data-testid="fieldTestId(field, index)">
                <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <textarea v-else-if="field.kind === 'textarea'" v-model="row[field.key]" :data-testid="fieldTestId(field, index)" rows="3" :maxlength="field.maxlength || undefined" :placeholder="field.placeholder || ''"></textarea>
              <input v-else v-model.trim="row[field.key]" :data-testid="fieldTestId(field, index)" type="text" :maxlength="field.maxlength || undefined" :placeholder="field.placeholder || ''" />
            </label>
          </template>
          <p v-if="createHint" class="replay-field-wide replay-hint">{{ createHint }}</p>
          <div v-if="formError" class="replay-message replay-error replay-field-wide" data-testid="form-error">{{ formError }}</div>
          <div class="replay-form-actions replay-field-wide">
            <button class="replay-button" type="button" :disabled="saving" @click="closeEdit">取消</button>
            <button class="replay-button replay-button-primary" type="submit" data-testid="submit-config" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
          </div>
        </form>
      </section>
    </div>

    <div v-if="historyOpen" class="replay-drawer-mask" @click.self="closeHistory">
      <aside class="replay-history-drawer" role="dialog" aria-modal="true" aria-label="操作历史" data-testid="history-drawer">
        <header>
          <h3>操作历史</h3>
          <button class="replay-icon-button" type="button" data-testid="close-history" @click="closeHistory">关闭</button>
        </header>
        <p v-if="historyLoading" class="replay-state">加载中...</p>
        <p v-else-if="!historyItems.length" class="replay-state">暂无操作记录</p>
        <ol v-else class="replay-history-list">
          <li v-for="operation in historyItems" :key="operation.id" class="replay-history-item">
            <div class="replay-history-head">
              <span class="replay-history-type" :class="`replay-history-${operation.operationType.toLowerCase()}`">{{ operationLabel(operation) }}</span>
              <span>{{ operation.operatorRealName || operation.operatorUsername || '-' }}</span>
              <time>{{ formatTime(operation.createdAt) }}</time>
            </div>
            <table class="replay-history-changes">
              <thead><tr><th>字段</th><th>原值</th><th>新值</th></tr></thead>
              <tbody>
                <tr v-for="change in operation.changes" :key="change.field">
                  <td>{{ changeLabel(change) }}</td>
                  <td>{{ formatChangeValue(change, change.oldValue) }}</td>
                  <td>{{ formatChangeValue(change, change.newValue) }}</td>
                </tr>
              </tbody>
            </table>
          </li>
        </ol>
      </aside>
    </div>

    <div v-if="reasonImportTab" class="replay-modal-mask" @click.self="closeReasonImport">
      <form class="replay-confirm-modal replay-reason-import" role="dialog" aria-modal="true" :aria-label="importTitle"
            data-testid="reason-import-dialog" @submit.prevent="submitReasonImport" @keydown.esc="closeReasonImport">
        <p class="replay-confirm-text">{{ importTitle }} · {{ SCHEMAS[reasonImportTab].title }}</p>
        <p>选择 .xlsx 或 .xls 文件。只读取第一个工作表，第一行直接填写数据，不要加表头。</p>
        <ol>
          <li v-for="label in importColumns" :key="label">{{ label }}</li>
        </ol>
        <p v-if="reasonImportTab === 'error-code-ignores'">老核心、新核心错误码至少填一列，空的一侧保留空单元格。</p>
        <p>只补充已有记录的{{ importingChineseNames ? '空中文名称' : '空原因' }}，保留审核状态。</p>
        <input aria-label="选择 Excel 文件" type="file" accept=".xlsx,.xls" :disabled="importingReasons"
               @change="reasonImportFile = $event.target.files?.[0] ?? null" />
        <p v-if="reasonImportError" class="replay-message replay-error" role="alert">{{ reasonImportError }}</p>
        <div class="replay-confirm-actions">
          <button class="replay-button" type="button" :disabled="importingReasons" @click="closeReasonImport">取消</button>
          <button class="replay-button replay-button-primary" type="submit" :disabled="!reasonImportFile || importingReasons">
            {{ importingReasons ? '导入中...' : '导入' }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="confirmOpen" class="replay-modal-mask" @click.self="!confirming && closeConfirm()">
      <section class="replay-confirm-modal" role="alertdialog" aria-modal="true" aria-label="操作确认" data-testid="confirm-modal">
        <p class="replay-confirm-text">{{ confirmText }}</p>
        <dl v-if="confirmDetails.length" class="replay-confirm-detail">
          <div v-for="item in confirmDetails" :key="item.label" class="replay-confirm-row">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
        <div class="replay-confirm-actions">
          <button class="replay-button" type="button" data-testid="confirm-cancel" :disabled="confirming" @click="closeConfirm">取消</button>
          <button class="replay-button" :class="confirmDanger ? 'replay-button-danger' : 'replay-button-primary'" type="button" data-testid="confirm-ok" :disabled="confirming" @click="confirmAction">{{ confirming ? '处理中...' : '确定' }}</button>
        </div>
      </section>
    </div>

    <div v-if="reviewerMappingWarningCodes.length" class="replay-modal-mask">
      <section
        class="replay-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label="新增成功，但暂不可审核"
        data-testid="reviewer-mapping-warning"
      >
        <h3 class="replay-warning-title">新增成功，但暂不可审核</h3>
        <p v-if="reviewerMappingWarningCodes.length === 1" class="replay-confirm-text">
          未找到审核负责人。服务码 {{ reviewerMappingWarningCodes[0] }} 尚未映射到全量交易人员，请联系敬恒杰维护清单。
        </p>
        <template v-else>
          <p class="replay-confirm-text">未找到审核负责人。以下服务码尚未映射到全量交易人员：</p>
          <ul class="replay-warning-codes">
            <li v-for="code in reviewerMappingWarningCodes" :key="code">{{ code }}</li>
          </ul>
        </template>
        <p v-if="reviewerMappingWarningCodes.length > 1" class="replay-confirm-text">请联系敬恒杰维护清单。</p>
        <div class="replay-confirm-actions">
          <button class="replay-button replay-button-primary" type="button" data-testid="close-reviewer-mapping-warning" @click="closeReviewerMappingWarning">我知道了</button>
        </div>
      </section>
    </div>

    <transition name="replay-toast">
      <div v-if="toast.visible" class="replay-toast" :class="`replay-toast-${toast.kind}`" role="status" data-testid="toast">
        {{ toast.text }}
      </div>
    </transition>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { CircleHelp } from 'lucide-vue-next'
import { copyText } from '../../utils/clipboard.js'
import {
  batchDeleteMessageSequenceIgnores,
  batchDeleteOneSideErrorCodeIgnores,
  batchReviewMessageSequenceIgnores,
  batchReviewOneSideErrorCodeIgnores,
  batchCreateReplayConfigs,
  batchDeleteReplayConfigs,
  batchReviewReplayConfigs,
  createMessageSequenceIgnores,
  createOneSideErrorCodeIgnores,
  createReplayConfig,
  deleteMessageSequenceIgnore,
  deleteOneSideErrorCodeIgnore,
  deleteReplayConfig,
  exportReviewedMessageSequenceIgnores,
  exportReviewedOneSideErrorCodeIgnores,
  exportReviewedReplayConfigs,
  importReplayConfigReasons,
  importReplayConfigChineseNames,
  listReplayConfigDomains,
  listReplayConfigDevelopers,
  listReplayConfigOperations,
  listReplayConfigs,
  reviewMessageSequenceIgnore,
  reviewOneSideErrorCodeIgnore,
  reviewReplayConfig,
  updateMessageSequenceIgnore,
  updateOneSideErrorCodeIgnore,
  updateReplayConfig,
} from '../../api/replayConfigs.js'

const REVIEWER_HELP_TEXT = '未找到行方负责人时，该条记录不可审核，请联系敬恒杰维护清单。'
const EMPTY_FILTER = '__EMPTY__'
const TRANSACTION_CATEGORY_LABEL = '交易类别'
const HEADER_FILTER_CHOICES = {
  flag: [['1', '普通字段'], ['2', '对象或数组']],
  review: [['0', '未审核'], ['1', '已审核']],
  category: [['QUERY', '查询'], ['ACCOUNTING', '账务']],
  ownership: [['528', '528'], ['ccbs', 'ccbs']],
}

const REVIEW_COLUMNS = [
  { key: 'oldTransactionCode', label: '老核心交易码' },
  { key: 'developer', label: '开发人员' },
  { key: 'bankOwner', label: '行方负责人', help: REVIEWER_HELP_TEXT },
  { key: 'reviewStatus', label: '审核状态', display: 'review' },
]

const SERVICE_CODE_PATTERN = /^[0-9A-Za-z]+&(sop|soap|bzjson)$/

const TABS = [
  { key: 'unconditional-ignores', label: '无条件忽略' },
  { key: 'conditional-ignores', label: '有条件忽略' },
  { key: 'error-code-ignores', label: '错误码忽略' },
  { key: 'sort-fields', label: '排序字段' },
  { key: 'message-sequence-ignores', label: '流水号忽略' },
  { key: 'one-side-error-code-ignores', label: '单边失败错误码忽略' },
]

const MESSAGE_SEQUENCE_CREATE_FORM = [
  { key: 'serviceCode', label: '服务码', kind: 'serviceCode', required: true, placeholder: '如 S120034071CorpInfoQryTrdCrclr&sop' },
  { key: 'category', label: TRANSACTION_CATEGORY_LABEL, kind: 'select', required: true, options: [
    { value: 'QUERY', label: '查询' },
    { value: 'ACCOUNTING', label: '账务' },
  ] },
  { key: 'messageSequences', label: '流水号', kind: 'textarea', required: true, placeholder: '多个流水号请使用英文逗号分隔，单次最多 100 个' },
  { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
]

const ONE_SIDE_ERROR_CODE_CREATE_FORM = [
  { key: 'serviceCode', label: '服务码', kind: 'serviceCode', required: true, placeholder: '如 S120034071CorpInfoQryTrdCrclr&sop' },
  { key: 'category', label: TRANSACTION_CATEGORY_LABEL, kind: 'select', required: true, options: [
    { value: 'QUERY', label: '查询' },
    { value: 'ACCOUNTING', label: '账务' },
  ] },
  { key: 'ownership', label: '归属', kind: 'ownership', required: true, options: [
    { value: '528', label: '528' },
    { value: 'ccbs', label: 'ccbs' },
  ] },
  { key: 'errorCodes', label: '忽略错误码', kind: 'textarea', required: true, placeholder: '多个错误码请使用英文逗号分隔，单次最多 100 个' },
  { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
]

const SORT_CREATE_FORM = [
  { key: 'tranCode', label: '4 位交易码', kind: 'text', required: true, placeholder: '如 6208' },
  { key: 'oldSortField', label: '老核心排序字段', kind: 'text', required: true, placeholder: '单个属性：A.B；多个属性：A(B,C)' },
  { key: 'oldSortFieldChineseName', label: '老核心排序字段中文名称', kind: 'text', required: true, maxlength: 256 },
  { key: 'newSortField', label: '新核心排序字段', kind: 'text', required: true, placeholder: '单个属性：A.B；多个属性：A(B,C)' },
  { key: 'newSortFieldChineseName', label: '新核心排序字段中文名称', kind: 'text', required: true, maxlength: 256 },
  { key: 'ignoreReason', label: '排序原因', kind: 'textarea', required: true, maxlength: 512 },
]

const SCHEMAS = {
  'unconditional-ignores': {
    title: '无条件忽略',
    filters: [
      { key: 'tranCode', label: '服务码', kind: 'text' },
      { key: 'fieldName', label: '忽略字段', kind: 'text' },
      { key: 'reviewStatus', label: '审核状态', kind: 'review' },
    ],
    columns: [
      { key: 'domain', label: '领域' },
      { key: 'tranCode', label: '服务码' },
      { key: 'fieldName', label: '忽略字段' },
      { key: 'fieldChineseName', label: '忽略字段中文名称' },
      { key: 'ignoreReason', label: '忽略原因', ellipsis: true },
      ...REVIEW_COLUMNS,
    ],
    confirmFields: [
      { key: 'tranCode', label: '服务码' },
      { key: 'fieldName', label: '忽略字段' },
      { key: 'fieldChineseName', label: '忽略字段中文名称' },
    ],
    form: [
      { key: 'tranCode', label: '服务码', kind: 'serviceCode', required: true, placeholder: '如 S120034071CorpInfoQryTrdCrclr&sop' },
      { key: 'fieldName', label: '忽略字段', kind: 'text', required: true },
      { key: 'fieldChineseName', label: '忽略字段中文名称', kind: 'text', required: true, maxlength: 256 },
      { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
    ],
  },
  'conditional-ignores': {
    title: '有条件忽略',
    filters: [
      { key: 'origTrcd', label: '服务码', kind: 'text' },
      { key: 'fieldRmoveName', label: '忽略字段', kind: 'text' },
      { key: 'fieldFileFlag', label: '字段标识', kind: 'flag' },
      { key: 'reviewStatus', label: '审核状态', kind: 'review' },
    ],
    columns: [
      { key: 'domain', label: '领域' },
      { key: 'origTrcd', label: '服务码' },
      { key: 'fieldRmoveName', label: '忽略字段' },
      { key: 'fieldChineseName', label: '忽略字段中文名称' },
      { key: 'fieldFileIndx', label: '字段索引' },
      { key: 'fieldFileFlag', label: '字段标识', display: 'flag' },
      { key: 'origFieldCond', label: '主系统字段忽略条件', condition: true },
      { key: 'destFieldCond', label: '备系统字段忽略条件', condition: true },
      { key: 'ignoreReason', label: '忽略原因', ellipsis: true },
      ...REVIEW_COLUMNS,
    ],
    confirmFields: [
      { key: 'origTrcd', label: '服务码' },
      { key: 'fieldRmoveName', label: '忽略字段' },
      { key: 'fieldChineseName', label: '忽略字段中文名称' },
    ],
    form: [
      { key: 'origTrcd', label: '服务码', kind: 'serviceCode', required: true },
      { key: 'fieldRmoveName', label: '忽略字段', kind: 'text', required: true },
      { key: 'fieldChineseName', label: '忽略字段中文名称', kind: 'text', required: true, maxlength: 256 },
      { key: 'fieldFileFlag', label: '字段标识', kind: 'select', required: true, options: [
        { value: 1, label: '普通字段' },
        { value: 2, label: '对象或数组' },
      ] },
      { key: 'origFieldCond', label: '主系统字段忽略条件', kind: 'textarea' },
      { key: 'destFieldCond', label: '备系统字段忽略条件', kind: 'textarea' },
      { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
    ],
  },
  'error-code-ignores': {
    title: '错误码忽略',
    filters: [
      { key: 'serviceCode', label: '服务码', kind: 'text' },
      { key: 'oldRespCode', label: '老核心错误码', kind: 'text' },
      { key: 'newRespCode', label: '新核心错误码', kind: 'text' },
      { key: 'reviewStatus', label: '审核状态', kind: 'review' },
    ],
    columns: [
      { key: 'domain', label: '领域' },
      { key: 'serviceCode', label: '服务码' },
      { key: 'oldRespCode', label: '老核心错误码' },
      { key: 'newRespCode', label: '新核心错误码' },
      { key: 'ignoreReason', label: '忽略原因', ellipsis: true },
      ...REVIEW_COLUMNS,
    ],
    confirmFields: [
      { key: 'serviceCode', label: '服务码' },
      { key: 'oldRespCode', label: '老核心错误码' },
      { key: 'newRespCode', label: '新核心错误码' },
    ],
    form: [
      { key: 'serviceCode', label: '服务码', kind: 'serviceCode', required: true },
      { key: 'oldRespCode', label: '老核心错误码', kind: 'text' },
      { key: 'newRespCode', label: '新核心错误码', kind: 'text' },
      { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
    ],
    validate: (draft) => {
      if (!draft.oldRespCode && !draft.newRespCode) {
        return '老核心错误码与新核心错误码不能同时为空'
      }
      return ''
    },
  },
  'sort-fields': {
    title: '排序字段',
    filters: [
      { key: 'origTrcd', label: '服务码', kind: 'text' },
      { key: 'origArryName', label: '对象/数组名称', kind: 'text' },
      { key: 'origFieldName', label: '排序字段', kind: 'text' },
      { key: 'reviewStatus', label: '审核状态', kind: 'review' },
    ],
    columns: [
      { key: 'domain', label: '领域' },
      { key: 'origTrcd', label: '服务码' },
      { key: 'origArryName', label: '对象/数组名称' },
      { key: 'origFieldName', label: '排序字段' },
      { key: 'fieldChineseName', label: '排序字段中文名称' },
      { key: 'ignoreReason', label: '排序原因', ellipsis: true },
      ...REVIEW_COLUMNS,
    ],
    confirmFields: [
      { key: 'origTrcd', label: '服务码' },
      { key: 'origArryName', label: '对象/数组名称' },
      { key: 'origFieldName', label: '排序字段' },
      { key: 'fieldChineseName', label: '排序字段中文名称' },
      { key: 'ignoreReason', label: '排序原因' },
    ],
    form: [
      { key: 'origTrcd', label: '服务码', kind: 'serviceCode', required: true },
      { key: 'origArryName', label: '对象/数组名称', kind: 'text', required: true },
      { key: 'origFieldName', label: '排序字段', kind: 'text', required: true },
      { key: 'fieldChineseName', label: '排序字段中文名称', kind: 'text', required: true, maxlength: 256 },
      { key: 'ignoreReason', label: '排序原因', kind: 'textarea', required: true, maxlength: 512 },
    ],
  },
  'message-sequence-ignores': {
    title: '流水号忽略',
    filters: [
      { key: 'category', label: TRANSACTION_CATEGORY_LABEL, kind: 'category' },
      { key: 'serviceCode', label: '服务码', kind: 'text' },
      { key: 'messageSequence', label: '流水号', kind: 'text' },
      { key: 'reviewStatus', label: '审核状态', kind: 'review' },
    ],
    columns: [
      { key: 'category', label: TRANSACTION_CATEGORY_LABEL, display: 'category' },
      { key: 'serviceCode', label: '服务码' },
      { key: 'messageSequence', label: '流水号', long: true },
      { key: 'ignoreReason', label: '忽略原因', ellipsis: true },
      ...REVIEW_COLUMNS,
      { key: 'createdAt', label: '新增时间', display: 'time' },
      { key: 'updatedAt', label: '更新时间', display: 'time' },
    ],
    confirmFields: [
      { key: 'category', label: TRANSACTION_CATEGORY_LABEL },
      { key: 'serviceCode', label: '服务码' },
      { key: 'messageSequence', label: '流水号' },
    ],
    form: [
      { key: 'serviceCode', label: '服务码', kind: 'serviceCode', required: true },
      { key: 'category', label: TRANSACTION_CATEGORY_LABEL, kind: 'select', required: true, options: [
        { value: 'QUERY', label: '查询' },
        { value: 'ACCOUNTING', label: '账务' },
      ] },
      { key: 'messageSequence', label: '流水号', kind: 'textarea', required: true },
      { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
    ],
  },
  'one-side-error-code-ignores': {
    title: '单边失败错误码忽略',
    filters: [
      { key: 'category', label: TRANSACTION_CATEGORY_LABEL, kind: 'category' },
      { key: 'serviceCode', label: '服务码', kind: 'text' },
      { key: 'ownership', label: '归属', kind: 'ownership' },
      { key: 'errorCode', label: '忽略错误码', kind: 'text' },
      { key: 'reviewStatus', label: '审核状态', kind: 'review' },
    ],
    columns: [
      { key: 'category', label: TRANSACTION_CATEGORY_LABEL, display: 'category' },
      { key: 'serviceCode', label: '服务码' },
      { key: 'ownership', label: '归属' },
      { key: 'errorCode', label: '忽略错误码', long: true },
      { key: 'ignoreReason', label: '忽略原因', ellipsis: true },
      ...REVIEW_COLUMNS,
      { key: 'createdAt', label: '新增时间', display: 'time' },
      { key: 'updatedAt', label: '更新时间', display: 'time' },
    ],
    confirmFields: [
      { key: 'category', label: TRANSACTION_CATEGORY_LABEL },
      { key: 'serviceCode', label: '服务码' },
      { key: 'ownership', label: '归属' },
      { key: 'errorCode', label: '忽略错误码' },
    ],
    form: [
      { key: 'serviceCode', label: '服务码', kind: 'serviceCode', required: true },
      { key: 'category', label: TRANSACTION_CATEGORY_LABEL, kind: 'select', required: true, options: [
        { value: 'QUERY', label: '查询' },
        { value: 'ACCOUNTING', label: '账务' },
      ] },
      { key: 'ownership', label: '归属', kind: 'ownership', required: true, options: [
        { value: '528', label: '528' },
        { value: 'ccbs', label: 'ccbs' },
      ] },
      { key: 'errorCode', label: '忽略错误码', kind: 'text', required: true },
      { key: 'ignoreReason', label: '忽略原因', kind: 'textarea', required: true, maxlength: 512 },
    ],
  },
}

const activeTab = ref(TABS[0].key)
const schema = computed(() => SCHEMAS[activeTab.value])
const isSortTab = computed(() => activeTab.value === 'sort-fields')
const isMessageSequenceTab = computed(() => activeTab.value === 'message-sequence-ignores')
const isOneSideTab = computed(() => activeTab.value === 'one-side-error-code-ignores')
const isServiceSequenceTab = computed(() => isMessageSequenceTab.value || isOneSideTab.value)
const isUnconditionalTab = computed(() => activeTab.value === 'unconditional-ignores')
const reasonEmptyLabel = computed(() => (isSortTab.value ? '仅看排序原因为空' : '仅看忽略原因为空'))

const items = ref([])
const total = ref(0)
const page = ref(0)
const pageSize = ref(10)
const loading = ref(false)
const reviewableByMe = ref(false)
const developedByMe = ref(false)
const reasonEmpty = ref(false)
const fieldChineseNameEmpty = ref(false)
const filters = reactive({})
const selectedIds = ref([])
const reviewerMappingWarningCodes = ref([])
const reviewerHelp = reactive({ visible: false, style: {} })
const domainOptions = ref([])
const developerFilterOptions = ref([])
const exporting = ref(false)
const headerFilterKey = ref('')
const headerFilterDraft = ref('')
const headerFilterSearch = ref('')
const headerFilterPanelStyle = reactive({ left: '8px', top: '8px' })
const headerFilterPanel = ref(null)
const expandedConditions = reactive(new Set())
const copiedCondition = ref('')
let requestSequence = 0
const REASON_IMPORT_COLUMNS = {
  'unconditional-ignores': ['服务码', '忽略字段', '忽略原因'],
  'conditional-ignores': ['服务码', '忽略字段', '字段索引', '忽略原因'],
  'sort-fields': ['服务码', '对象/数组名称', '排序字段', '排序原因'],
  'error-code-ignores': ['服务码', '老核心错误码', '新核心错误码', '忽略原因'],
}
const reasonImportColumns = computed(() => REASON_IMPORT_COLUMNS[activeTab.value])
const reasonImportTab = ref('')
const CHINESE_NAME_COLUMNS = {
  'unconditional-ignores': '忽略字段中文名称',
  'conditional-ignores': '忽略字段中文名称',
  'sort-fields': '排序字段中文名称',
}
const importingChineseNames = ref(false)
const importTitle = computed(() => importingChineseNames.value ? '字段中文名称为空数据导入' : '忽略原因为空数据导入')
const importColumns = computed(() => {
  const columns = REASON_IMPORT_COLUMNS[reasonImportTab.value] ?? []
  return importingChineseNames.value ? [...columns.slice(0, -1), CHINESE_NAME_COLUMNS[reasonImportTab.value]] : columns
})
const reasonImportFile = ref(null)
const reasonImportError = ref('')
const importingReasons = ref(false)

const editOpen = ref(false)
const editingRow = ref(null)
const saving = ref(false)
const formError = ref('')
const draft = reactive({})
const createRows = ref([])

const historyOpen = ref(false)
const historyItems = ref([])
const historyLoading = ref(false)

const confirmOpen = ref(false)
const confirmText = ref('')
const confirmDetails = ref([])
const confirming = ref(false)
const confirmDanger = ref(false)
let confirmHandler = null

const toast = reactive({ visible: false, kind: 'success', text: '' })
let toastTimer = null

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const allSelected = computed(() => items.value.length > 0 && items.value.every((row) => selectedIds.value.includes(row.id)))
const editTitle = computed(() => `${editingRow.value ? '修改' : '新增'}${schema.value.title}`)
const activeHeaderFilter = computed(() => headerFilterFor(
  schema.value.columns.find(column => column.key === headerFilterKey.value),
))
const headerFilterLabel = computed(() => activeHeaderFilter.value?.label || '')
const headerFilterOptions = computed(() => {
  const choices = activeHeaderFilter.value?.kind === 'person'
    ? developerFilterOptions.value
    : activeHeaderFilter.value?.kind === 'domain'
      ? [...domainOptions.value.map(value => ({ value, label: value })), { value: EMPTY_FILTER, label: '为空' }]
      : (HEADER_FILTER_CHOICES[activeHeaderFilter.value?.kind] || []).map(([value, label]) => ({ value, label }))
  const keyword = headerFilterSearch.value.toLocaleLowerCase()
  const all = activeHeaderFilter.value?.kind === 'person'
    ? choices
    : [{ value: '', label: '全部' }, ...choices]
  return all.filter(option => option.label.toLocaleLowerCase().includes(keyword))
})
const isSortCreate = computed(() => isSortTab.value && !editingRow.value)
const isMessageSequenceCreate = computed(() => isMessageSequenceTab.value && !editingRow.value)
const isOneSideCreate = computed(() => isOneSideTab.value && !editingRow.value)
const isMultiCreate = computed(() => !isSortTab.value && !isServiceSequenceTab.value && !editingRow.value)
const activeForm = computed(() => {
  if (isSortCreate.value) return SORT_CREATE_FORM
  if (isMessageSequenceCreate.value) return MESSAGE_SEQUENCE_CREATE_FORM
  if (isOneSideCreate.value) return ONE_SIDE_ERROR_CODE_CREATE_FORM
  return schema.value.form
})
const formRows = computed(() => (isMultiCreate.value ? createRows.value : [draft]))
const createHint = computed(() => {
  if (isSortCreate.value) {
    return '按 A 对象的单个属性 B 排序时填写 A.B；按 A 对象的多个属性 B、C 排序时填写 A(B,C)。保存后按映射生成 3 条：&sop 使用老核心排序字段，&soap 与 &bzjson 使用新核心排序字段。'
  }
  if (isMessageSequenceCreate.value) {
    return '多个流水号请使用英文逗号分隔，去除首尾空格后逐条保存；任一项为空或重复时整批不写入。'
  }
  if (isOneSideCreate.value) {
    return '多个错误码请使用英文逗号分隔，去除首尾空格后逐条保存；任一项为空或重复时整批不写入。'
  }
  if (isMultiCreate.value) {
    return '最多可一次新增 3 条，每条独立填写，可只填其中部分；任一条重复则整批不写入。'
  }
  return ''
})

function fieldTestId(field, index) {
  return isMultiCreate.value ? `form-${index}-${field.key}` : `form-${field.key}`
}

function showToast(text, kind = 'success') {
  toast.text = text
  toast.kind = kind
  toast.visible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.visible = false }, kind === 'error' ? 5000 : 3000)
}

function displayValue(column, row) {
  const value = row[column.key]
  if (typeof value === 'string' && !value.trim()) return '-'
  if (column.display === 'flag') {
    if (value === 1) return '普通字段'
    if (value === 2) return '对象或数组'
  }
  if (column.display === 'review') {
    if (value === 1) return '已审核'
    if (value === 0) return '未审核'
  }
  if (column.display === 'category') {
    if (value === 'QUERY') return '查询'
    if (value === 'ACCOUNTING') return '账务'
  }
  if (column.display === 'time') return formatTime(value)
  return value === null || value === undefined || value === '' ? '-' : value
}

function headerFilterFor(column) {
  if (!column) return undefined
  if (!isServiceSequenceTab.value) {
    if (column.key === 'oldTransactionCode') {
      return { ...column, kind: 'text', placeholder: '精确匹配' }
    }
    if (column.key === 'domain') {
      return { ...column, kind: 'domain' }
    }
    if (column.key === 'developer') {
      return { ...column, kind: 'person' }
    }
  }
  return schema.value.filters.find(filter => filter.key === column.key)
}

function isHeaderFilterActive(key) {
  return Boolean(filters[key])
}

async function openHeaderFilter(column, event) {
  const anchor = event.currentTarget
  if (headerFilterKey.value === column.key) {
    closeHeaderFilter()
    return
  }
  headerFilterKey.value = column.key
  headerFilterDraft.value = filters[column.key] || ''
  headerFilterSearch.value = ''
  developerFilterOptions.value = []
  if (headerFilterFor(column)?.kind === 'person') {
    try {
      const developers = (await listReplayConfigDevelopers()) || []
      developerFilterOptions.value = [
        ...developers.map(value => ({ value, label: value })),
        { value: EMPTY_FILTER, label: '为空' },
      ]
    } catch (cause) {
      showToast(`加载开发人员失败：${cause?.message || cause}`, 'error')
    }
  }
  await nextTick()
  if (!headerFilterPanel.value || headerFilterKey.value !== column.key) return
  const rect = anchor.getBoundingClientRect()
  const { width, height } = headerFilterPanel.value.getBoundingClientRect()
  const margin = 8
  const gap = 6
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))
  const top = rect.bottom + gap + height <= window.innerHeight - margin
    ? rect.bottom + gap
    : Math.max(margin, rect.top - height - gap)
  headerFilterPanelStyle.left = `${Math.round(left)}px`
  headerFilterPanelStyle.top = `${Math.round(top)}px`
  headerFilterPanel.value.querySelector('input[type="search"], input:checked')?.focus()
}

function closeHeaderFilter() {
  headerFilterKey.value = ''
}

function dismissHeaderFilter(event) {
  if (headerFilterPanel.value && !headerFilterPanel.value.contains(event.target)
      && !event.target.closest('.replay-header-filter-button')) closeHeaderFilter()
}

function applyHeaderFilter(value) {
  const key = headerFilterKey.value
  if (!key) return
  const selectedValue = typeof value === 'string' ? value : headerFilterDraft.value
  filters[key] = selectedValue
  page.value = 0
  closeHeaderFilter()
  return load()
}

function clearHeaderFilter() {
  return applyHeaderFilter('')
}

function conditionKey(row, column) {
  return `${row.id}-${column.key}`
}

function toggleCondition(row, column) {
  const key = conditionKey(row, column)
  if (!expandedConditions.delete(key)) expandedConditions.add(key)
  if (copiedCondition.value === key) copiedCondition.value = ''
}

async function copyCondition(row, column) {
  if (await copyText(row[column.key])) copiedCondition.value = conditionKey(row, column)
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}

function operationLabel({ operationType: type, operationSource }) {
  if (type === 'UPDATE' && operationSource === 'EXCEL') return '导入'
  return { CREATE: '新增', UPDATE: '修改', DELETE: '删除', REVIEW: '审核' }[type] || type
}

function formatChangeValue(change, value) {
  if (value === null || value === undefined || value === '') return '-'
  if (change.field === 'review_status') {
    if (String(value) === '1') return '已审核'
    if (String(value) === '0') return '未审核'
  }
  return value
}

function changeLabel(change) {
  if (isSortTab.value && change.field === 'ignore_reason') return '排序原因'
  if (isServiceSequenceTab.value && change.field === 'category') return TRANSACTION_CATEGORY_LABEL
  return change.label
}

function resetFilters() {
  closeHeaderFilter()
  for (const key of Object.keys(filters)) delete filters[key]
  for (const filter of schema.value.filters) {
    filters[filter.key] = ''
  }
  filters.domain = ''
  filters.developer = ''
  filters.oldTransactionCode = ''
  reviewableByMe.value = false
  developedByMe.value = false
  reasonEmpty.value = false
  fieldChineseNameEmpty.value = false
}

function requestParams() {
  const params = {
    limit: pageSize.value,
    offset: page.value * pageSize.value,
  }
  if (filters.oldTransactionCode) params.internalTransactionCode = filters.oldTransactionCode
  if (filters.domain === EMPTY_FILTER) params.domainEmpty = 'true'
  else if (filters.domain) params.domain = filters.domain
  if (filters.developer === EMPTY_FILTER) params.developerEmpty = 'true'
  else if (filters.developer) params.developer = filters.developer
  if (reviewableByMe.value) params.reviewableByMe = 'true'
  if (developedByMe.value) params.developedByMe = 'true'
  if (reasonEmpty.value) params.reasonEmpty = 'true'
  if (CHINESE_NAME_COLUMNS[activeTab.value] && fieldChineseNameEmpty.value) params.fieldChineseNameEmpty = 'true'
  for (const filter of schema.value.filters) {
    const value = filters[filter.key]
    if (value !== undefined && value !== null && value !== '') params[filter.key] = value
  }
  return params
}

async function load() {
  const sequence = ++requestSequence
  loading.value = true
  try {
    const result = await listReplayConfigs(activeTab.value, requestParams())
    if (sequence !== requestSequence) return
    items.value = result?.items || []
    total.value = result?.total || 0
    selectedIds.value = []
    expandedConditions.clear()
    copiedCondition.value = ''
  } catch (cause) {
    if (sequence !== requestSequence) return
    items.value = []
    total.value = 0
    showToast(`加载失败：${cause?.message || cause}`, 'error')
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

async function loadDomains() {
  try {
    domainOptions.value = (await listReplayConfigDomains()) || []
  } catch {
    domainOptions.value = []
  }
}

function switchTab(key) {
  if (activeTab.value === key) return
  activeTab.value = key
  page.value = 0
  selectedIds.value = []
  resetFilters()
  return load()
}

function search() {
  page.value = 0
  return load()
}

function reset() {
  resetFilters()
  page.value = 0
  return load()
}

function goPrevious() {
  if (page.value === 0 || loading.value) return
  page.value -= 1
  return load()
}

function goNext() {
  if (page.value + 1 >= pageCount.value || loading.value) return
  page.value += 1
  return load()
}

function changePageSize() {
  page.value = 0
  return load()
}

function openReasonImport(chineseNames = false) {
  importingChineseNames.value = chineseNames === true
  reasonImportFile.value = null
  reasonImportError.value = ''
  reasonImportTab.value = activeTab.value
}

function closeReasonImport() {
  if (!importingReasons.value) reasonImportTab.value = ''
}

async function submitReasonImport() {
  const type = reasonImportTab.value
  const file = reasonImportFile.value
  if (!type || !file || importingReasons.value) return
  reasonImportError.value = ''
  if (!/\.xlsx?$/i.test(file.name)) {
    reasonImportError.value = '请选择 .xlsx 或 .xls 文件'
    return
  }
  importingReasons.value = true
  try {
    const names = importingChineseNames.value
    const result = await (names ? importReplayConfigChineseNames(type, file) : importReplayConfigReasons(type, file))
    reasonImportTab.value = ''
    const existing = names ? `已有中文名称 ${result.skippedExistingNameRows}` : `已有原因 ${result.skippedExistingReasonRows}`
    showToast(`补充 ${result.updatedRows} 条，${existing} 条，未匹配 ${result.unmatchedRows} 条，匹配到多条 ${result.ambiguousRows ?? 0} 条`)
    if (activeTab.value === type) await load()
  } catch (cause) {
    reasonImportError.value = `导入失败：${cause?.message || cause}`
  } finally {
    importingReasons.value = false
  }
}

async function exportConfigs() {
  if (exporting.value) return
  exporting.value = true
  try {
    if (isMessageSequenceTab.value) await exportReviewedMessageSequenceIgnores()
    else if (isOneSideTab.value) await exportReviewedOneSideErrorCodeIgnores()
    else await exportReviewedReplayConfigs()
    showToast('导出成功')
  } catch (cause) {
    showToast(`导出失败：${cause?.message || cause}`, 'error')
  } finally {
    exporting.value = false
  }
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : items.value.map((row) => row.id)
}

function resetDraft() {
  for (const key of Object.keys(draft)) delete draft[key]
  for (const field of activeForm.value) {
    draft[field.key] = field.kind === 'select' ? field.options[0].value : ''
  }
}

function resetCreateRows() {
  createRows.value = [0, 1, 2].map(() => {
    const row = {}
    for (const field of schema.value.form) {
      row[field.key] = field.kind === 'select' ? field.options[0].value : ''
    }
    return row
  })
}

function openCreate() {
  editingRow.value = null
  formError.value = ''
  if (isSortTab.value || isServiceSequenceTab.value) {
    resetDraft()
  } else {
    resetCreateRows()
  }
  editOpen.value = true
}

function openEdit(row) {
  editingRow.value = row
  formError.value = ''
  resetDraft()
  for (const field of schema.value.form) {
    draft[field.key] = row[field.key] ?? (field.kind === 'select' ? field.options[0].value : '')
  }
  editOpen.value = true
}

function closeEdit() {
  if (saving.value) return
  editOpen.value = false
}

function isValidSortField(value) {
  const text = String(value ?? '').trim()
  if (/^[^(]+\([^)]+\)$/.test(text)) return true
  const dot = text.indexOf('.')
  return dot > 0 && dot < text.length - 1
}

function validateFields(row, form) {
  for (const field of form) {
    const value = row[field.key]
    if (field.required && (value === undefined || value === null || String(value).trim() === '')) {
      return `${field.label}不能为空`
    }
    if (field.kind === 'serviceCode' && !SERVICE_CODE_PATTERN.test(String(value).trim())) {
      return `${field.label}格式不正确，应为 <服务码>&sop|&soap|&bzjson`
    }
  }
  return ''
}

function serviceCodeOf(row) {
  return String(row?.tranCode || row?.origTrcd || row?.serviceCode || '').trim()
}

function showReviewerHelp(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  const width = Math.min(300, window.innerWidth - 24)
  const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12)
  reviewerHelp.style = {
    top: `${rect.bottom + 8}px`,
    left: `${left}px`,
    width: `${width}px`,
  }
  reviewerHelp.visible = true
}

function hideReviewerHelp() {
  reviewerHelp.visible = false
}

function unmappedReviewerServiceCodes(created) {
  const rows = Array.isArray(created) ? created : created ? [created] : []
  return [...new Set(rows
    .filter((row) => row?.reviewDisabledReason === '无审核人')
    .map(serviceCodeOf)
    .filter(Boolean))]
}

function showReviewerMappingWarning(created) {
  reviewerMappingWarningCodes.value = unmappedReviewerServiceCodes(created)
}

function closeReviewerMappingWarning() {
  reviewerMappingWarningCodes.value = []
}

function reviewerMissingMessage(row) {
  const serviceCode = serviceCodeOf(row)
  return `未找到审核负责人。服务码 ${serviceCode} 尚未映射到全量交易人员，请联系敬恒杰维护清单。`
}

function reviewButtonTitle(row) {
  if (row?.reviewDisabledReason === '无审核人') return reviewerMissingMessage(row)
  return row?.reviewDisabledReason || '审核通过'
}

function validateDraft() {
  const base = validateFields(draft, activeForm.value)
  if (base) return base
  if (isSortCreate.value) {
    if (!isValidSortField(draft.oldSortField)) return '老核心排序字段格式不正确：单个属性请填写 A.B，多个属性请填写 A(B,C)'
    if (!isValidSortField(draft.newSortField)) return '新核心排序字段格式不正确：单个属性请填写 A.B，多个属性请填写 A(B,C)'
    return ''
  }
  if (isMessageSequenceCreate.value || isOneSideCreate.value) {
    const source = isOneSideCreate.value ? draft.errorCodes : draft.messageSequences
    const label = isOneSideCreate.value ? '忽略错误码' : '流水号'
    const parts = String(source || '').split(',').map(item => item.trim())
    if (parts.some(item => !item)) return `${label}不能为空，多个${label}请使用英文逗号分隔`
    if (parts.length > 100) return `单次最多新增 100 个${label}`
    if (new Set(parts).size !== parts.length) return `${label}不能重复`
  }
  if (isServiceSequenceTab.value && editingRow.value) {
    const value = isOneSideTab.value ? draft.errorCode : draft.messageSequence
    if (String(value || '').includes(',')) return `修改时只能填写一个${isOneSideTab.value ? '忽略错误码' : '流水号'}`
  }
  return schema.value.validate ? schema.value.validate(draft) : ''
}

function toPayload(row, form) {
  const payload = {}
  for (const field of form) {
    const value = row[field.key]
    payload[field.key] = field.kind !== 'textarea' && typeof value === 'string' ? value.trim() : value
  }
  return payload
}

async function submitBatchCreate() {
  const serviceKey = (schema.value.form.find((field) => field.kind === 'serviceCode') || {}).key
  const items = []
  for (let index = 0; index < createRows.value.length; index += 1) {
    const row = createRows.value[index]
    const serviceCode = serviceKey ? String(row[serviceKey] ?? '').trim() : ''
    if (!serviceCode) {
      const hasOther = schema.value.form.some((field) => field.key !== serviceKey
        && field.kind !== 'select'
        && String(row[field.key] ?? '').trim() !== '')
      if (hasOther) {
        formError.value = `第 ${index + 1} 条：请先填写服务码`
        return
      }
      continue
    }
    const extra = validateFields(row, schema.value.form)
      || (schema.value.validate ? schema.value.validate(row) : '')
    if (extra) {
      formError.value = `第 ${index + 1} 条：${extra}`
      return
    }
    items.push(toPayload(row, schema.value.form))
  }
  if (!items.length) {
    formError.value = '请至少填写一条'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    const created = await batchCreateReplayConfigs(activeTab.value, items)
    showToast(`新增成功（${created?.length ?? items.length} 条）`)
    editOpen.value = false
    showReviewerMappingWarning(created)
    await load()
  } catch (cause) {
    formError.value = cause?.message || '新增失败'
    showToast(cause?.message || '新增失败', 'error')
  } finally {
    saving.value = false
  }
}

async function submitForm() {
  if (saving.value) return
  if (isMultiCreate.value) {
    return submitBatchCreate()
  }
  const validation = validateDraft()
  if (validation) {
    formError.value = validation
    return
  }
  saving.value = true
  formError.value = ''
  try {
    const payload = {}
    for (const field of activeForm.value) {
      const value = draft[field.key]
      payload[field.key] = field.kind !== 'textarea' && typeof value === 'string' ? value.trim() : value
    }
    if (editingRow.value) {
      if (isMessageSequenceTab.value) await updateMessageSequenceIgnore(editingRow.value.id, payload)
      else if (isOneSideTab.value) await updateOneSideErrorCodeIgnore(editingRow.value.id, payload)
      else {
        payload.version = editingRow.value.version
        await updateReplayConfig(activeTab.value, editingRow.value.id, payload)
      }
      showToast('修改成功')
    } else {
      const created = isMessageSequenceTab.value
        ? await createMessageSequenceIgnores(payload)
        : isOneSideTab.value
          ? await createOneSideErrorCodeIgnores(payload)
          : await createReplayConfig(activeTab.value, payload)
      showToast(Array.isArray(created) ? `新增成功（${created.length} 条）` : '新增成功')
      showReviewerMappingWarning(created)
    }
    editOpen.value = false
    await load()
  } catch (cause) {
    formError.value = cause?.message || '保存失败'
    showToast(cause?.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

function openConfirm(text, details, handler, danger = false) {
  confirmText.value = text
  confirmDetails.value = details || []
  confirmHandler = handler
  confirmDanger.value = danger === true
  confirmOpen.value = true
}

function resetConfirm() {
  confirmOpen.value = false
  confirmDetails.value = []
  confirmDanger.value = false
  confirmHandler = null
}

function closeConfirm() {
  if (confirming.value) return
  resetConfirm()
}

async function confirmAction() {
  if (!confirmHandler || confirming.value) return
  const handler = confirmHandler
  confirming.value = true
  try {
    await handler()
  } finally {
    confirming.value = false
    resetConfirm()
  }
}

function rowConfirmDetails(row) {
  return (schema.value.confirmFields || []).map((field) => ({
    label: field.label,
    value: row[field.key] === null || row[field.key] === undefined || row[field.key] === '' ? '-' : row[field.key],
  }))
}

function reviewRow(row) {
  if (!row.canReview) return
  openConfirm('确认审核通过该条配置？', rowConfirmDetails(row), async () => {
    try {
      if (isMessageSequenceTab.value) await reviewMessageSequenceIgnore(row.id)
      else if (isOneSideTab.value) await reviewOneSideErrorCodeIgnore(row.id)
      else await reviewReplayConfig(activeTab.value, row.id, row.version)
      showToast('审核通过')
      await load()
    } catch (cause) {
      showToast(`审核失败：${cause?.message || cause}`, 'error')
    }
  })
}

function removeRow(row) {
  openConfirm(`确认删除该条${schema.value.title}配置？此操作不可恢复。`, rowConfirmDetails(row), async () => {
    try {
      if (isMessageSequenceTab.value) await deleteMessageSequenceIgnore(row.id)
      else if (isOneSideTab.value) await deleteOneSideErrorCodeIgnore(row.id)
      else await deleteReplayConfig(activeTab.value, row.id, row.version)
      showToast('删除成功')
      await load()
    } catch (cause) {
      showToast(`删除失败：${cause?.message || cause}`, 'error')
    }
  }, true)
}

function batchReview() {
  if (!selectedIds.value.length) return
  const byId = new Map(items.value.map((row) => [row.id, row]))
  const selectedRows = selectedIds.value.map((id) => byId.get(id)).filter(Boolean)
  const reviewableCount = selectedRows.filter((row) => row.canReview).length
  const details = [
    { label: '已选', value: `${selectedRows.length} 条` },
    { label: '可审核', value: `${reviewableCount} 条` },
    { label: '将跳过', value: `${selectedRows.length - reviewableCount} 条` },
  ]
  openConfirm('确认批量审核选中的配置？', details, async () => {
    if (!selectedRows.length) return
    const payload = isServiceSequenceTab.value
      ? selectedRows.map((row) => row.id)
      : selectedRows.map((row) => ({ id: row.id, version: row.version }))
    try {
      const result = isMessageSequenceTab.value
        ? await batchReviewMessageSequenceIgnores(payload)
        : isOneSideTab.value
          ? await batchReviewOneSideErrorCodeIgnores(payload)
          : await batchReviewReplayConfigs(activeTab.value, payload)
      showToast(`审核通过 ${result?.approvedCount ?? 0} 条，跳过 ${result?.skippedCount ?? 0} 条`)
      await load()
    } catch (cause) {
      showToast(`批量审核失败：${cause?.message || cause}`, 'error')
    }
  })
}

function batchDelete() {
  if (!selectedIds.value.length) return
  const byId = new Map(items.value.map((row) => [row.id, row]))
  const selectedRows = selectedIds.value.map((id) => byId.get(id)).filter(Boolean)
  const payload = isServiceSequenceTab.value
    ? selectedRows.map((row) => row.id)
    : selectedRows.map((row) => ({ id: row.id, version: row.version }))
  const details = [{ label: '已选', value: `${selectedRows.length} 条` }]
  openConfirm(`确认删除已勾选的 ${selectedIds.value.length} 条记录？此操作不可恢复。`, details, async () => {
    if (!payload.length) return
    try {
      const result = isMessageSequenceTab.value
        ? await batchDeleteMessageSequenceIgnores(payload)
        : isOneSideTab.value
          ? await batchDeleteOneSideErrorCodeIgnores(payload)
          : await batchDeleteReplayConfigs(activeTab.value, payload)
      showToast(`删除成功：${result?.deletedCount ?? payload.length} 条`)
      await load()
    } catch (cause) {
      showToast(`批量删除失败：${cause?.message || cause}`, 'error')
    }
  }, true)
}

async function openHistory(row) {
  historyOpen.value = true
  historyItems.value = []
  historyLoading.value = true
  try {
    const result = await listReplayConfigOperations(activeTab.value, row.id, { limit: 100, offset: 0 })
    historyItems.value = result?.items || []
  } catch (cause) {
    showToast(`加载历史失败：${cause?.message || cause}`, 'error')
  } finally {
    historyLoading.value = false
  }
}

function closeHistory() {
  historyOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', dismissHeaderFilter)
  resetFilters()
  loadDomains()
  return load()
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', dismissHeaderFilter)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<style scoped>
.replay-page{height:100%;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:var(--bg-primary,#f5f7fa);color:var(--text-primary,#1f2937)}
.replay-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px;padding:12px 20px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border,#e5e7eb)}
.replay-toolbar h2{margin:0;font-size:16px}.replay-toolbar-title p{margin:3px 0 0;color:var(--text-muted,#6b7280);font-size:12px}
.replay-toolbar-actions,.replay-page-actions,.replay-form-actions{display:flex;gap:8px;align-items:center}
.replay-button,.replay-icon-button{min-height:34px;padding:0 12px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit;cursor:pointer;font-size:13px}
.replay-button:disabled{opacity:.55;cursor:not-allowed}
.replay-button-primary{background:#0b70db;border-color:#0b70db;color:#fff}
.replay-button-danger{background:#d92d20;border-color:#d92d20;color:#fff}
.replay-button-danger:disabled{background:#fda29b;border-color:#fda29b;color:#fff;opacity:1}
.replay-button-compact{min-height:28px;padding:0 8px;font-size:12px}
.replay-tabs{display:flex;gap:4px;padding:0 20px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border,#e5e7eb)}
.replay-tab{min-height:40px;padding:0 14px;border:none;border-bottom:2px solid transparent;background:transparent;color:var(--text-muted,#6b7280);cursor:pointer;font-size:13px}
.replay-tab.active{border-bottom-color:#0b70db;color:#0b70db;font-weight:600}
.replay-filters{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 20px;background:var(--bg-card,#fff);border-bottom:1px solid var(--border,#e5e7eb)}
.replay-filter-group{display:flex;align-items:center;gap:8px}
.replay-filter-group-label{font-size:13px;font-weight:600;color:var(--text-primary,#1f2937);white-space:nowrap}
.replay-filter-actions{display:flex;align-items:center;gap:8px;margin-left:auto}
.replay-control{height:34px;min-width:120px;padding:0 10px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit;font-size:13px;box-sizing:border-box}
.replay-checkbox{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-primary,#1f2937);white-space:nowrap}
.replay-checkbox input{width:15px;height:15px;accent-color:#0b70db}
.replay-field{display:grid;gap:5px;font-size:12px;min-width:150px}
.replay-field em{color:#d92d20;font-style:normal}
.replay-field input,.replay-field select,.replay-field textarea{height:34px;padding:0 10px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit;font-size:13px;box-sizing:border-box}
.replay-field textarea{height:auto;padding:8px 10px;resize:vertical;font-family:inherit}
.replay-hint{margin:0;color:var(--text-muted,#6b7280);font-size:12px}
.replay-create-row-title{margin:0;padding-top:8px;border-top:1px dashed var(--border,#e5e7eb);font-size:13px;font-weight:600;color:var(--text-primary,#1f2937)}
.replay-create-row-title:first-child{padding-top:0;border-top:none}
.replay-message{margin:0;padding:8px 12px;border-radius:6px;background:#eef7ee;color:#24713d;font-size:13px}
.replay-error{background:#fff1f0;color:#b42318}
.replay-table-viewport{flex:1 1 auto;min-height:0;overflow:auto;padding:12px 20px}
.replay-table{width:100%;border-collapse:collapse;background:var(--bg-card,#fff);table-layout:fixed}
.replay-table th,.replay-table td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--border,#e5e7eb);font-size:13px;word-break:break-all;vertical-align:top}
.replay-table thead th{position:sticky;top:0;z-index:2;background:#0d6672;color:#fff}
.replay-header-filter-button{display:inline-grid;place-items:center;width:18px;height:18px;margin-left:3px;padding:0;border:0;background:transparent;cursor:pointer;vertical-align:middle}
.replay-header-filter-button i{display:block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #e9fff9;filter:drop-shadow(0 0 1px rgba(0,0,0,.7))}
.replay-header-filter-button:hover i,.replay-header-filter-button:focus-visible i{border-top-color:#fff}
.replay-header-filter-button.active i{border-top-color:#ffd166}
.replay-header-filter-button:focus-visible{outline:1px solid #fff;outline-offset:1px}
.replay-header-filter-panel{position:fixed;z-index:1500;box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:6px;width:250px;padding:8px;overflow:hidden;border:1px solid #8e8e8e;border-radius:3px;color:#222;background:#454545;box-shadow:0 8px 22px rgba(0,0,0,.32)}
.replay-header-filter-panel.is-developer-filter{width:220px}
.replay-header-filter-panel>header,.replay-header-filter-panel>footer{display:flex;align-items:center;justify-content:space-between;gap:8px}
.replay-header-filter-panel>header{padding:0 2px;color:#fff}.replay-header-filter-panel>header strong{font-size:13px}
.replay-header-filter-content{min-height:0;display:grid;gap:5px;padding:7px;border-radius:4px;background:#454545}
.replay-header-filter-content>input{height:28px;padding:0 8px;border:1px solid #777;border-radius:3px;color:#eee;background:#555;font:inherit}
.replay-header-filter-options{min-height:0;max-height:240px;overflow:auto;display:grid;align-content:start;gap:1px;padding:3px;border-radius:3px;background:#555}
.replay-header-filter-options label{display:flex;align-items:center;gap:6px;min-height:23px;padding:3px 4px;border-radius:3px;color:#eee;font-size:12px;cursor:pointer}
.replay-header-filter-options label span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.replay-header-filter-options label:hover{background:#666}.replay-header-filter-options input{accent-color:#42d1a5}
.replay-header-filter-panel>footer{padding-top:5px;border-top:1px solid #666}.replay-header-filter-footer-spacer{flex:1}
.replay-header-filter-clear{color:#ffcf8a!important}.replay-header-filter-panel .replay-button{min-height:25px;border-color:#777;color:#eee;background:#555}.replay-header-filter-panel .replay-button-primary{border-color:#42b883;color:#fff;background:#42b883}
.replay-condition{max-height:42px;overflow:hidden;white-space:pre-wrap;word-break:break-word}.replay-condition.is-expanded{max-height:none}.replay-condition-actions{display:flex;gap:6px;margin-top:5px}.replay-condition-actions button{padding:2px 6px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);font-size:11px}
.replay-table thead th.replay-column-with-help{z-index:3;width:116px}
.replay-column-heading{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;word-break:normal}
.replay-column-help{position:relative;display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:0;background:transparent;color:inherit;cursor:help}
.replay-column-help:focus-visible{outline:2px solid #fff;outline-offset:2px;border-radius:3px}
.replay-column-tooltip{position:fixed;z-index:1200;padding:8px 10px;border:1px solid var(--border,#e5e7eb);border-radius:6px;background:var(--bg-card,#fff);box-shadow:0 6px 18px rgba(0,0,0,.18);color:var(--text-main,#1f2937);font-size:12px;font-weight:400;line-height:1.5;text-align:left;white-space:normal;word-break:normal;pointer-events:none}
.replay-select-column{width:44px}
.replay-operation-column{width:262px;white-space:nowrap}
.replay-operation-buttons{display:flex;gap:5px}
.replay-cell-long{max-width:320px;white-space:pre-wrap;overflow-wrap:anywhere}
.replay-cell-ellipsis{width:240px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.replay-state{text-align:center;color:var(--text-muted,#6b7280);padding:28px 0}
.replay-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 20px;background:var(--bg-card,#fff);border-top:1px solid var(--border,#e5e7eb)}
.replay-page-size{display:flex;align-items:center;gap:6px;font-size:12px}
.replay-page-size select{height:32px;border:1px solid var(--border,#d1d5db);background:var(--bg-card,#fff);color:inherit}
.replay-modal-mask,.replay-drawer-mask{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.38)}
.replay-modal-mask{display:grid;place-items:center}
.replay-edit-modal{width:min(680px,calc(100vw - 32px));max-height:86vh;overflow:auto;display:grid;gap:16px;padding:20px;background:var(--bg-card,#fff);border-radius:8px}
.replay-edit-modal header,.replay-history-drawer header{display:flex;align-items:center;justify-content:space-between}
.replay-edit-modal h3,.replay-history-drawer h3{margin:0;font-size:15px}
.replay-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.replay-field-wide{grid-column:1 / -1}
.replay-form-actions{justify-content:flex-end}
.replay-drawer-mask{display:flex;justify-content:flex-end}
.replay-history-drawer{display:flex;flex-direction:column;gap:12px;width:min(520px,100%);height:100%;padding:20px;background:var(--bg-card,#fff);overflow:auto}
.replay-history-list{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.replay-history-item{border:1px solid var(--border,#e5e7eb);border-radius:6px;padding:10px 12px}
.replay-history-head{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-muted,#6b7280);margin-bottom:8px}
.replay-history-type{padding:1px 8px;border-radius:10px;background:#eef2ff;color:#3538cd}
.replay-history-delete{background:#fff1f0;color:#b42318}
.replay-history-update{background:#fff7e6;color:#b54708}
.replay-history-changes{width:100%;border-collapse:collapse}
.replay-history-changes th,.replay-history-changes td{padding:6px 8px;border-bottom:1px solid var(--border,#eef0f3);font-size:12px;text-align:left;word-break:break-all}
.replay-confirm-modal{width:min(360px,calc(100vw - 32px));display:grid;gap:18px;padding:20px;background:var(--bg-card,#fff);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.2)}
.replay-warning-title{margin:0;font-size:15px}
.replay-warning-codes{max-height:160px;margin:0;padding-left:20px;overflow:auto;word-break:break-all}
.replay-confirm-text{margin:0;font-size:14px;color:var(--text-primary,#1f2937)}
.replay-reason-import{box-sizing:border-box;max-height:calc(100dvh - 32px);overflow:auto;gap:12px}
.replay-reason-import p,.replay-reason-import ol{margin:0}
.replay-reason-import ol{padding-left:24px;list-style:decimal}
.replay-reason-import input{min-width:0;max-width:100%}
.replay-confirm-detail{margin:0;display:grid;gap:6px}
.replay-confirm-row{display:grid;grid-template-columns:88px 1fr;gap:8px;font-size:13px}
.replay-confirm-row dt{color:var(--text-muted,#6b7280)}
.replay-confirm-row dd{margin:0;color:var(--text-primary,#1f2937);word-break:break-all}
.replay-confirm-actions{display:flex;justify-content:flex-end;gap:8px}
.replay-toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2000;min-width:180px;max-width:70vw;padding:10px 16px;border-radius:6px;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.18);background:#24713d;color:#fff}
.replay-toast-error{background:#b42318}
.replay-toast-enter-active,.replay-toast-leave-active{transition:opacity .2s ease}
.replay-toast-enter-from,.replay-toast-leave-to{opacity:0}
@media (max-width:768px){
  .replay-toolbar{align-items:flex-start;flex-wrap:wrap}
  .replay-toolbar-actions{width:100%;justify-content:flex-end}
  .replay-tabs{overflow-x:auto}
  .replay-edit-grid{grid-template-columns:1fr}
  .replay-history-drawer{width:100%}
}
</style>
