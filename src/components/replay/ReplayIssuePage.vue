<template>
  <section class="replay-page" aria-label="并行回放问题清单">
    <header class="replay-toolbar">
      <div class="replay-toolbar-title">
        <button
          class="replay-icon-button replay-mobile-navigation"
          type="button"
          title="打开导航"
          aria-label="打开导航"
          data-testid="mobile-navigation-toggle"
          @click="$emit('toggleNavigation')"
        >
          <Menu :size="18" aria-hidden="true" />
        </button>
        <div>
          <h2>并行回放问题清单</h2>
          <p v-if="stats.importedAt">最近导入：{{ stats.importedAt }}</p>
        </div>
      </div>
      <div class="replay-toolbar-actions">
        <button class="replay-button replay-button-weekly" type="button" data-testid="open-weekly-task" @click="openWeeklyTask">
          <Flag :size="16" aria-hidden="true" />
          配置优先任务
        </button>
        <button class="replay-button replay-button-secondary" type="button" data-testid="open-daily-report" @click="openDailyReport">
          <FileSpreadsheet :size="16" aria-hidden="true" />
          日报
        </button>
        <button class="replay-button replay-button-primary" type="button" data-testid="open-import" @click="openImport">
          <Upload :size="16" aria-hidden="true" />
          导入 Excel
        </button>
        <button class="replay-button" type="button" data-testid="export-excel" :disabled="exporting" @click="exportExcel">
          <Download :size="16" aria-hidden="true" />
          {{ exporting ? '导出中...' : '导出 Excel' }}
        </button>
        <button
          class="replay-icon-button replay-query-toggle"
          type="button"
          data-testid="query-panel-toggle"
          :title="queryPanelCollapsed ? '展开统计' : '收起统计'"
          :aria-label="queryPanelCollapsed ? '展开统计' : '收起统计'"
          :aria-expanded="String(!queryPanelCollapsed)"
          @click="queryPanelCollapsed = !queryPanelCollapsed"
        >
          <ChevronDown v-if="queryPanelCollapsed" :size="18" aria-hidden="true" />
          <ChevronUp v-else :size="18" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-if="!queryPanelCollapsed" class="replay-query-panel">
    <div class="replay-summary" :style="{ '--replay-summary-columns': summaryCards.length }" aria-label="汇总数据">
      <div v-for="card in summaryCards" :key="card.key" class="replay-summary-card" tabindex="0">
        <span>{{ card.label }}</span><strong>{{ summaryValue(card) }}</strong>
        <div class="replay-summary-tooltip" role="tooltip">
          <div v-for="group in summaryGroups" :key="group"><span>{{ group }}</span><b>{{ groupSummary(card, group) }}</b></div>
        </div>
      </div>
    </div>
    </div>

    <div v-if="!queryPanelCollapsed" class="replay-summary-actions-row replay-summary-actions-row-transparent" data-testid="replay-summary-actions-row">
    <div class="replay-summary-entries" aria-label="问题明细汇总">
      <button
        class="replay-summary-entry replay-summary-entry-action"
        data-testid="group-summary-entry"
        type="button"
        @click="openSummaryModal('group')"
      >
        <BarChart3 :size="16" aria-hidden="true" />
        <span>各组问题数</span>
      </button>

      <button
        class="replay-summary-entry replay-summary-entry-person replay-summary-entry-action"
        data-testid="person-ranking-entry"
        type="button"
        @click="openSummaryModal('person')"
      >
        <Users :size="16" aria-hidden="true" />
        <span>各组开发负责人问题排名</span>
      </button>

      <button
        class="replay-summary-entry replay-summary-entry-action"
        data-testid="planned-completion-entry"
        type="button"
        @click="plannedCompletionOpen = true"
      >
        <CalendarRange :size="16" aria-hidden="true" />
        <span>计划完成情况</span>
      </button>
    </div>

    <div class="replay-summary-right-actions" data-testid="replay-summary-right-actions">
      <label class="replay-weekly-task-filter">
        <span class="replay-checkbox-line"><input v-model="filters.weeklyTask" data-testid="weekly-task-only" type="checkbox" :disabled="loading" @change="toggleWeeklyTask" />仅看优先任务</span>
      </label>
      <button class="replay-icon-button" type="button" data-testid="reset-filters" title="重置筛选" aria-label="重置筛选" :disabled="loading" @click="resetFilters">
        <RotateCcw :size="16" aria-hidden="true" />
      </button>
    </div>
    </div>

    <div v-if="activeSummaryModal" class="replay-summary-modal-mask" data-testid="summary-modal-mask">
      <section
        class="replay-summary-modal"
        :class="activeSummaryModal === 'person' ? 'replay-summary-modal-person' : 'replay-summary-modal-group'"
        role="dialog"
        aria-modal="true"
        :aria-label="activeSummaryTitle"
        data-testid="summary-modal"
      >
        <header>
          <h3>{{ activeSummaryTitle }}</h3>
          <div class="replay-summary-modal-actions">
            <button
              class="replay-button replay-button-compact"
              type="button"
              :data-testid="activeSummaryModal === 'group' ? 'copy-group-summary' : 'copy-person-ranking'"
              :disabled="activeSummaryLoading || !activeSummaryRows.length"
              @click="copySummaryTable(activeSummaryModal)"
            >
              <Copy :size="13" aria-hidden="true" />复制表格
            </button>
            <button class="replay-icon-button" type="button" data-testid="close-summary-modal" title="关闭" aria-label="关闭" @click="closeSummaryModal">
              <X :size="18" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div v-if="activeSummaryModal === 'person'" class="replay-person-ranking-tabs" role="tablist" aria-label="开发负责人排名分组">
          <button
            v-for="groupName in personRankingGroups"
            :key="groupName"
            type="button"
            role="tab"
            data-testid="person-ranking-group-tab"
            :data-active="activePersonRankingGroup === groupName"
            :aria-selected="activePersonRankingGroup === groupName"
            :class="{ 'is-active': activePersonRankingGroup === groupName }"
            @click="activePersonRankingGroup = groupName"
          >{{ groupName }}</button>
        </div>
        <p v-if="activeSummaryLoading" class="replay-summary-state">正在查询…</p>
        <p v-else-if="activeSummaryError" class="replay-summary-state replay-error">{{ activeSummaryError }}</p>
        <div v-else class="replay-summary-table-wrap">
          <table class="replay-summary-table" :class="{ 'replay-person-ranking-table': activeSummaryModal === 'person' }">
            <thead><tr><th v-for="column in activeSummaryColumns" :key="column.key" scope="col" :class="summaryColumnClass(column)">{{ column.label }}</th></tr></thead>
            <tbody>
              <tr v-for="(row, index) in activeSummaryRows" :key="summaryRowKey(row, index)"><td v-for="column in activeSummaryColumns" :key="column.key" :class="summaryColumnClass(column)">{{ row[column.key] }}</td></tr>
              <tr v-if="!activeSummaryRows.length"><td :colspan="activeSummaryColumns.length">暂无数据</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div class="replay-table-viewport replay-table-viewport-aligned" data-testid="table-viewport">
      <table class="replay-table">
        <colgroup><col v-for="column in columns" :key="column.key" :style="{ width: column.width }" /></colgroup>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key" scope="col" class="replay-column-header">
              <span>{{ column.label }}</span>
              <button v-if="headerFilterConfig[column.key]" type="button" class="replay-header-filter-button" :class="{ active: headerFilters[column.key]?.length }" :title="`筛选${column.label}`" @click.stop="openHeaderFilter(column, $event)" aria-label="打开筛选"><i aria-hidden="true"></i></button>
              <HelpCircle v-if="column.key === 'final_solution'" :size="14" title="填写最终采用的修复方案和处理结果" aria-label="最终处理方案说明" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.id" data-testid="replay-row" :class="{ 'replay-weekly-task-row': isWeeklyTask(row) }">
            <td
              v-for="column in columns"
              :key="column.key"
              :class="{ 'replay-copyable-cell': copyableColumnKeys.has(column.key), 'replay-person-cell': column.key === 'matched_developer' || column.key === 'matched_bank_owner' }"
              :title="cellTitle(column, row)"
              @click="copyableColumnKeys.has(column.key) && copyCell(column, row)"
            >
              <div v-if="column.key === 'operation'" class="replay-operation-buttons">
                <button class="replay-button replay-button-compact" type="button" :data-testid="`edit-${row.id}`" :disabled="!canEditIssue(row)" :title="editIssueTitle(row)" @click="openEdit(row)"><Pencil :size="13" aria-hidden="true" />编辑</button>
                <button class="replay-button replay-button-compact" type="button" :data-testid="`tracking-${row.id}`" @click="openTracking(row)"><HistoryIcon :size="13" aria-hidden="true" />问题跟踪</button>
              </div>
              <span v-else-if="column.key === 'weekly_task'" v-show="isWeeklyTask(row)" class="replay-weekly-task-badge" data-testid="weekly-task-badge"><Flag :size="12" aria-hidden="true" />优先任务</span>
              <button v-else-if="column.key === 'review_status' && row.review_status === '待审核'" type="button" class="replay-review-badge is-pending" :data-testid="`review-${row.id}`" :title="reviewActionTitle(row)" @click="approveReview(row)">待审核</button>
              <span v-else-if="column.key === 'review_status' && row.review_status === '已审核'" class="replay-review-badge is-approved" :data-testid="`review-${row.id}`" :title="row.reviewer_real_name ? `审核人：${row.reviewer_real_name}` : '已审核'">已审核</span>
              <span v-else-if="column.key === 'review_status'">-</span>
              <div
                v-else-if="column.key === 'planned_completion_date'"
                class="replay-plan-date-cell replay-plan-date-emphasis"
                :class="{ 'is-repair-date-locked': hasDefectRepairDate(row) }"
                :data-testid="`plan-date-display-${row.id}`"
                :title="hasDefectRepairDate(row) ? '已有缺陷修复日期，计划验证日期不可修改' : undefined"
              >
                <input
                  v-if="editingPlanDateId === row.id"
                  v-model="planDateDraft"
                  :data-testid="`plan-date-input-${row.id}`"
                  type="text"
                  inputmode="numeric"
                  maxlength="10"
                  placeholder="2026-08-26"
                  :disabled="planDateSavingId === row.id"
                  @blur="savePlanDate(row)"
                  @keydown.enter.prevent="savePlanDate(row)"
                  @keydown.esc.prevent="cancelPlanDateEdit"
                />
                <button v-else-if="canEditPlanDate(row)" type="button" class="replay-plan-date-edit" :data-testid="`plan-date-edit-${row.id}`" title="点击编辑计划验证日期" @click.stop="startPlanDateEdit(row)">
                  <span>{{ display(row.planned_completion_date) }}</span><Pencil :size="12" aria-hidden="true" />
                </button>
                <span v-else>{{ display(row.planned_completion_date) }}</span>
              </div>
              <span v-else-if="manualDisplayKeys.has(column.key)" class="replay-manual-value">{{ displayColumn(column.key, row[column.key], row) }}</span>
              <span v-else-if="detailDisplayKeys.has(column.key)" class="replay-detail-value">{{ displayColumn(column.key, row[column.key], row) }}</span>
              <template v-else>{{ displayColumn(column.key, row[column.key], row) }}</template>
            </td>
          </tr>
          <tr v-if="!loading && !error && items.length === 0"><td class="replay-state" :colspan="columns.length">暂无回放问题数据</td></tr>
          <tr v-if="loading"><td class="replay-state" :colspan="columns.length">正在加载回放问题…</td></tr>
          <tr v-if="error"><td class="replay-state replay-error" :colspan="columns.length">{{ error }}</td></tr>
        </tbody>
      </table>
      <div v-if="headerFilterOpen" class="replay-header-filter-panel" :style="headerFilterPanelStyle" data-testid="header-filter-panel">
        <header><strong>筛选 {{ activeHeaderColumn?.label }}</strong></header>
        <div class="replay-header-filter-content">
          <div class="replay-header-filter-search"><input v-model.trim="headerFilterSearch" type="search" placeholder="模糊搜索" data-testid="header-filter-search" @keydown.enter.prevent="loadHeaderFilterOptions" /><button type="button" aria-label="查询筛选选项" title="查询" @click="loadHeaderFilterOptions"><Search :size="14" /></button></div>
          <div class="replay-header-filter-actions"><button type="button" @click="selectAllHeaderOptions">全选</button><button type="button" @click="invertHeaderOptions">反选</button></div>
          <div class="replay-header-filter-options"><label v-for="option in headerFilterOptions" :key="option"><input v-model="headerFilterDraft" type="checkbox" :value="option" /><span>{{ option }}</span></label><p v-if="!headerFilterOptions.length">暂无选项</p></div>
        </div>
        <footer><button class="replay-button replay-button-compact replay-header-filter-clear" type="button" @click="clearHeaderFilter">清空筛选</button><span class="replay-header-filter-footer-spacer"></span><button class="replay-button replay-button-compact" type="button" @click="closeHeaderFilter">取消</button><button class="replay-button replay-button-primary replay-button-compact" type="button" @click="applyHeaderFilter">确定</button></footer>
      </div>
    </div>

    <p v-if="copyMessage" class="replay-copy-toast" role="status" aria-live="polite">{{ copyMessage }}</p>
    <p v-if="planDateError" class="replay-copy-toast replay-plan-date-toast" role="alert" data-testid="plan-date-error">{{ planDateError }}</p>

    <footer class="replay-pager">
      <span>共 {{ total }} 条，第 {{ page + 1 }} / {{ pageCount }} 页</span>
      <label>
        每页
        <select :value="pageSize" data-testid="page-size" @change="changePageSize">
          <option :value="50">50</option>
          <option :value="100">100</option>
          <option :value="200">200</option>
        </select>
        条
      </label>
      <div class="replay-page-actions">
        <button class="replay-icon-button" type="button" title="上一页" aria-label="上一页" data-testid="previous-page" :disabled="page === 0 || loading" @click="goPrevious">
          <ChevronLeft :size="18" aria-hidden="true" />
        </button>
        <button class="replay-icon-button" type="button" title="下一页" aria-label="下一页" data-testid="next-page" :disabled="page + 1 >= pageCount || loading" @click="goNext">
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
      </div>
    </footer>

    <div v-if="weeklyTaskOpen" class="replay-modal-mask" @click.self="closeWeeklyTask">
      <section class="replay-weekly-task-modal" role="dialog" aria-modal="true" aria-labelledby="weekly-task-title" data-testid="weekly-task-modal">
        <header>
          <div><h3 id="weekly-task-title">配置优先任务</h3><p>按出现批次标记问题；多批次取并集，不会重复计数。</p></div>
          <button class="replay-icon-button" type="button" title="关闭" aria-label="关闭" @click="closeWeeklyTask"><X :size="16" /></button>
        </header>
        <div class="replay-weekly-task-body">
          <label class="replay-weekly-task-search"><span>查找批次</span><div><Search :size="14" /><input v-model.trim="weeklyTaskSearch" type="search" placeholder="输入批次名称" /></div></label>
          <div class="replay-weekly-task-meta"><span>已选 {{ weeklyTaskDraft.length }} 个批次</span><strong>当前匹配 {{ weeklyTaskConfig.issueCount || 0 }} 个问题</strong></div>
          <div class="replay-weekly-task-options">
            <label v-for="batch in filteredWeeklyTaskBatches" :key="batch">
              <input v-model="weeklyTaskDraft" type="checkbox" :value="batch" data-testid="weekly-task-batch-option" />
              <span>{{ batch }}</span>
            </label>
            <p v-if="!filteredWeeklyTaskBatches.length">没有匹配的出现批次</p>
          </div>
          <label><span>操作口令</span><input v-model="weeklyTaskToken" data-testid="weekly-task-token" type="password" autocomplete="off" placeholder="X-DII-Trigger-Token" /></label>
          <p v-if="weeklyTaskError" class="replay-edit-error">{{ weeklyTaskError }}</p>
        </div>
        <footer>
          <button class="replay-button replay-button-danger" type="button" :disabled="weeklyTaskSaving" @click="clearWeeklyTask">清空配置</button>
          <span class="replay-modal-spacer"></span>
          <button class="replay-button" type="button" :disabled="weeklyTaskSaving" @click="closeWeeklyTask">取消</button>
          <button class="replay-button replay-button-primary" type="button" data-testid="save-weekly-task" :disabled="weeklyTaskSaving || !weeklyTaskToken.trim()" @click="saveWeeklyTask">{{ weeklyTaskSaving ? '保存中…' : '保存配置' }}</button>
        </footer>
      </section>
    </div>

    <div v-if="importOpen" class="replay-modal-mask" @click.self="!importing && closeImport()">
      <section class="replay-import-modal" role="dialog" aria-modal="true" aria-labelledby="replay-import-title">
        <header>
          <div>
            <h3 id="replay-import-title">导入回放问题</h3>
            <p>上传 Excel 文件后将按 issue_key 合并问题状态。</p>
          </div>
          <button class="replay-icon-button" type="button" title="关闭导入窗口" aria-label="关闭导入窗口" :disabled="importing" @click="closeImport"><X :size="16" aria-hidden="true" /></button>
        </header>
        <fieldset class="replay-import-type" :disabled="importing">
          <legend>回放类型</legend>
          <label>
            <input v-model="importReplayType" data-testid="import-type-query" type="radio" value="QUERY" />
            <span>查询</span>
          </label>
          <label>
            <input v-model="importReplayType" data-testid="import-type-dz" type="radio" value="DZ" />
            <span>动账</span>
          </label>
        </fieldset>
        <label class="replay-file-field">
          <span>Excel 文件</span>
          <input data-testid="import-file" type="file" accept=".xlsx,.xls" :disabled="importing" @change="selectImportFile" />
          <small>{{ importFile?.name || '请选择 .xlsx 或 .xls 文件' }}</small>
        </label>
        <label>
          <span>导入口令</span>
          <input v-model="importToken" data-testid="import-token" type="password" autocomplete="off" :disabled="importing" placeholder="X-DII-Trigger-Token" />
        </label>
        <p v-if="importMessage" class="replay-import-message" :class="{ 'is-error': importError }">{{ importMessage }}</p>
        <footer>
          <button class="replay-button" type="button" :disabled="importing" @click="closeImport">取消</button>
          <button class="replay-button replay-button-primary" type="button" data-testid="submit-import" :disabled="!importFile || importing || importComplete" @click="submitImport">
            <Upload :size="16" aria-hidden="true" />
            {{ importing ? '导入中…' : (importComplete ? '已导入' : '开始导入') }}
          </button>
        </footer>
      </section>
    </div>

    <div v-if="dailyReportOpen" class="replay-modal-mask" @click.self="!dailyReportLoading && closeDailyReport()">
      <section class="replay-import-modal replay-daily-report-modal" role="dialog" aria-modal="true" aria-labelledby="replay-daily-report-title" data-testid="daily-report-modal">
        <header>
          <div>
            <h3 id="replay-daily-report-title">下载日报</h3>
            <p>日报是导入时的快照，下载后状态修改不影响数据。</p>
          </div>
          <button class="replay-icon-button" type="button" title="关闭日报窗口" aria-label="关闭日报窗口" :disabled="dailyReportLoading" @click="closeDailyReport"><X :size="16" aria-hidden="true" /></button>
        </header>
        <p v-if="dailyReportLoading" class="replay-loading-status">正在加载批次列表…</p>
        <template v-else-if="dailyReportBatches.length === 0">
          <p class="replay-empty-tip">暂无已落盘的日报，请先导入一次 Excel。</p>
        </template>
        <template v-else>
          <label class="replay-daily-report-picker">
            <span>选择批次</span>
            <select v-model="dailyReportSelectedBatch" data-testid="daily-report-batch">
              <option v-for="entry in dailyReportBatches" :key="entry.batchNo" :value="entry.batchNo" :disabled="!entry.available">
                {{ entry.batchNo }}{{ entry.available ? '' : '（尚未生成）' }}
              </option>
            </select>
          </label>
          <small v-if="dailyReportError" class="replay-daily-report-error">{{ dailyReportError }}</small>
        </template>
        <footer>
          <button class="replay-button" type="button" :disabled="dailyReportLoading || dailyReportBatches.length === 0" @click="closeDailyReport">取消</button>
          <button class="replay-button replay-button-primary" type="button" data-testid="download-daily-report"
                  :disabled="dailyReportLoading || !dailyReportSelectedBatch || dailyReportDownloading" @click="downloadSelectedDailyReport">
            <Download :size="15" aria-hidden="true" />
            {{ dailyReportDownloading ? '下载中…' : '下载 Excel' }}
          </button>
        </footer>
      </section>
    </div>

    <div v-if="editOpen" class="replay-modal-mask">
      <section class="replay-edit-modal" role="dialog" aria-modal="true" aria-labelledby="replay-edit-title" data-testid="edit-modal">
        <header>
          <div>
            <h3 id="replay-edit-title">编辑回放问题</h3>
          </div>
          <button class="replay-icon-button" type="button" title="关闭编辑窗口" aria-label="关闭编辑窗口" :disabled="savingId === editIssue?.id" @click="closeEdit"><X :size="16" aria-hidden="true" /></button>
        </header>
        <div class="replay-edit-grid">
          <label>
            <span>问题状态</span>
            <select v-model="editDraft.issueStatus" data-testid="edit-status" @change="onEditStatusChange">
              <option value="" disabled>{{ editIssue && !manualStatuses.includes(editIssue.issue_status) ? `当前：${display(editIssue.issue_status)}，请选择` : '请选择状态' }}</option>
              <option v-for="status in manualStatuses" :key="status" :value="status">{{ status }}</option>
            </select>
          </label>
          <label>
            <span>问题类型 <em class="replay-required-mark">*</em></span>
            <select v-model="editDraft.issueType" data-testid="edit-type" :disabled="issueTypeLocked" :class="{ 'replay-invalid': editError && !editDraft.issueType }">
              <option value="">请选择问题类型</option>
              <option v-for="type in issueTypes" :key="type" :value="type">{{ type }}</option>
            </select>
          </label>
          <label class="replay-edit-wide">
            <span>初步问题分析 <em>{{ editDraft.initialAnalysis.length }}/500</em></span>
            <textarea v-model="editDraft.initialAnalysis" maxlength="500" rows="4" data-testid="edit-analysis" />
          </label>
          <label class="replay-edit-wide">
            <span class="replay-field-label">
              最终处理方案
              <HelpCircle class="replay-field-help-trigger" :size="14" tabindex="0" title="最终处理方案填写说明" aria-label="最终处理方案填写说明" />
              <span class="replay-field-help-tooltip" role="tooltip">
                <strong>通用问题处理：</strong>
                <br />1、流水号超长：平台邮件企架组计划年底处理完成
                <br />2、柜员不存在或机构不存在：公共组参数铺底数据不全，后续等待公共组重新铺底
                <br />3、柜员不存在当前机构信息，切换失败：528 会对机构和柜员进行唯一性校验，判断核心机构和柜员已解耦，需加入忽略清单
                <br /><br /><strong>其他问题：</strong>
                <br />1、528 成功，新核心报账号不存在，要先排查账号是不是预开户账号，如果是则可以忽略
              </span>
              <em>{{ editDraft.finalSolution.length }}/500</em>
            </span>
            <textarea v-model="editDraft.finalSolution" maxlength="500" rows="4" data-testid="edit-solution" />
          </label>
          <label class="replay-edit-wide">
            <span>备注 <em>{{ editDraft.remark.length }}/500</em></span>
            <textarea v-model="editDraft.remark" maxlength="500" rows="3" data-testid="edit-remark" />
          </label>
          <label class="replay-edit-wide">
            <span class="replay-field-label">
              需协同人
              <HelpCircle class="replay-field-help-trigger" :size="14" tabindex="0" title="需协同人填写说明" aria-label="需协同人填写说明" />
              <span class="replay-field-help-tooltip" role="tooltip">
                如果找不到协同人，请先联系协同人先登录该系统。
                <br />行员信息维护请联系平台组。
              </span>
            </span>
            <div class="replay-collaborator-control">
              <div class="replay-user-picker">
                <input v-model="editDraft.cooperationPersonDisplay" type="search" placeholder="姓名或账号" data-testid="edit-collaborator" @input="searchEditUsers" />
                <div v-if="editUserOptions.length" class="replay-user-options">
                  <button v-for="user in editUserOptions" :key="user.username" type="button" @click="selectEditUser(user)">{{ user.displayName }}</button>
                </div>
              </div>
              <span v-if="editDraft.cooperationPersonUsername" class="replay-mail-status replay-collaborator-mail-status" :class="`is-${String(primaryCollaboratorStatus.status || 'UNSENT').toLowerCase()}`" :title="primaryCollaboratorStatus.failureMessage || (primaryCollaboratorStatus.status === 'PENDING' ? '当前编辑内容相较上次发送内容已变化' : '')" data-testid="edit-mail-status">{{ mailStatusLabel(primaryCollaboratorStatus.status) }}</span>
            </div>
          </label>
        </div>
        <p v-if="editError" class="replay-edit-error">{{ editError }}</p>
        <footer>
          <button class="replay-button" type="button" :disabled="savingId === editIssue?.id" @click="closeEdit">取消</button>
          <button class="replay-button replay-button-primary" type="button" data-testid="save-edit" :disabled="savingId === editIssue?.id" @click="saveEdit"><Save :size="15" aria-hidden="true" />{{ savingId === editIssue?.id ? '保存中…' : '保存' }}</button>
        </footer>
      </section>
    </div>

    <div v-if="mailPromptOpen" class="replay-modal-mask replay-mail-prompt-mask">
      <section class="replay-mail-prompt" role="dialog" aria-modal="true" aria-labelledby="replay-mail-prompt-title" data-testid="mail-confirm-modal">
        <header>
          <div><h3 id="replay-mail-prompt-title">发送协同邮件</h3><p>当前问题已保存，是否发送邮件通知协同人？</p></div>
        </header>
        <div class="replay-mail-prompt-content">
          <strong>issue_id {{ mailPrompt.issueId }}</strong>
          <span>发送至：{{ mailPrompt.collaboratorName }}（{{ mailPrompt.collaboratorEmail }}）</span>
          <label><input v-model="mailPromptChoice" type="radio" value="no" data-testid="mail-choice-no" /> 否，仅保存</label>
          <label><input v-model="mailPromptChoice" type="radio" value="yes" data-testid="mail-choice-yes" /> 是，发送邮件</label>
        </div>
        <p v-if="mailPromptError" class="replay-edit-error">{{ mailPromptError }}</p>
        <footer>
          <button class="replay-button replay-button-primary" type="button" data-testid="mail-confirm-submit" :disabled="mailPromptSending" @click="confirmMailPrompt">{{ mailPromptSending ? '处理中…' : '确定' }}</button>
        </footer>
      </section>
    </div>

    <div v-if="trackingOpen" class="replay-drawer-mask" @click.self="closeTracking">
      <aside class="replay-tracking-drawer" role="dialog" aria-modal="true" aria-labelledby="replay-tracking-title" data-testid="tracking-drawer">
        <header>
          <div><h3 id="replay-tracking-title">问题跟踪路径</h3><p>{{ trackingIssue?.issue_key }}</p></div>
          <button class="replay-icon-button" type="button" title="关闭问题跟踪路径" aria-label="关闭问题跟踪路径" @click="closeTracking"><X :size="16" aria-hidden="true" /></button>
        </header>
        <p v-if="trackingLoading" class="replay-drawer-state">正在加载…</p>
        <p v-else-if="trackingError" class="replay-drawer-state replay-error">{{ trackingError }}</p>
        <ol v-else class="replay-timeline replay-batch-timeline">
          <li v-for="(group, groupIndex) in trackingGroups" :key="group.roundId ?? group.roundCode" data-testid="tracking-round-group">
            <div class="replay-timeline-marker" aria-hidden="true"></div>
            <details
              open
              class="replay-batch-group"
              :data-testid="`tracking-round-${group.roundId ?? 'base'}`"
            >
              <summary class="replay-round-summary">
                <strong>批次编号 {{ group.roundCode }}</strong>
                <span v-if="group.roundId && groupIndex === 0" class="replay-current-batch">最新批次</span>
                <time>{{ display(group.importedAt) }}</time>
              </summary>
              <div class="replay-round-body">
              <p class="replay-round-section-title">本批次导入结果</p>
              <dl>
                <div><dt>本批次出现</dt><dd>{{ group.appeared ? '是' : '否（自动处理）' }}</dd></div>
                <div><dt>导入状态</dt><dd>{{ statusTransition(group) }}</dd></div>
                <div><dt>导入结果</dt><dd>{{ display(group.actionType) }}</dd></div>
                <div><dt>来源</dt><dd>{{ sourceDisplay(group) }}</dd></div>
                <div><dt>人工修改</dt><dd>人工修改 {{ group.manualChangeCount || 0 }} 次</dd></div>
                <div><dt>最终状态</dt><dd>本批次最终状态 {{ display(group.finalStatus) }}</dd></div>
              </dl>
              <details
                v-if="group.inheritedEvents?.length"
                open
                class="replay-manual-events replay-inherited-events"
                :data-testid="`inherited-events-${group.roundId}`"
              >
                <summary>本批次继承内容（{{ group.inheritedEvents.length }}）</summary>
                <ol>
                  <li v-for="event in group.inheritedEvents" :key="event.id">
                    <div class="replay-event-heading"><strong>{{ event.operationType }}</strong><time>{{ event.operationAt }}</time></div>
                    <dl>
                      <div><dt>问题类型</dt><dd>{{ display(event.issueType) }}</dd></div>
                      <div><dt>初步分析</dt><dd>{{ display(event.initialAnalysis) }}</dd></div>
                      <div><dt>处理方案</dt><dd>{{ display(event.finalSolution) }}</dd></div>
                      <div><dt>需协同人</dt><dd>{{ collaboratorDisplay(event) }}</dd></div>
                      <div><dt>备注</dt><dd>{{ display(event.remark) }}</dd></div>
                    </dl>
                    <details><summary>完整快照</summary><pre>{{ formatSnapshots(event) }}</pre></details>
                  </li>
                </ol>
              </details>
              <details
                v-if="group.manualEvents?.length"
                open
                class="replay-manual-events"
                :data-testid="`manual-events-${group.roundId ?? 'base'}`"
              >
                <summary>本批次用户操作（{{ group.manualEvents.length }}）</summary>
                <ol>
                  <li v-for="event in group.manualEvents" :key="event.id">
                    <div class="replay-event-heading"><strong>{{ event.operationType }}</strong><time>{{ event.operationAt }}</time></div>
                    <p>{{ event.operatorRealName || event.operatorUsername || '系统' }}<span v-if="event.operatorUsername">（{{ event.operatorUsername }}）</span></p>
                    <dl>
                      <div><dt>当前状态</dt><dd>{{ display(event.issueStatus) }}</dd></div>
                      <div><dt>问题类型</dt><dd>{{ display(event.issueType) }}</dd></div>
                      <div><dt>初步分析</dt><dd>{{ display(event.initialAnalysis) }}</dd></div>
                      <div><dt>处理方案</dt><dd>{{ display(event.finalSolution) }}</dd></div>
                      <div><dt>需协同人</dt><dd>{{ collaboratorDisplay(event) }}</dd></div>
                      <div><dt>备注</dt><dd>{{ display(event.remark) }}</dd></div>
                    </dl>
                    <details><summary>完整快照</summary><pre>{{ formatSnapshots(event) }}</pre></details>
                  </li>
                </ol>
              </details>
              </div>
            </details>
          </li>
          <li v-if="trackingGroups.length === 0" class="replay-drawer-state">暂无跟踪记录</li>
        </ol>
      </aside>
    </div>
    <ReplayPlannedCompletionModal :open="plannedCompletionOpen" @close="plannedCompletionOpen = false" />
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { BarChart3, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Download, FileSpreadsheet, Flag, HelpCircle, History as HistoryIcon, Menu, Pencil, RotateCcw, Save, Search, Upload, Users, X } from 'lucide-vue-next'
import { approveReplayIssue, exportReplayIssues, getReplayImportRounds, getReplayIssueGroupSummaries, getReplayIssueHeaderFilterOptions, getReplayIssueMailStatus, getReplayIssueOptions, getReplayIssuePersonRankings, getReplayIssueReviewPermissions, getReplayIssuePlanDatePermissions, getReplayIssueRoundTracking, getReplayIssueStats, getReplayWeeklyTask, replaceReplayWeeklyTask, getReplayDailyReportBatches, downloadReplayDailyReport, importReplayIssues, listReplayIssues, searchReplayIssueUsers, sendReplayIssueMail, updateReplayIssue, updateReplayIssuePlannedCompletionDate } from '../../api/replayIssues.js'
import ReplayPlannedCompletionModal from './ReplayPlannedCompletionModal.vue'

defineEmits(['toggleNavigation'])

const columns = [
  ['weekly_task', '任务标记', '110px'],
  ['domain', '领域', 'calc(4em + 20px)'], ['issue_id', 'issue_id', '80px'], ['is_sandbox', '是否沙箱', '100px'],
  ['transaction_code', '交易码', '100px'], ['transaction_name', '交易名称', '180px'], ['issue_level', '问题级别', '100px'],
  ['field_name', '字段名', '120px'], ['serial_no', '流水号', '160px'], ['global_serial_no', '全局流水号', '180px'], ['issue_description', '问题描述', '220px'],
  ['planned_completion_date', '计划验证日期', '132px'], ['defect_repair_date', '缺陷修复日期', '120px'],
  ['matched_developer', '开发负责人', '10em'], ['matched_bank_owner', '科技负责人', '10em'], ['operation', '操作', '176px'], ['issue_status', '问题状态', '132px'], ['review_status', '审核状态', '112px'], ['issue_type', '问题类型', '132px'], ['cooperation_person_username', '需协同人', '180px'],
  ['initial_analysis', '初步问题分析', '220px'], ['final_solution', '最终处理方案', '220px'], ['remark', '备注', '160px'],
  ['affected_transaction_count', '该问题出现在的交易笔数', '176px'],
  ['issue_key', 'issue_key', '180px'],
  ['first_occurrence_date', '首次出现日期', '180px'], ['last_occurrence_date', '上次出现日期', '180px'],
  ['occurrence_rounds', '出现批次', '220px'],
].map(([key, label, width]) => ({ key, label, width }))

const headerFilterConfig = {
  domain: ['groupName', 'groupNames'], is_sandbox: ['sandbox', 'sandboxes'],
  issue_id: ['issueId', 'issueIds'],
  transaction_code: ['transactionCode', 'transactionCodes'], issue_level: ['issueLevel', 'issueLevels'],
  serial_no: ['serialNo', 'serialNos'], global_serial_no: ['globalSerialNo', 'globalSerialNos'],
  defect_repair_date: ['defectRepairDate', 'defectRepairDates'],
  matched_developer: ['developer', 'developers'], matched_bank_owner: ['bankOwner', 'bankOwners'],
  issue_status: ['issueStatus', 'issueStatuses'], issue_type: ['issueType', 'issueTypes'],
  review_status: ['reviewStatus', 'reviewStatuses'],
  cooperation_person_username: ['cooperationPerson', 'cooperationPersons'],
  planned_completion_date: ['plannedCompletionDate', 'plannedCompletionDates'],
  occurrence_rounds: ['occurrenceBatch', 'occurrenceBatches'],
}
const headerFilters = reactive({})
const headerFilterOpen = ref(false)
const activeHeaderColumn = ref(null)
const headerFilterPanelStyle = reactive({ top: '96px', left: '12px' })
let headerFilterAnchor = null
const headerFilterSearch = ref('')
const headerFilterOptions = ref([])
const headerFilterDraft = ref([])

const copyableColumnKeys = new Set(['transaction_name', 'field_name', 'issue_description', 'initial_analysis', 'final_solution', 'remark', 'serial_no', 'global_serial_no', 'issue_key'])
const manualStatuses = ['打开', '无需处理', '延后修复', '修复待验证']
const issueTypes = ['迁移问题', '防腐问题', '代码问题', '新核心下线', '参数问题', '平台问题', '规则差异问题', '合理差异', '外围问题', '其他问题']
const manualDisplayKeys = new Set(['issue_status', 'issue_type', 'cooperation_person_username'])
const detailDisplayKeys = new Set(['initial_analysis', 'final_solution', 'remark'])
const filters = reactive({ groupName: '', issueId: '', issueLevel: '', issueType: '', issueStatus: '', reviewStatus: '', sandbox: '', developer: '', bankOwner: '', cooperationPerson: '', serialNo: '', globalSerialNo: '', defectRepairDate: '', coverageRound: '', keyword: '', weeklyTask: false })
const allStatuses = ['新建', '打开', '无需处理', '延后修复', '修复待验证', '重新打开', '已修复']
const options = reactive({ groups: [], issueLevels: [], issueTypes, issueStatuses: allStatuses, reviewStatuses: ['待审核', '已审核'], coverageRounds: [] })
const stats = reactive({ total: 0, openTotal: 0, noActionTotal: 0, processingTotal: 0, pendingVerificationTotal: 0, fixedTotal: 0, groupCounts: {}, importedAt: '' })
const reviewPermissions = reactive({ reviewableGroups: [], reviewersByGroup: {}, reviewableTransactionCodes: [] })
const planDatePermissions = reactive({ editableGroups: [] })
const editingPlanDateId = ref(null)
const planDateDraft = ref('')
const planDateOriginal = ref('')
const planDateSavingId = ref(null)
const planDateError = ref('')
const queryPanelCollapsed = ref(false)
watch(queryPanelCollapsed, async () => {
  await nextTick()
  const viewport = document.querySelector('[data-testid="table-viewport"]')
  if (viewport) viewport.scrollTop = 0
  positionHeaderFilter()
})
const summaryGroups = ['公共组', '存款组', '贷款组', '结算组']
const personRankingGroups = ['存款组', '贷款组', '公共组', '结算组']
const activePersonRankingGroup = ref('存款组')
const filteredGroupSummaryRows = computed(() => {
  const rowsByGroup = new Map(groupSummaryRows.value.map((row) => [row.groupName, row]))
  return summaryGroups.map((groupName) => rowsByGroup.get(groupName)).filter(Boolean)
})
const filteredPersonRankingRows = computed(() => personRankingRows.value
  .filter(row => row.groupName === activePersonRankingGroup.value)
  .map((row, index) => ({ ...row, rank: index + 1 })))
const summaryCards = [
  { key: 'total', label: '问题总数（全部状态）', valueKey: 'total' },
  { key: 'new', label: '问题新建总数', valueKey: 'newTotal' },
  { key: 'open', label: '问题打开总数', valueKey: 'openTotal' },
  { key: 'reopened', label: '问题重新打开总数', valueKey: 'reopenedTotal' },
  { key: 'deferred', label: '问题延后修复总数', valueKey: 'deferredTotal' },
  { key: 'noAction', label: '问题无需处理总数', valueKey: 'noActionTotal' },
  { key: 'pendingVerification', label: '问题待验证总数', valueKey: 'pendingVerificationTotal' },
  { key: 'fixed', label: '问题已修复总数', valueKey: 'fixedTotal' },
]
const groupSummaryColumns = [
  { key: 'groupName', label: '分组' },
  { key: 'newCount', label: '新建', segment: 'pending' },
  { key: 'openCount', label: '打开', segment: 'pending' },
  { key: 'reopenedCount', label: '重新打开', segment: 'pending' },
  { key: 'deferredCount', label: '延后修复', segment: 'pending' },
  { key: 'pendingVerificationCount', label: '修复待验证', segment: 'pending' },
  { key: 'pendingTotalCount', label: '未修复总数', segment: 'pending', total: true },
  { key: 'noActionCount', label: '无需处理', segment: 'fixed' },
  { key: 'fixedCount', label: '已修复', segment: 'fixed' },
  { key: 'fixedTotalCount', label: '已修复总数', segment: 'fixed', total: true },
]
const personRankingColumns = [
  { key: 'rank', label: '排名' },
  { key: 'groupName', label: '分组' },
  { key: 'developer', label: '开发负责人' },
  { key: 'newCount', label: '新建', segment: 'pending' },
  { key: 'openCount', label: '打开', segment: 'pending' },
  { key: 'reopenedCount', label: '重新打开', segment: 'pending' },
  { key: 'deferredCount', label: '延后修复', segment: 'pending' },
  { key: 'pendingVerificationCount', label: '修复待验证', segment: 'pending' },
  { key: 'pendingTotalCount', label: '未修复总数', segment: 'pending', total: true },
  { key: 'noActionCount', label: '无需处理', segment: 'fixed' },
  { key: 'fixedCount', label: '已修复', segment: 'fixed' },
  { key: 'fixedTotalCount', label: '已修复总数', segment: 'fixed', total: true },
]
const items = ref([])
const total = ref(0)
const page = ref(0)
const pageSize = ref(50)
const loading = ref(false)
const error = ref('')
const copyMessage = ref('')
let copyMessageTimer = null
const activeSummaryModal = ref('')
const plannedCompletionOpen = ref(false)
const groupSummaryRows = ref([])
const personRankingRows = ref([])
const groupSummaryLoading = ref(false)
const personRankingLoading = ref(false)
const groupSummaryError = ref('')
const personRankingError = ref('')
const activeSummaryTitle = computed(() => activeSummaryModal.value === 'person' ? '各组开发负责人问题排名' : '各组问题数')
const activeSummaryColumns = computed(() => activeSummaryModal.value === 'person' ? personRankingColumns : groupSummaryColumns)
const activeSummaryRows = computed(() => activeSummaryModal.value === 'person' ? filteredPersonRankingRows.value : filteredGroupSummaryRows.value)
const activeSummaryLoading = computed(() => activeSummaryModal.value === 'person' ? personRankingLoading.value : groupSummaryLoading.value)
const activeSummaryError = computed(() => activeSummaryModal.value === 'person' ? personRankingError.value : groupSummaryError.value)

const importOpen = ref(false)
const importFile = ref(null)
const importToken = ref('')
const importReplayType = ref('QUERY')
const importing = ref(false)
const exporting = ref(false)
const importComplete = ref(false)
const importMessage = ref('')
const importError = ref(false)
const weeklyTaskOpen = ref(false)
const weeklyTaskSaving = ref(false)
const weeklyTaskSearch = ref('')
const weeklyTaskToken = ref('')
const weeklyTaskError = ref('')
const weeklyTaskDraft = ref([])
const weeklyTaskConfig = reactive({ batchNames: [], availableBatchNames: [], issueCount: 0 })
const filteredWeeklyTaskBatches = computed(() => {
  const keyword = weeklyTaskSearch.value.trim()
  return (weeklyTaskConfig.availableBatchNames || []).filter((batch) => !keyword || batch.includes(keyword))
})
const dailyReportOpen = ref(false)
const dailyReportBatches = ref([])
const dailyReportSelectedBatch = ref('')
const dailyReportLoading = ref(false)
const dailyReportDownloading = ref(false)
const dailyReportError = ref('')
const savingId = ref(null)
const editOpen = ref(false)
const editIssue = ref(null)
const editDraft = reactive({ issueStatus: '', issueType: '', initialAnalysis: '', finalSolution: '', cooperationPersonUsername: '', cooperationPersonDisplay: '', remark: '' })
const issueTypeLocked = computed(() => ['无需处理', '延后修复'].includes(editDraft.issueStatus))
function onEditStatusChange() {
  if (editDraft.issueStatus === '无需处理') editDraft.issueType = '合理差异'
  if (editDraft.issueStatus === '延后修复') editDraft.issueType = '迁移问题'
}
const editUserOptions = ref([])
const editError = ref('')
const editMailStatus = reactive({ status: 'UNSENT', sentAt: '', recipientEmail: '', failureMessage: '' })
const editMailRecipients = ref([])
const collaboratorSelectionPending = ref(false)
const primaryCollaboratorStatus = computed(() => {
  if (!editDraft.cooperationPersonUsername) return { status: 'UNSENT', failureMessage: '' }
  const recipients = editMailRecipients.value
  if (!recipients.length) return { status: 'UNSENT', failureMessage: '' }
  const statuses = recipients.map(mailRecipientStatus)
  const failed = recipients.filter((recipient, index) => statuses[index] === 'FAILED')
  const status = failed.length ? 'FAILED' : statuses.includes('PENDING') ? 'PENDING' : statuses.includes('SENDING') ? 'SENDING' : statuses.includes('UNSENT') ? 'UNSENT' : 'SENT'
  return { status, failureMessage: failed.map(item => item.failureMessage).filter(Boolean).join('；') }
})
const editMailContentChanged = computed(() => {
  const row = editIssue.value
  if (!row) return false
  return [editDraft.issueStatus || row.issue_status, editDraft.issueType, editDraft.initialAnalysis, editDraft.finalSolution,
    editDraft.cooperationPersonUsername, editDraft.remark].join('\u0001') !==
    [row.issue_status, row.issue_type, row.initial_analysis, row.final_solution, row.cooperation_person_username, row.remark].map(value => value || '').join('\u0001')
})
function mailStatusLabel(status) {
  return ({ UNSENT: '未发送', SENDING: '发送中', SENT: '已发送', PENDING: '待发送（内容已经变更）', FAILED: '发送失败' }[status] || '未发送')
}

function mailRecipientStatus(recipient) {
  if (recipient?.role === '协同人' && collaboratorSelectionPending.value) return 'UNSENT'
  if (recipient?.role === '协同人' && editIssue.value && (editDraft.cooperationPersonUsername || '') !== (editIssue.value.cooperation_person_username || '')) return 'UNSENT'
  const status = String(recipient?.status || 'UNSENT').toUpperCase()
  if (status === 'PENDING' && !String(recipient?.sentAt || editMailStatus.sentAt || '').trim()) return 'UNSENT'
  if (status === 'SENT' && editMailContentChanged.value) return 'PENDING'
  return status
}
const mailPromptOpen = ref(false)
const mailPrompt = reactive({ issueId: '', collaboratorName: '', collaboratorEmail: '' })
const mailPromptChoice = ref('no')
const mailPromptSending = ref(false)
const mailPromptError = ref('')
const trackingOpen = ref(false)
const trackingIssue = ref(null)
const trackingGroups = ref([])
const trackingLoading = ref(false)
const trackingError = ref('')

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function display(value) {
  return value === undefined || value === null || value === '' ? '-' : String(value)
}

function displayColumn(key, value, row) {
  if (key === 'is_sandbox') return value === true || value === 1 || value === 'true' || value === '1' ? '是' : '否'
  if (key === 'first_occurrence_date' || key === 'last_occurrence_date') return dateOnlyDisplay(value)
  if (key === 'cooperation_person_username') {
    const realName = row?.cooperation_person_real_name
    if (realName && value) return `${realName}(${value})`
    return realName || value || '-'
  }
  return display(value)
}

function dateOnlyDisplay(value) {
  const text = value === undefined || value === null ? '' : String(value).trim()
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : display(value)
}

function isWeeklyTask(row) {
  return row?.weekly_task === true || row?.weekly_task === 1 || row?.weekly_task === '1' || row?.weekly_task === 'true'
}

function summaryValue(card) {
  if (!Object.keys(stats.groupCounts || {}).length) return stats[card.valueKey] ?? (card.key === 'deferred' ? stats.processingTotal : 0)
  if (card.key === 'total') return Object.values(stats.groupCounts).reduce((sum, group) => sum + Number(group?.total || 0), 0)
  const key = card.key === 'new' ? 'new' : card.key === 'open' ? 'open' : card.key === 'noAction' ? 'noAction' : card.key === 'reopened' ? 'reopened' : card.key === 'deferred' ? 'deferred' : card.key === 'pendingVerification' ? 'pendingVerification' : 'fixed'
  return Object.values(stats.groupCounts).reduce((sum, group) => sum + Number(group?.[key] || 0), 0)
}

function groupSummary(card, group) {
  if (card.key === 'total') return stats.groupCounts?.[group]?.total ?? 0
  const key = card.key === 'new' ? 'new' : card.key === 'open' ? 'open' : card.key === 'noAction' ? 'noAction' : card.key === 'reopened' ? 'reopened' : card.key === 'deferred' ? 'deferred' : card.key === 'pendingVerification' ? 'pendingVerification' : 'fixed'
  return stats.groupCounts?.[group]?.[key] ?? 0
}

async function openSummaryModal(type) {
  if (type === 'person') activePersonRankingGroup.value = '存款组'
  activeSummaryModal.value = type
  const loadingRef = type === 'group' ? groupSummaryLoading : personRankingLoading
  if (loadingRef.value) return
  const rowsRef = type === 'group' ? groupSummaryRows : personRankingRows
  const errorRef = type === 'group' ? groupSummaryError : personRankingError
  const loader = type === 'group' ? getReplayIssueGroupSummaries : getReplayIssuePersonRankings
  loadingRef.value = true
  errorRef.value = ''
  try {
    rowsRef.value = await loader() || []
  } catch (cause) {
    rowsRef.value = []
    errorRef.value = `查询失败：${cause?.message || cause}`
  } finally {
    loadingRef.value = false
  }
}

function closeSummaryModal() {
  activeSummaryModal.value = ''
}

function summaryRowKey(row, index) {
  return activeSummaryModal.value === 'person'
    ? `${row.groupName}-${row.rank}-${row.developer}`
    : row.groupName || index
}

function summaryColumnClass(column) {
  return {
    'is-pending-segment': column.segment === 'pending',
    'is-fixed-segment': column.segment === 'fixed',
    'is-segment-total': column.total === true,
  }
}

async function copySummaryTable(type) {
  const columns = type === 'group' ? groupSummaryColumns : personRankingColumns
  const rows = type === 'group' ? filteredGroupSummaryRows.value : filteredPersonRankingRows.value
  const tsv = [
    columns.map((column) => column.label).join('\t'),
    ...rows.map((row) => columns.map((column) => row[column.key] ?? '').join('\t')),
  ].join('\n')
  const copied = await copyText(tsv)
  showCopyMessage(copied ? '表格已复制' : '复制失败，请重试')
}

function cellTitle(column, row) {
  const value = displayColumn(column.key, row[column.key], row)
  return copyableColumnKeys.has(column.key) ? `点击复制：${value}` : value
}

async function copyCell(column, row) {
  const rawValue = row[column.key]
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    showCopyMessage('暂无内容可复制')
    return
  }
  const copied = await copyText(displayColumn(column.key, rawValue, row))
  showCopyMessage(copied ? `已复制：${column.label}` : '复制失败，请重试')
}

async function copyText(value) {
  const text = String(value)
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the textarea fallback for non-secure or restricted browsers.
  }
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

function showCopyMessage(message) {
  copyMessage.value = message
  if (copyMessageTimer) clearTimeout(copyMessageTimer)
  copyMessageTimer = setTimeout(() => {
    copyMessage.value = ''
    copyMessageTimer = null
  }, 1600)
}

function requestParams() {
  return {
    ...filterParams(),
    limit: pageSize.value,
    offset: page.value * pageSize.value,
  }
}

function filterParams() {
  const params = {
    groupName: filters.groupName || undefined,
    issueLevel: filters.issueLevel || undefined,
    issueType: filters.issueType || undefined,
    ...(filters.issueStatus ? { issueStatus: filters.issueStatus } : {}),
    ...(filters.reviewStatus ? { reviewStatus: filters.reviewStatus } : {}),
    sandbox: filters.sandbox === '' ? undefined : filters.sandbox === 'true',
    ...(filters.issueId ? { issueId: filters.issueId } : {}),
    ...(filters.developer ? { developer: filters.developer } : {}),
    ...(filters.bankOwner ? { bankOwner: filters.bankOwner } : {}),
    ...(filters.cooperationPerson ? { cooperationPerson: filters.cooperationPerson } : {}),
    ...(filters.serialNo ? { serialNo: filters.serialNo } : {}),
    ...(filters.globalSerialNo ? { globalSerialNo: filters.globalSerialNo } : {}),
    ...(filters.defectRepairDate ? { defectRepairDate: filters.defectRepairDate } : {}),
    ...(filters.coverageRound ? { coverageRound: filters.coverageRound } : {}),
    ...(filters.weeklyTask ? { weeklyTask: true } : {}),
    keyword: filters.keyword || undefined,
  }
  Object.entries(headerFilterConfig).forEach(([key, [, requestKey]]) => {
    if (headerFilters[key]?.length) params[requestKey] = headerFilters[key]
  })
  return params
}

async function openHeaderFilter(column, event) {
  activeHeaderColumn.value = column
  headerFilterSearch.value = ''
  headerFilterDraft.value = [...(headerFilters[column.key] || [])]
  headerFilterAnchor = event?.currentTarget || null
  positionHeaderFilter()
  headerFilterOpen.value = true
  await loadHeaderFilterOptions()
}

function positionHeaderFilter() {
  const rect = headerFilterAnchor?.getBoundingClientRect?.()
  if (rect) {
    const width = Math.min(300, window.innerWidth - 24)
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
    const estimatedHeight = Math.min(430, window.innerHeight - 170)
    const below = rect.bottom + 8
    const top = below + estimatedHeight <= window.innerHeight - 12
      ? below
      : Math.max(12, rect.top - estimatedHeight - 8)
    headerFilterPanelStyle.left = `${left}px`
    headerFilterPanelStyle.top = `${top}px`
  }
}

async function loadHeaderFilterOptions() {
  if (!activeHeaderColumn.value) return
  const [field] = headerFilterConfig[activeHeaderColumn.value.key]
  headerFilterOptions.value = await getReplayIssueHeaderFilterOptions({ ...headerFilterParams(activeHeaderColumn.value.key), field, keyword: headerFilterSearch.value || undefined }) || []
}

function baseFilterParams() {
  return { groupName: filters.groupName || undefined, sandbox: filters.sandbox === '' ? undefined : filters.sandbox === 'true', issueId: filters.issueId || undefined, issueLevel: filters.issueLevel || undefined, issueType: filters.issueType || undefined, issueStatus: filters.issueStatus || undefined, reviewStatus: filters.reviewStatus || undefined, developer: filters.developer || undefined, bankOwner: filters.bankOwner || undefined, cooperationPerson: filters.cooperationPerson || undefined, serialNo: filters.serialNo || undefined, globalSerialNo: filters.globalSerialNo || undefined, defectRepairDate: filters.defectRepairDate || undefined, coverageRound: filters.coverageRound || undefined, weeklyTask: filters.weeklyTask || undefined }
}
function headerFilterParams(excludeKey) {
  const params = { ...baseFilterParams() }
  Object.entries(headerFilterConfig).forEach(([key, [, requestKey]]) => {
    if (key !== excludeKey && headerFilters[key]?.length) params[requestKey] = [...headerFilters[key]]
  })
  return params
}

function selectAllHeaderOptions() { headerFilterDraft.value = [...headerFilterOptions.value] }
function invertHeaderOptions() {
  const selected = new Set(headerFilterDraft.value)
  headerFilterDraft.value = headerFilterOptions.value.filter(option => !selected.has(option))
}
function closeHeaderFilter() {
  headerFilterOpen.value = false
  headerFilterAnchor = null
}
async function applyHeaderFilter() { headerFilters[activeHeaderColumn.value.key] = [...headerFilterDraft.value]; page.value = 0; closeHeaderFilter(); await loadList() }
async function clearHeaderFilter() { delete headerFilters[activeHeaderColumn.value.key]; page.value = 0; closeHeaderFilter(); await loadList() }

function canReviewGroup(row) {
  return (reviewPermissions.reviewableGroups || []).includes(row?.group_name)
}

function canEditPlanDate(row) {
  if (hasDefectRepairDate(row)) return false
  return (planDatePermissions.editableGroups || []).includes(row?.group_name)
}

function hasDefectRepairDate(row) {
  return String(row?.defect_repair_date || '').trim() !== ''
}

async function startPlanDateEdit(row) {
  if (!canEditPlanDate(row) || planDateSavingId.value != null) return
  editingPlanDateId.value = row.id
  planDateOriginal.value = String(row.planned_completion_date || '').trim()
  planDateDraft.value = planDateOriginal.value
  planDateError.value = ''
  await nextTick()
  document.querySelector(`[data-testid="plan-date-input-${row.id}"]`)?.focus()
}

function cancelPlanDateEdit() {
  editingPlanDateId.value = null
  planDateDraft.value = ''
  planDateOriginal.value = ''
  planDateError.value = ''
}

function validPlanDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

async function savePlanDate(row) {
  if (editingPlanDateId.value !== row.id || planDateSavingId.value === row.id) return
  if (hasDefectRepairDate(row)) {
    cancelPlanDateEdit()
    return
  }
  const draft = planDateDraft.value.trim()
  const normalized = draft || null
  const original = planDateOriginal.value || null
  if (normalized === original) {
    cancelPlanDateEdit()
    return
  }
  if (normalized && !validPlanDate(normalized)) {
    planDateError.value = '填写日期格式不合法，请按 2026-08-26 格式填写'
    return
  }
  planDateSavingId.value = row.id
  planDateError.value = ''
  try {
    const updated = await updateReplayIssuePlannedCompletionDate(row.id, normalized)
    row.planned_completion_date = updated?.plannedCompletionDate ?? updated?.planned_completion_date ?? normalized ?? ''
    cancelPlanDateEdit()
  } catch (cause) {
    planDateError.value = cause?.message || '计划验证日期保存失败'
  } finally {
    planDateSavingId.value = null
  }
}

function canReviewIssue(row) {
  if (canReviewGroup(row)) return true
  const transactionCode = String(row?.transaction_code || '').trim()
  return transactionCode !== '' && (reviewPermissions.reviewableTransactionCodes || [])
    .some(code => String(code || '').trim() === transactionCode)
}

function canEditIssue(row) {
  if (!row || row.issue_status === '已修复') return false
  if (row.issue_status === '无需处理' && row.review_status === '已审核' && !canReviewIssue(row)) return false
  return true
}

function editIssueTitle(row) {
  if (row?.issue_status === '已修复') return '已修复问题不可编辑'
  if (!canEditIssue(row)) return '仅限该问题科技负责人或对应组负责人编辑'
  return '编辑'
}

function reviewActionTitle(row) {
  if (canReviewIssue(row)) return '点击审核'
  const names = reviewerContactNames(row)
  return names.length ? `没有权限，请联系${names.join('、')}进行审核` : '没有审核权限'
}

function reviewerContactNames(row) {
  const names = []
  String(row?.matched_bank_owner || '').split('、').forEach((item) => {
    const name = item.replace(/[（(][^）)]*[）)]/g, '').trim()
    if (name && !names.includes(name)) names.push(name)
  })
  ;(reviewPermissions.reviewersByGroup?.[row?.group_name] || []).forEach((item) => {
    const name = String(item || '').trim()
    if (name && !names.includes(name)) names.push(name)
  })
  return names
}

async function approveReview(row) {
  if (!canReviewIssue(row)) {
    if (typeof window.alert === 'function') window.alert(reviewActionTitle(row))
    return
  }
  if (typeof window.confirm === 'function' && !window.confirm(`确认将 issue_id ${row.issue_id || '-'} 审核为“已审核”？`)) return
  try {
    await approveReplayIssue(row.id)
    await Promise.all([loadList({ preserveOnError: true }), loadMetadata()])
  } catch (cause) {
    error.value = `审核失败：${cause?.message || cause}`
  }
}

async function openEdit(row) {
  if (!canEditIssue(row)) return
  editIssue.value = row
  Object.assign(editDraft, {
    issueStatus: manualStatuses.includes(row.issue_status) ? row.issue_status : '',
    issueType: row.issue_type || '',
    initialAnalysis: row.initial_analysis || '',
    finalSolution: row.final_solution || '',
    cooperationPersonUsername: row.cooperation_person_username || '',
    cooperationPersonDisplay: row.cooperation_person_real_name && row.cooperation_person_username
      ? `${row.cooperation_person_real_name}(${row.cooperation_person_username})`
      : (row.cooperation_person_real_name || row.cooperation_person_username || ''),
    remark: row.remark || '',
  })
  Object.assign(editMailStatus, { status: 'UNSENT', sentAt: '', recipientEmail: '', failureMessage: '' })
  editMailRecipients.value = []
  collaboratorSelectionPending.value = false
  editUserOptions.value = []
  editError.value = ''
  editOpen.value = true
  try {
    const mail = await getReplayIssueMailStatus(row.id) || {}
    Object.assign(editMailStatus, mail)
    editMailRecipients.value = Array.isArray(mail.recipients) ? mail.recipients : []
  } catch {
    editMailStatus.status = 'UNSENT'
  }
}

function closeEdit() {
  if (savingId.value === editIssue.value?.id) return
  editOpen.value = false
  editIssue.value = null
  editUserOptions.value = []
  editMailRecipients.value = []
  collaboratorSelectionPending.value = false
  editError.value = ''
}

async function searchEditUsers() {
  collaboratorSelectionPending.value = Boolean(editDraft.cooperationPersonDisplay.trim())
  editDraft.cooperationPersonUsername = ''
  if (!editDraft.cooperationPersonDisplay.trim()) {
    editUserOptions.value = []
    return
  }
  try {
    editUserOptions.value = await searchReplayIssueUsers(editDraft.cooperationPersonDisplay.trim())
  } catch (cause) {
    editUserOptions.value = []
    editError.value = `协同人检索失败：${cause?.message || cause}`
  }
}

function selectEditUser(user) {
  editDraft.cooperationPersonUsername = user.username
  editDraft.cooperationPersonDisplay = user.displayName
  editUserOptions.value = []
  collaboratorSelectionPending.value = true
}

async function saveEdit() {
  if (!editIssue.value) return
  if (!editDraft.issueType?.trim()) {
    editError.value = '问题类型为必填项，请先选择问题类型'
    return
  }
  if (editDraft.initialAnalysis.length > 500 || editDraft.finalSolution.length > 500 || editDraft.remark.length > 500) {
    editError.value = '初步问题分析、最终处理方案和备注不能超过500个字符'
    return
  }
  const viewport = document.querySelector('[data-testid="table-viewport"]')
  const scrollLeft = viewport?.scrollLeft || 0
  savingId.value = editIssue.value.id
  editError.value = ''
  try {
    const saved = await updateReplayIssue(editIssue.value.id, {
      issueStatus: editDraft.issueStatus || null,
      issueType: editDraft.issueType,
      initialAnalysis: editDraft.initialAnalysis,
      finalSolution: editDraft.finalSolution,
      cooperationPersonUsername: editDraft.cooperationPersonUsername || null,
      remark: editDraft.remark,
    })
    if (!['修复待验证', '无需处理'].includes(saved?.issue_status)
        && !['修复待验证', '无需处理'].includes(editDraft.issueStatus)) {
      const mail = await getReplayIssueMailStatus(editIssue.value.id) || {}
      editMailRecipients.value = Array.isArray(mail.recipients) ? mail.recipients : []
      const collaborator = editMailRecipients.value.find(recipient => recipient.role === '协同人')
      const needsPrompt = Boolean(collaborator?.email) && mailRecipientStatus(collaborator) !== 'SENT' && mailRecipientStatus(collaborator) !== 'SENDING'
      if (needsPrompt) {
        Object.assign(mailPrompt, {
          issueId: saved?.issue_id || editIssue.value.issue_id || '-',
          collaboratorName: collaborator.displayName || collaborator.username || '协同人',
          collaboratorEmail: collaborator.email,
        })
        mailPromptChoice.value = 'no'
        mailPromptError.value = ''
        mailPromptOpen.value = true
        savingId.value = null
        return
      }
    }
    savingId.value = null
    closeEdit()
    await Promise.all([loadList({ preserveOnError: true }), loadMetadata()])
    await nextTick()
    if (viewport) viewport.scrollLeft = scrollLeft
  } catch (cause) {
    editError.value = `保存失败：${cause?.message || cause}`
  } finally {
    savingId.value = null
  }
}

async function confirmMailPrompt() {
  if (!editIssue.value || !mailPromptOpen.value) return
  mailPromptError.value = ''
  mailPromptSending.value = true
  try {
    if (mailPromptChoice.value === 'yes') {
      const selectedEmails = editMailRecipients.value
        .filter(recipient => !['SENT', 'SENDING'].includes(mailRecipientStatus(recipient)))
        .map(recipient => recipient.email)
        .filter(Boolean)
      if (selectedEmails.length) {
        const sent = await sendReplayIssueMail(editIssue.value.id, selectedEmails)
        Object.assign(editMailStatus, sent || {})
        editMailRecipients.value = Array.isArray(sent?.recipients) ? sent.recipients : editMailRecipients.value
      }
    }
    mailPromptOpen.value = false
    closeEdit()
    await Promise.all([loadList({ preserveOnError: true }), loadMetadata()])
  } catch (cause) {
    mailPromptError.value = `邮件发送失败：${cause?.message || cause}`
  } finally {
    mailPromptSending.value = false
  }
}

async function openTracking(row) {
  trackingIssue.value = row
  trackingOpen.value = true
  trackingLoading.value = true
  trackingError.value = ''
  try {
    trackingGroups.value = await getReplayIssueRoundTracking(row.id) || []
  } catch (cause) {
    trackingGroups.value = []
    trackingError.value = `加载跟踪失败：${cause?.message || cause}`
  } finally {
    trackingLoading.value = false
  }
}

function closeTracking() {
  trackingOpen.value = false
}

function statusTransition(group) {
  return `${display(group.statusBefore)} → ${display(group.statusAfter)}`
}

function sourceDisplay(group) {
  if (!group.sourceSheet) return '-'
  return group.sourceRow ? `${group.sourceSheet} 第 ${group.sourceRow} 行` : group.sourceSheet
}

function collaboratorDisplay(event) {
  if (event.cooperationPersonRealName && event.cooperationPersonUsername) return `${event.cooperationPersonRealName}(${event.cooperationPersonUsername})`
  return event.cooperationPersonRealName || event.cooperationPersonUsername || '-'
}

function formatSnapshots(event) {
  return [event.beforeSnapshot ? `操作前：${event.beforeSnapshot}` : '操作前：-', event.afterSnapshot ? `操作后：${event.afterSnapshot}` : '操作后：-', event.incomingSnapshot ? `导入输入：${event.incomingSnapshot}` : '导入输入：-'].join('\n')
}

async function loadList({ preserveOnError = false } = {}) {
  loading.value = true
  error.value = ''
  try {
    const result = await listReplayIssues(requestParams())
    items.value = result.items || []
    total.value = result.total || 0
  } catch (cause) {
    if (!preserveOnError) {
      items.value = []
      total.value = 0
    }
    error.value = `加载失败：${cause?.message || cause}`
    return false
  } finally {
    loading.value = false
  }
  return true
}

async function loadMetadata() {
  try {
    const [nextOptions, nextStats, rounds, permissions, nextPlanDatePermissions] = await Promise.all([getReplayIssueOptions(), getReplayIssueStats(), getReplayImportRounds(), getReplayIssueReviewPermissions(), getReplayIssuePlanDatePermissions()])
    Object.assign(options, nextOptions || {})
    options.coverageRounds = (nextOptions?.coverageRounds || (rounds || []).map((round) => round.roundCode)).filter(Boolean)
    options.issueStatuses = allStatuses
    options.reviewStatuses = nextOptions?.reviewStatuses || ['待审核', '已审核']
    Object.assign(stats, nextStats || {})
    Object.assign(reviewPermissions, permissions || { reviewableGroups: [], reviewersByGroup: {}, reviewableTransactionCodes: [] })
    Object.assign(planDatePermissions, nextPlanDatePermissions || { editableGroups: [] })
  } catch (cause) {
    error.value = `加载筛选项失败：${cause?.message || cause}`
  }
}

function query() {
  page.value = 0
  clearHeaderFilters()
  return loadList()
}

function clearHeaderFilters() {
  Object.keys(headerFilters).forEach((key) => delete headerFilters[key])
}

function toggleWeeklyTask() {
  page.value = 0
  return loadList()
}

async function exportExcel() {
  if (exporting.value) return
  exporting.value = true
  error.value = ''
  try {
    await exportReplayIssues(filterParams())
  } catch (cause) {
    error.value = `导出失败：${cause?.message || cause}`
  } finally {
    exporting.value = false
  }
}

function resetFilters() {
  Object.assign(filters, { groupName: '', issueId: '', issueLevel: '', issueType: '', issueStatus: '', reviewStatus: '', sandbox: '', developer: '', bankOwner: '', cooperationPerson: '', serialNo: '', globalSerialNo: '', defectRepairDate: '', coverageRound: '', keyword: '', weeklyTask: false })
  return query()
}

async function openWeeklyTask() {
  weeklyTaskOpen.value = true
  weeklyTaskSearch.value = ''
  weeklyTaskToken.value = ''
  weeklyTaskError.value = ''
  try {
    Object.assign(weeklyTaskConfig, await getReplayWeeklyTask() || {})
    weeklyTaskDraft.value = [...(weeklyTaskConfig.batchNames || [])]
  } catch (cause) {
    weeklyTaskError.value = `加载失败：${cause?.message || cause}`
  }
}

function closeWeeklyTask() {
  if (!weeklyTaskSaving.value) weeklyTaskOpen.value = false
}

async function saveWeeklyTask() {
  if (weeklyTaskSaving.value || !weeklyTaskToken.value.trim()) return
  weeklyTaskSaving.value = true
  weeklyTaskError.value = ''
  try {
    const result = await replaceReplayWeeklyTask([...weeklyTaskDraft.value].sort(), weeklyTaskToken.value)
    Object.assign(weeklyTaskConfig, result || {})
    weeklyTaskDraft.value = [...(weeklyTaskConfig.batchNames || [])]
    weeklyTaskOpen.value = false
    page.value = 0
    await loadList()
  } catch (cause) {
    weeklyTaskError.value = `保存失败：${cause?.message || cause}`
  } finally {
    weeklyTaskSaving.value = false
  }
}

function clearWeeklyTask() {
  weeklyTaskDraft.value = []
  return saveWeeklyTask()
}

function goPrevious() {
  if (page.value === 0 || loading.value) return
  page.value -= 1
  return loadList()
}

function goNext() {
  if (page.value + 1 >= pageCount.value || loading.value) return
  page.value += 1
  return loadList()
}

function changePageSize(event) {
  pageSize.value = Number(event.target.value)
  page.value = 0
  return loadList()
}

function openImport() {
  importOpen.value = true
  importFile.value = null
  importToken.value = ''
  importReplayType.value = 'QUERY'
  importComplete.value = false
  importMessage.value = ''
  importError.value = false
}

function closeImport() {
  if (!importing.value) importOpen.value = false
}

function selectImportFile(event) {
  importFile.value = event.target.files?.[0] || null
  importComplete.value = false
  importMessage.value = ''
  importError.value = false
}

async function submitImport() {
  if (!importFile.value || importing.value || importComplete.value) return
  importing.value = true
  importMessage.value = ''
  importError.value = false
  try {
    const result = await importReplayIssues(importFile.value, importToken.value, importReplayType.value)
    importComplete.value = true
    importMessage.value = `导入完成：${result.inputRows ?? result.totalRows ?? 0} 条；新增 ${result.createdRows ?? 0} 条；更新 ${result.updatedRows ?? 0} 条；忽略 ${result.ignoredRows ?? 0} 条${result.coverageRound ? `；覆盖批次 ${result.coverageRound}` : ''}`
    page.value = 0
    await Promise.all([loadList(), loadMetadata()])
  } catch (cause) {
    importError.value = true
    importMessage.value = `导入失败：${cause?.message || cause}`
  } finally {
    importing.value = false
  }
}

async function openDailyReport() {
  dailyReportOpen.value = true
  dailyReportSelectedBatch.value = ''
  dailyReportError.value = ''
  dailyReportLoading.value = true
  try {
    const list = await getReplayDailyReportBatches() || []
    dailyReportBatches.value = Array.isArray(list) ? list : []
    const firstAvailable = dailyReportBatches.value.find((entry) => entry.available)
    if (firstAvailable) dailyReportSelectedBatch.value = firstAvailable.batchNo
  } catch (cause) {
    dailyReportBatches.value = []
    dailyReportError.value = `加载日报列表失败：${cause?.message || cause}`
  } finally {
    dailyReportLoading.value = false
  }
}

function closeDailyReport() {
  if (dailyReportDownloading.value) return
  dailyReportOpen.value = false
}

async function downloadSelectedDailyReport() {
  if (!dailyReportSelectedBatch.value || dailyReportDownloading.value) return
  dailyReportDownloading.value = true
  dailyReportError.value = ''
  try {
    await downloadReplayDailyReport(dailyReportSelectedBatch.value)
    closeDailyReport()
  } catch (cause) {
    dailyReportError.value = `下载失败：${cause?.message || cause}`
  } finally {
    dailyReportDownloading.value = false
  }
}

onMounted(() => {
  loadList()
  loadMetadata()
})

onBeforeUnmount(() => {
  if (copyMessageTimer) clearTimeout(copyMessageTimer)
})
</script>

<style scoped>
.replay-page {
  --replay-teal: #0d6672;
  --replay-row-alt: #eef7fb;
  --replay-content-gutter: 20px;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-primary, #1f2937);
  background: var(--bg-page, #f0f2f7);
}

.replay-toolbar, .replay-summary-actions-row, .replay-pager { flex: 0 0 auto; }

.replay-toolbar {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  background: var(--bg-card, #fff);
  border-bottom: 1px solid var(--border, #e8edf5);
}

.replay-toolbar h2, .replay-import-modal h3 { margin: 0; font-size: 18px; line-height: 24px; font-weight: 650; }
.replay-toolbar p, .replay-import-modal p { margin: 3px 0 0; color: var(--text-muted, #6b7280); font-size: 12px; line-height: 18px; }
.replay-toolbar-title { min-width: 0; display: flex; align-items: center; gap: 10px; }
.replay-toolbar-actions { display: flex; align-items: center; gap: 8px; }
.replay-query-toggle { color: var(--text-active, #3b5adb); border-color: var(--border, #d7dee8); background: var(--bg-card, #fff); }
.replay-query-toggle:hover, .replay-query-toggle:focus-visible { color: var(--btn-primary-text, #fff); border-color: var(--text-active, #3b5adb); background: var(--text-active, #3b5adb); }
.replay-query-panel { flex: 0 0 auto; overflow: visible; }
.replay-icon-button.replay-mobile-navigation { display: none; }

.replay-summary {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(var(--replay-summary-columns), minmax(0, 1fr));
  gap: 10px;
  padding: 12px var(--replay-content-gutter) 0;
}

.replay-summary-card {
  min-height: 62px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 8px 12px;
  border: 1px solid var(--border, #e8edf5);
  background: var(--bg-card, #fff);
  border-radius: 6px;
  position: relative;
  outline: none;
}
.replay-summary-card span { color: var(--text-muted, #6b7280); font-size: 12px; line-height: 16px; }
.replay-summary-card strong { font-size: 20px; line-height: 26px; font-variant-numeric: tabular-nums; }
.replay-summary-tooltip { position: absolute; z-index: 12; top: calc(100% + 6px); left: 0; min-width: 180px; display: none; padding: 9px 10px; border: 1px solid var(--border, #d7dee8); border-radius: 5px; background: var(--bg-card, #fff); box-shadow: 0 8px 20px rgba(13, 20, 36, .16); }
.replay-summary-card:hover .replay-summary-tooltip, .replay-summary-card:focus-visible .replay-summary-tooltip { display: grid; gap: 5px; }
.replay-summary-tooltip div { display: flex; justify-content: space-between; gap: 18px; font-size: 12px; line-height: 16px; }
.replay-summary-tooltip b { color: var(--text-primary, #1f2937); font-variant-numeric: tabular-nums; }
.replay-summary-actions-row { position: relative; z-index: 10; min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px var(--replay-content-gutter); border-bottom: 1px solid var(--border, #e8edf5); }
.replay-summary-actions-row-transparent { background: transparent; }
.replay-summary-entries { position: relative; min-width: 0; display: flex; align-items: center; gap: 10px; }
.replay-summary-right-actions { margin-left: auto; display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.replay-summary-entry { position: relative; min-height: 32px; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px; border: 1px solid var(--border, #d7dee8); border-radius: 4px; color: var(--text-secondary, #374151); background: var(--bg-card, #fff); cursor: default; outline: none; font-size: 12px; }
.replay-summary-entry:hover, .replay-summary-entry:focus-visible, .replay-summary-entry:focus-within { border-color: var(--text-active, #3b5adb); color: var(--text-active, #3b5adb); }
.replay-summary-entry-action { font: inherit; cursor: pointer; }
.replay-summary-modal-mask { position: fixed; z-index: 1000; inset: 0; display: grid; place-items: center; padding: 24px; background: rgba(13, 20, 36, .42); }
.replay-summary-modal { display: flex; flex-direction: column; max-height: calc(100vh - 48px); overflow: hidden; border: 1px solid var(--border, #d7dee8); border-radius: 12px; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: 0 24px 80px rgba(13, 20, 36, .3); }
.replay-summary-modal-group { width: min(80vw, 1200px); height: auto; }
.replay-summary-modal-person { width: min(90vw, 1500px); height: min(70vh, 640px); }
.replay-summary-modal > header { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--border, #d7dee8); }
.replay-summary-modal h3 { margin: 0; font-size: 16px; line-height: 22px; }
.replay-summary-modal-actions { display: flex; align-items: center; gap: 8px; }
.replay-person-ranking-tabs { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--border, #d7dee8); overflow-x: auto; }
.replay-person-ranking-tabs button { min-width: 82px; min-height: 32px; padding: 0 14px; border: 1px solid var(--border, #d7dee8); border-radius: 5px; color: var(--text-secondary, #374151); background: var(--bg-card, #fff); cursor: pointer; font: inherit; white-space: nowrap; }
.replay-person-ranking-tabs button:hover, .replay-person-ranking-tabs button:focus-visible { border-color: var(--text-active, #3b5adb); color: var(--text-active, #3b5adb); outline: none; }
.replay-person-ranking-tabs button.is-active { border-color: var(--text-active, #3b5adb); color: var(--text-active, #3b5adb); background: color-mix(in srgb, var(--text-active, #3b5adb) 8%, var(--bg-card, #fff)); font-weight: 600; }
.replay-summary-table-wrap { min-height: 0; overflow: auto; }
.replay-summary-table { width: 100%; border-collapse: collapse; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); font-size: 12px; font-variant-numeric: tabular-nums; }
.replay-summary-table th, .replay-summary-table td { min-width: 88px; padding: 7px 9px; border: 1px solid var(--border, #d7dee8); text-align: right; white-space: nowrap; }
.replay-summary-table th { position: sticky; top: 0; z-index: 1; color: #fff; background: var(--replay-teal); }
.replay-summary-table th.is-pending-segment { background: #b86f18; }
.replay-summary-table th.is-fixed-segment { background: #2f855a; }
.replay-summary-table th.is-pending-segment.is-segment-total { background: #92540f; }
.replay-summary-table th.is-fixed-segment.is-segment-total { background: #216b45; }
.replay-summary-table td.is-pending-segment { background: #fff8eb; }
.replay-summary-table td.is-fixed-segment { background: #eefaf2; }
.replay-summary-table td.is-pending-segment.is-segment-total { color: #7a430a; background: #ffefcf; font-weight: 700; }
.replay-summary-table td.is-fixed-segment.is-segment-total { color: #175c39; background: #dff5e8; font-weight: 700; }
.replay-summary-table th:first-child, .replay-summary-table td:first-child { text-align: left; }
.replay-person-ranking-table th:nth-child(3), .replay-person-ranking-table td:nth-child(3) { min-width: 250px; text-align: left; white-space: normal; overflow-wrap: anywhere; }
.replay-summary-state { margin: 0; padding: 18px; color: var(--text-muted, #6b7280); text-align: center; }
.replay-field-label { position: relative; display: flex !important; align-items: center; justify-content: flex-start !important; width: 100%; gap: 2px !important; }
.replay-field-label > em { margin-left: auto; }
.replay-field-help-trigger { color: var(--text-secondary, #687386); cursor: help; outline: none; }
.replay-field-help-trigger:hover, .replay-field-help-trigger:focus-visible { color: var(--accent, #2563eb); }
.replay-field-help-tooltip { position: absolute; z-index: 30; left: 0; top: calc(100% + 7px); display: none; width: min(520px, calc(100vw - 64px)); max-height: 260px; overflow: auto; padding: 10px 12px; border: 1px solid var(--border, #d7dee8); border-radius: 5px; background: var(--bg-card, #fff); color: var(--text-primary, #1f2937); box-shadow: 0 10px 24px rgba(13, 20, 36, .2); font-size: 12px; font-weight: 400; line-height: 1.65; white-space: normal; }
.replay-field-help-trigger:hover + .replay-field-help-tooltip, .replay-field-help-trigger:focus-visible + .replay-field-help-tooltip { display: block; }

.replay-import-modal label { display: grid; gap: 4px; color: var(--text-secondary, #374151); font-size: 12px; line-height: 16px; }
.replay-import-modal input {
  height: 32px;
  border: 1px solid var(--border, #e8edf5);
  border-radius: 4px;
  padding: 0 9px;
  color: var(--text-primary, #1f2937);
  background: var(--bg-input, #fff);
  font: inherit;
}

.replay-button, .replay-icon-button {
  min-height: 32px;
  border: 1px solid var(--border, #e8edf5);
  border-radius: 4px;
  color: var(--text-secondary, #374151);
  background: var(--bg-action-btn, #fff);
  cursor: pointer;
  font: inherit;
}
.replay-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 11px; white-space: nowrap; }
.replay-button-compact { min-height: 27px; padding: 0 7px; font-size: 11px; }
.replay-icon-button { width: 32px; min-width: 32px; display: inline-grid; place-items: center; padding: 0; }
.replay-button-primary { border-color: var(--text-active, #3b5adb); color: var(--btn-primary-text, #fff); background: var(--text-active, #3b5adb); }
.replay-button-danger { border-color: #b42318; color: #fff; background: #b42318; }
.replay-button-weekly { border-color: #d69e2e; color: #744210; background: #fffaf0; }
.replay-button-weekly:hover { border-color: #b7791f; background: #fef3c7; }
.replay-weekly-task-filter { display: inline-flex; align-items: center; min-width: 126px; color: var(--text-secondary, #374151); }
.replay-checkbox-line { min-height: 30px; display: flex; align-items: center; gap: 7px; font-size: 13px; white-space: nowrap; }
.replay-summary-right-actions .replay-checkbox-line input { width: 15px; height: 15px; margin: 0; accent-color: #b7791f; }
.replay-button-secondary { border-color: var(--text-active, #3b5adb); color: var(--text-active, #3b5adb); background: var(--bg-card, #fff); }
.replay-button-secondary:hover, .replay-button-secondary:focus-visible { color: var(--btn-primary-text, #fff); background: var(--text-active, #3b5adb); }
.replay-loading-status { margin: 8px 0; color: var(--text-muted, #6b7280); font-size: 12px; }
.replay-empty-tip { margin: 12px 0; padding: 14px; border: 1px dashed var(--border, #d7dee8); border-radius: 4px; color: var(--text-muted, #6b7280); font-size: 12px; line-height: 18px; text-align: center; }
.replay-daily-report-picker { display: grid; gap: 6px; margin: 8px 0; color: var(--text-secondary, #374151); font-size: 12px; }
.replay-daily-report-picker select { min-height: 32px; border: 1px solid var(--border, #e8edf5); border-radius: 4px; padding: 0 9px; background: var(--bg-input, #fff); font: inherit; }
.replay-daily-report-error { color: #b42318; font-size: 12px; }
.replay-daily-report-modal { max-width: 480px; }
.replay-button:disabled, .replay-icon-button:disabled { cursor: not-allowed; opacity: .48; }

.replay-table-viewport {
  position: relative;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  height: 0;
  overflow-x: auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 var(--replay-content-gutter);
}
.replay-table-viewport-aligned { scrollbar-gutter: stable; }
.replay-table { min-width: 3000px; table-layout: fixed; border-collapse: separate; border-spacing: 0; width: max(100%, 3000px); margin: 0; font-size: 12px; }
.replay-table th > span, .replay-table th > svg { vertical-align: middle; }
.replay-table th > svg { margin-left: 4px; opacity: .82; }
.replay-table thead th { position: sticky; top: 0; z-index: 3; background: var(--replay-teal); color: #fff; background-clip: padding-box; }
.replay-column-header { position: relative; }
.replay-header-filter-button { display: inline-grid; place-items: center; width: 18px; height: 18px; margin-left: 3px; padding: 0; border: 0; background: transparent; cursor: pointer; vertical-align: middle; }
.replay-header-filter-button i { display: block; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 7px solid #e9fff9; filter: drop-shadow(0 0 1px rgba(0,0,0,.7)); }
.replay-header-filter-button:hover i, .replay-header-filter-button:focus-visible i { border-top-color: #fff; }
.replay-header-filter-button.active i { border-top-color: #ffd166; }
.replay-header-filter-button:focus-visible { outline: 1px solid #fff; outline-offset: 1px; }
.replay-header-filter-panel { position: fixed; z-index: 1500; width: min(280px, calc(100vw - 24px)); max-height: min(360px, calc(100vh - 170px)); display: grid; grid-template-rows: auto minmax(150px, 1fr) auto; gap: 6px; padding: 8px; border: 1px solid #8e8e8e; border-radius: 3px; color: #222; background: #454545; box-shadow: 0 8px 22px rgba(0, 0, 0, .32); }
.replay-header-filter-panel > header, .replay-header-filter-panel > footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.replay-header-filter-panel > header { padding: 0 2px; color: #fff; }
.replay-header-filter-panel > header strong { font-size: 13px; }
.replay-header-filter-content { min-height: 0; display: grid; grid-template-rows: auto auto minmax(78px, 1fr); gap: 5px; padding: 7px; border: 0; border-radius: 4px; background: #454545; }
.replay-header-filter-panel > input { width: 100%; height: 28px; padding: 0 8px; border: 1px solid #777; border-radius: 3px; color: #eee; background: #555; font: inherit; }
.replay-header-filter-search { display: flex; gap: 5px; }
.replay-header-filter-search input { flex: 1; min-width: 0; height: 28px; padding: 0 8px; border: 1px solid #777; border-radius: 3px; color: #eee; background: #555; font: inherit; }
.replay-header-filter-search button { width: 28px; border: 1px solid #42b883; border-radius: 3px; color: #fff; background: #42b883; cursor: pointer; }
.replay-header-filter-actions { display: flex; gap: 6px; }
.replay-header-filter-actions button { padding: 3px 7px; border: 0; color: #ddd; background: transparent; cursor: pointer; font-size: 11px; }
.replay-header-filter-options { min-height: 0; overflow: auto; display: grid; align-content: start; gap: 1px; padding: 3px; border-radius: 3px; background: #555; }
.replay-header-filter-options label { display: flex; align-items: flex-start; gap: 6px; min-height: 23px; padding: 3px 4px; border-radius: 3px; color: #eee; font-size: 12px; line-height: 1.35; cursor: pointer; }
.replay-header-filter-options label:hover { background: #666; }
.replay-header-filter-options label span { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
.replay-header-filter-options input { flex: 0 0 auto; margin-top: 2px; accent-color: #42d1a5; }
.replay-header-filter-options p { margin: 12px 4px; color: #bbb; text-align: center; font-size: 12px; }
.replay-header-filter-panel > footer { padding-top: 5px; border-top: 1px solid #666; }
.replay-header-filter-footer-spacer { flex: 1; }
.replay-header-filter-clear { color: #ffcf8a !important; }
.replay-header-filter-panel .replay-button { min-height: 25px; border-color: #777; color: #eee; background: #555; }
.replay-header-filter-panel .replay-button-primary { border-color: #42b883; color: #fff; background: #42b883; }
.replay-table th, .replay-table td { height: 34px; padding: 7px 10px; text-align: left; vertical-align: middle; border-right: 1px solid var(--border, #e8edf5); border-bottom: 1px solid var(--border, #e8edf5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.replay-table td.replay-person-cell { height: 34px; min-height: 34px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: normal; }
.replay-table th:first-child, .replay-table td:first-child { border-left: 1px solid var(--border, #e8edf5); }
.replay-table tbody tr:nth-child(even) td { background: var(--replay-row-alt); }
.replay-table tbody tr:nth-child(odd) td { background: var(--bg-card, #fff); }
.replay-table tbody tr.replay-weekly-task-row td { background: #fff8df; }
.replay-table tbody tr.replay-weekly-task-row:hover td { background: #ffefb3; }
.replay-table tbody tr.replay-weekly-task-row td:first-child { box-shadow: inset 4px 0 0 #d69e2e; }
.replay-weekly-task-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border: 1px solid #e7bd55; border-radius: 999px; color: #744210; background: #fff3c4; font-size: 12px; font-weight: 650; }
.replay-review-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 58px; padding: 3px 8px; border: 1px solid transparent; border-radius: 999px; font: inherit; font-size: 12px; font-weight: 650; white-space: nowrap; }
button.replay-review-badge { cursor: pointer; }
.replay-review-badge.is-pending { color: #8a4b08; border-color: #f0bd67; background: #fff4d6; }
.replay-review-badge.is-pending:hover { border-color: #d68a1f; background: #ffe7ad; }
.replay-review-badge.is-approved { color: #166534; border-color: #86d3a0; background: #e8f8ed; }
.replay-plan-date-cell { min-width: 0; display: flex; align-items: center; font-variant-numeric: tabular-nums; }
.replay-plan-date-emphasis { color: #cf1124; }
.replay-plan-date-emphasis.is-repair-date-locked { color: var(--text-muted, #8c94a6); cursor: not-allowed; }
.replay-plan-date-edit { width: 100%; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 5px; padding: 2px 3px; border: 0; border-radius: 3px; color: inherit; background: transparent; font: inherit; cursor: text; }
.replay-plan-date-edit span { overflow: hidden; text-overflow: ellipsis; }
.replay-plan-date-edit svg { flex: 0 0 auto; color: var(--text-muted, #6b7280); opacity: 0; transition: opacity .14s ease; }
.replay-plan-date-edit:hover, .replay-plan-date-edit:focus-visible { background: var(--bg-domain-hover, #f5f7fa); outline: 1px solid var(--border, #d7dee8); }
.replay-plan-date-edit:hover svg, .replay-plan-date-edit:focus-visible svg { opacity: 1; }
.replay-plan-date-cell input { height: 26px; padding: 3px 5px; font-variant-numeric: tabular-nums; }
.replay-plan-date-toast { color: #fff; background: #b42318; }
.replay-copyable-cell { cursor: copy; }
.replay-copyable-cell:hover { background: var(--bg-domain-hover, #f5f7fa) !important; }
.replay-state { text-align: center !important; color: var(--text-muted, #6b7280); }
.replay-error { color: var(--c-error-code-text, #cf1124); }
.replay-manual-value { color: #cf1124; white-space: pre-wrap; overflow-wrap: anywhere; }
.replay-detail-value { color: #2563b8; white-space: pre-wrap; overflow-wrap: anywhere; }
.replay-operation-buttons { display: flex; align-items: center; gap: 5px; }
.replay-table td select, .replay-table td input, .replay-table td textarea { width: 100%; min-width: 0; border: 1px solid var(--border, #e8edf5); border-radius: 3px; padding: 4px 5px; color: inherit; background: var(--bg-input, #fff); font: inherit; }
.replay-table td textarea { min-height: 42px; resize: vertical; line-height: 16px; }
.replay-inline-control, .replay-issue-key-cell { display: flex; align-items: center; gap: 5px; min-width: 0; }
.replay-inline-control select { flex: 1 1 auto; }
.replay-save { flex: 0 0 auto; width: 26px; min-width: 26px; height: 26px; min-height: 26px; }
.replay-status-text { overflow: hidden; text-overflow: ellipsis; }
.replay-user-picker { position: relative; }
.replay-collaborator-control { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; }
.replay-collaborator-mail-status { min-width: 58px; text-align: right; }
.replay-mail-recipient-list { display: grid; gap: 6px; margin-top: 6px; }
.replay-mail-recipient-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; min-height: 34px; padding: 7px 9px; border: 1px solid var(--border, #e8edf5); border-radius: 4px; background: var(--bg-input, #fff); }
.replay-mail-recipient-main { min-width: 0; display: grid; gap: 2px; }
.replay-mail-recipient-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.replay-mail-recipient-main small, .replay-mail-empty { color: var(--text-muted, #6b7280); font-size: 11px; }
.replay-mail-role { color: var(--text-muted, #6b7280); font-size: 11px; white-space: nowrap; }
.replay-mail-status { font-weight: 600; font-size: 12px; white-space: nowrap; cursor: help; }
.replay-mail-status.is-sent { color: #18864b; }
.replay-mail-status.is-pending, .replay-mail-status.is-failed { color: #b54708; }
.replay-mail-status.is-unsent { color: var(--text-muted, #6b7280); }
.replay-mail-error-hint { display: block; margin-top: 6px; color: #b42318; font-size: 11px; }
.replay-mail-prompt-mask { z-index: 45; }
.replay-mail-prompt { width: min(450px, 100%); display: grid; gap: 16px; padding: 20px; border: 1px solid var(--border, #e8edf5); border-radius: 6px; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: 0 16px 42px rgba(13, 20, 36, .24); }
.replay-mail-prompt header h3 { margin: 0; font-size: 16px; }
.replay-mail-prompt header p { margin: 5px 0 0; color: var(--text-muted, #6b7280); font-size: 12px; }
.replay-mail-prompt-content { display: grid; gap: 10px; font-size: 13px; }
.replay-mail-prompt-content strong { color: var(--text-primary, #1f2937); }
.replay-mail-prompt-content span { color: var(--text-secondary, #374151); overflow-wrap: anywhere; }
.replay-mail-prompt-content label { display: flex; align-items: center; gap: 8px; min-height: 30px; cursor: pointer; }
.replay-mail-prompt-content input { accent-color: var(--text-active, #3b5adb); }
.replay-user-options { position: absolute; z-index: 8; top: calc(100% + 2px); left: 0; right: 0; display: grid; max-height: 180px; overflow: auto; border: 1px solid var(--border, #e8edf5); background: var(--bg-card, #fff); box-shadow: 0 8px 18px rgba(13, 20, 36, .16); }
.replay-user-options button { border: 0; padding: 7px 8px; text-align: left; color: var(--text-primary, #1f2937); background: transparent; font: inherit; cursor: pointer; }
.replay-user-options button:hover { background: var(--replay-row-alt); }
.replay-drawer-mask { position: fixed; z-index: 1100; inset: 0; background: rgba(13, 20, 36, .28); }
.replay-tracking-drawer { position: absolute; top: 0; right: 0; width: min(470px, 100%); height: 100%; display: flex; flex-direction: column; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: -12px 0 32px rgba(13, 20, 36, .2); }
.replay-tracking-drawer > header { flex: 0 0 auto; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--border, #e8edf5); }
.replay-tracking-drawer h3 { margin: 0; font-size: 17px; line-height: 24px; }
.replay-tracking-drawer header p { margin: 3px 0 0; color: var(--text-muted, #6b7280); font-size: 12px; overflow-wrap: anywhere; }
.replay-timeline { min-height: 0; flex: 1 1 auto; overflow: auto; margin: 0; padding: 18px 20px 28px 34px; list-style: none; }
.replay-timeline > li { position: relative; padding: 0 0 16px 18px; border-left: 1px solid var(--border, #d7dee8); }
.replay-timeline-marker { position: absolute; top: 2px; left: -5px; width: 9px; height: 9px; border: 2px solid var(--text-active, #3b5adb); border-radius: 50%; background: var(--bg-card, #fff); }
.replay-round-group { margin-top: 0 !important; border: 1px solid var(--border, #e8edf5); border-radius: 5px; background: var(--bg-card, #fff); }
.replay-round-summary { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 8px; padding: 10px; color: var(--text-primary, #1f2937) !important; }
.replay-round-summary strong { min-width: 0; overflow-wrap: anywhere; }
.replay-round-summary time { color: var(--text-muted, #6b7280); font-size: 11px; white-space: nowrap; }
.replay-current-round { padding: 2px 6px; border-radius: 3px; color: var(--text-active, #3b5adb); background: var(--bg-active, #edf1ff); font-size: 10px; white-space: nowrap; }
.replay-round-body { padding: 0 10px 10px; border-top: 1px solid var(--border, #e8edf5); }
.replay-round-section-title { margin: 9px 0 7px !important; color: var(--text-secondary, #374151) !important; font-size: 12px; font-weight: 600; }
.replay-event-heading { display: flex; justify-content: space-between; gap: 8px; }
.replay-event-heading time { color: var(--text-muted, #6b7280); font-size: 11px; white-space: nowrap; }
.replay-round-body > p { margin: 5px 0 9px; color: var(--text-secondary, #374151); font-size: 12px; }
.replay-timeline dl { display: grid; gap: 6px; margin: 0; }
.replay-timeline dl div { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 8px; }
.replay-timeline dt { color: var(--text-muted, #6b7280); }
.replay-timeline dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.replay-timeline details { margin-top: 9px; }
.replay-timeline summary { color: var(--text-active, #3b5adb); cursor: pointer; }
.replay-timeline pre { max-height: 180px; overflow: auto; margin: 7px 0 0; padding: 7px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-secondary, #374151); background: var(--bg-page, #f0f2f7); font: 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace; }
.replay-base-description { margin-bottom: 0 !important; }
.replay-manual-events > ol { display: grid; gap: 10px; margin: 9px 0 0; padding: 0; list-style: none; }
.replay-manual-events > ol > li { padding: 9px; border-left: 2px solid var(--border, #d7dee8); background: var(--bg-page, #f7f8fa); }
.replay-manual-events > ol > li > p { margin: 4px 0 8px; color: var(--text-muted, #6b7280); font-size: 11px; }
.replay-drawer-state { padding: 20px; color: var(--text-muted, #6b7280); }
.replay-copy-toast { position: fixed; z-index: 1200; left: 50%; bottom: 48px; transform: translateX(-50%); margin: 0; padding: 8px 18px; border: 1px solid var(--text-active, #3b5adb); border-radius: 5px; color: var(--text-active, #3b5adb); background: var(--bg-card, #fff); box-shadow: 0 4px 16px rgba(0, 0, 0, .15); font-size: 12px; }

.replay-pager { min-height: 52px; display: flex; align-items: center; justify-content: flex-end; gap: 14px; padding: 10px 20px; border-top: 1px solid var(--border, #e8edf5); background: var(--bg-card, #fff); color: var(--text-muted, #6b7280); font-size: 12px; }
.replay-pager label { display: inline-flex; align-items: center; gap: 6px; }
.replay-pager select { width: 66px; height: 30px; border: 1px solid var(--border, #e8edf5); border-radius: 4px; color: var(--text-primary, #1f2937); background: var(--bg-input, #fff); }
.replay-page-actions { display: flex; gap: 6px; }

.replay-modal-mask { position: fixed; z-index: 30; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(13, 20, 36, .42); }
.replay-weekly-task-modal { width: min(620px, 100%); max-height: min(720px, calc(100vh - 40px)); display: flex; flex-direction: column; border: 1px solid var(--border, #e8edf5); border-radius: 10px; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: 0 20px 55px rgba(13, 20, 36, .28); overflow: hidden; }
.replay-weekly-task-modal > header, .replay-weekly-task-modal > footer { display: flex; align-items: center; gap: 12px; padding: 16px 18px; }
.replay-weekly-task-modal > header { justify-content: space-between; border-bottom: 1px solid var(--border, #e8edf5); }
.replay-weekly-task-modal > header h3 { margin: 0; font-size: 18px; }
.replay-weekly-task-modal > header p { margin: 3px 0 0; color: var(--text-muted, #6b7280); font-size: 12px; }
.replay-weekly-task-modal > footer { border-top: 1px solid var(--border, #e8edf5); }
.replay-modal-spacer { flex: 1; }
.replay-weekly-task-body { min-height: 0; display: grid; gap: 12px; padding: 16px 18px; overflow: auto; }
.replay-weekly-task-body > label { display: grid; gap: 5px; color: var(--text-secondary, #374151); font-size: 12px; }
.replay-weekly-task-body input[type='password'] { min-height: 34px; padding: 6px 9px; border: 1px solid var(--border, #d7dee8); border-radius: 5px; }
.replay-weekly-task-search > div { display: flex; align-items: center; gap: 7px; padding: 0 9px; border: 1px solid var(--border, #d7dee8); border-radius: 5px; background: var(--bg-input, #fff); }
.replay-weekly-task-search input { width: 100%; min-height: 34px; border: 0; outline: 0; background: transparent; }
.replay-weekly-task-meta { display: flex; justify-content: space-between; gap: 12px; color: var(--text-muted, #6b7280); font-size: 12px; }
.replay-weekly-task-meta strong { color: #8a5b08; }
.replay-weekly-task-options { max-height: 300px; display: grid; gap: 2px; padding: 6px; border: 1px solid var(--border, #d7dee8); border-radius: 6px; overflow: auto; }
.replay-weekly-task-options label { display: flex; align-items: center; gap: 9px; min-height: 34px; padding: 5px 8px; border-radius: 4px; cursor: pointer; }
.replay-weekly-task-options label:hover { background: #fff8df; }
.replay-weekly-task-options input { width: 15px; height: 15px; accent-color: #b7791f; }
.replay-weekly-task-options p { margin: 14px; text-align: center; color: var(--text-muted, #6b7280); }
.replay-import-modal { width: min(460px, 100%); display: grid; gap: 16px; padding: 20px; border: 1px solid var(--border, #e8edf5); border-radius: 6px; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: 0 16px 42px rgba(13, 20, 36, .24); }
.replay-edit-modal { width: min(680px, 100%); display: grid; gap: 16px; padding: 20px; border: 1px solid var(--border, #e8edf5); border-radius: 6px; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: 0 16px 42px rgba(13, 20, 36, .24); }
.replay-edit-modal header, .replay-edit-modal footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.replay-edit-modal footer { justify-content: flex-end; }
.replay-edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px 14px; }
.replay-edit-grid label { display: grid; gap: 5px; color: var(--text-secondary, #374151); font-size: 12px; line-height: 16px; }
.replay-edit-grid label > span { display: flex; justify-content: space-between; gap: 8px; }
.replay-edit-grid em { color: var(--text-muted, #6b7280); font-style: normal; font-variant-numeric: tabular-nums; }
.replay-edit-wide { grid-column: 1 / -1; }
.replay-edit-grid select, .replay-edit-grid input, .replay-edit-grid textarea { width: 100%; border: 1px solid var(--border, #e8edf5); border-radius: 4px; padding: 7px 9px; color: var(--text-primary, #1f2937); background: var(--bg-input, #fff); font: inherit; }
.replay-required-mark { color: #b42318; font-style: normal; }
.replay-edit-grid .replay-invalid { border-color: #b42318; }
.replay-edit-grid textarea { min-height: 78px; resize: vertical; line-height: 18px; }
.replay-edit-error { margin: 0; color: var(--c-error-code-text, #cf1124); font-size: 12px; }
.replay-import-modal header, .replay-import-modal footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.replay-import-modal footer { justify-content: flex-end; }
.replay-import-type { display: flex; align-items: center; gap: 18px; margin: 0; padding: 10px 12px; border: 1px solid var(--border, #e8edf5); border-radius: 4px; }
.replay-import-type legend { padding: 0 4px; color: var(--text-secondary, #374151); font-size: 12px; }
.replay-import-type label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.replay-import-type input { width: 15px !important; height: 15px !important; margin: 0; padding: 0; accent-color: var(--replay-teal, #0f6b78); }
.replay-file-field small { color: var(--text-muted, #6b7280); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.replay-import-message { margin: 0 !important; padding: 8px 10px; border: 1px solid var(--border, #e8edf5); border-radius: 4px; background: var(--bg-badge, #f0f2f5); color: var(--text-secondary, #374151) !important; }
.replay-import-message.is-error { color: var(--c-error-code-text, #cf1124) !important; }

[data-theme="dark"] .replay-page { --replay-teal: #145c67; --replay-row-alt: rgba(126, 184, 255, .07); }

@media (max-width: 768px) {
  .replay-page { --replay-content-gutter: 12px; }
  .replay-toolbar, .replay-pager { padding-left: 12px; padding-right: 12px; }
  .replay-toolbar { min-height: auto; align-items: flex-start; flex-wrap: wrap; }
  .replay-toolbar-actions { width: 100%; justify-content: flex-end; }
  .replay-toolbar-title { width: 100%; }
  .replay-icon-button.replay-mobile-navigation { flex: 0 0 auto; display: inline-grid; }
  .replay-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .replay-summary-card { padding-left: 8px; padding-right: 8px; }
  .replay-summary-actions-row, .replay-summary-entries, .replay-summary-right-actions { flex-wrap: wrap; }
  .replay-summary-modal-mask { padding: 12px; }
  .replay-summary-modal, .replay-summary-modal-group, .replay-summary-modal-person { width: calc(100vw - 24px); max-height: calc(100vh - 24px); }
  .replay-summary-modal-group { height: auto; }
  .replay-summary-modal-person { height: min(70vh, 640px); }
  .replay-header-filter-panel { max-height: calc(100vh - 116px); }
  .replay-edit-grid { grid-template-columns: 1fr; }
  .replay-edit-wide { grid-column: auto; }
  .replay-pager { justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .replay-tracking-drawer { width: 100%; }
}
</style>
