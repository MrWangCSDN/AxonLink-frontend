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
        <button class="replay-button replay-button-danger" type="button" data-testid="open-full-refresh" @click="openFullRefresh">
          <RefreshCw :size="16" aria-hidden="true" />
          全量更新
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
          :title="queryPanelCollapsed ? '展开统计与查询' : '收起统计与查询'"
          :aria-label="queryPanelCollapsed ? '展开统计与查询' : '收起统计与查询'"
          :aria-expanded="String(!queryPanelCollapsed)"
          @click="queryPanelCollapsed = !queryPanelCollapsed"
        >
          <ChevronDown v-if="queryPanelCollapsed" :size="18" aria-hidden="true" />
          <ChevronUp v-else :size="18" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-if="!queryPanelCollapsed" class="replay-query-panel">
    <div class="replay-summary" aria-label="汇总数据">
      <div v-for="card in summaryCards" :key="card.key" class="replay-summary-card" tabindex="0">
        <span>{{ card.label }}</span><strong>{{ summaryValue(card) }}</strong>
        <div class="replay-summary-tooltip" role="tooltip">
          <div v-for="group in summaryGroups" :key="group"><span>{{ group }}</span><b>{{ groupSummary(card, group) }}</b></div>
        </div>
      </div>
    </div>

    <div class="replay-summary-entries" aria-label="问题明细汇总">
      <div
        class="replay-summary-entry"
        data-testid="group-summary-entry"
        tabindex="0"
        @mouseenter="openHoverSummary('group')"
        @mouseleave="closeHoverSummary('group', $event)"
        @focusin="openHoverSummary('group', $event)"
        @focusout="closeHoverSummary('group', $event)"
      >
        <BarChart3 :size="16" aria-hidden="true" />
        <span>各组问题数</span>
        <div v-if="activeHoverSummary === 'group'" class="replay-summary-panel replay-summary-panel-fixed replay-summary-panel-group" role="region" aria-label="各组问题数">
          <header>
            <h3>各组问题数</h3>
            <button class="replay-button replay-button-compact" type="button" data-testid="copy-group-summary" :disabled="groupSummaryLoading || !filteredGroupSummaryRows.length" @click.stop="copySummaryTable('group')">
              <Copy :size="13" aria-hidden="true" />复制表格
            </button>
          </header>
          <p v-if="groupSummaryLoading" class="replay-summary-state">正在查询…</p>
          <p v-else-if="groupSummaryError" class="replay-summary-state replay-error">{{ groupSummaryError }}</p>
          <div v-else class="replay-summary-table-wrap">
            <table class="replay-summary-table">
              <thead><tr><th v-for="column in groupSummaryColumns" :key="column.key" scope="col">{{ column.label }}</th></tr></thead>
              <tbody>
                <tr v-for="row in filteredGroupSummaryRows" :key="row.groupName"><td v-for="column in groupSummaryColumns" :key="column.key">{{ row[column.key] }}</td></tr>
                <tr v-if="!filteredGroupSummaryRows.length"><td :colspan="groupSummaryColumns.length">暂无数据</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div
        class="replay-summary-entry replay-summary-entry-person"
        data-testid="person-ranking-entry"
        tabindex="0"
        @mouseenter="openHoverSummary('person')"
        @mouseleave="closeHoverSummary('person', $event)"
        @focusin="openHoverSummary('person', $event)"
        @focusout="closeHoverSummary('person', $event)"
      >
        <Users :size="16" aria-hidden="true" />
        <span>各组开发负责人问题排名</span>
        <div v-if="activeHoverSummary === 'person'" class="replay-summary-panel replay-summary-panel-fixed replay-summary-panel-person" role="region" aria-label="各组开发负责人问题排名">
          <header>
            <h3>各组开发负责人问题排名</h3>
            <button class="replay-button replay-button-compact" type="button" data-testid="copy-person-ranking" :disabled="personRankingLoading || !filteredPersonRankingRows.length" @click.stop="copySummaryTable('person')">
              <Copy :size="13" aria-hidden="true" />复制表格
            </button>
          </header>
          <p v-if="personRankingLoading" class="replay-summary-state">正在查询…</p>
          <p v-else-if="personRankingError" class="replay-summary-state replay-error">{{ personRankingError }}</p>
          <div v-else class="replay-summary-table-wrap">
            <table class="replay-summary-table replay-person-ranking-table">
              <thead><tr><th v-for="column in personRankingColumns" :key="column.key" scope="col">{{ column.label }}</th></tr></thead>
              <tbody>
                <tr v-for="row in filteredPersonRankingRows" :key="`${row.groupName}-${row.rank}-${row.developer}`"><td v-for="column in personRankingColumns" :key="column.key">{{ row[column.key] }}</td></tr>
                <tr v-if="!filteredPersonRankingRows.length"><td :colspan="personRankingColumns.length">暂无数据</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <form class="replay-filters" @submit.prevent="query">
      <label>
        <span>领域</span>
        <select v-model="filters.groupName" data-testid="group-filter">
          <option value="">全部</option>
          <option v-for="group in options.groups" :key="group" :value="group">{{ group }}</option>
        </select>
      </label>
      <label>
        <span>是否沙箱</span>
        <select v-model="filters.sandbox" data-testid="sandbox-filter">
          <option value="">全部</option>
          <option value="true">是</option>
          <option value="false">否</option>
        </select>
      </label>
      <label>
        <span>问题级别</span>
        <select v-model="filters.issueLevel" data-testid="issue-level-filter">
          <option value="">全部</option>
          <option v-for="level in options.issueLevels" :key="level" :value="level">{{ level }}</option>
        </select>
      </label>
      <label>
        <span>问题类型</span>
        <select v-model="filters.issueType" data-testid="issue-type-filter">
          <option value="">全部</option>
          <option v-for="type in options.issueTypes" :key="type" :value="type">{{ type }}</option>
        </select>
      </label>
      <label>
        <span>问题状态</span>
        <select v-model="filters.issueStatus" data-testid="issue-status-filter">
          <option value="">全部</option>
          <option v-for="status in options.issueStatuses" :key="status" :value="status">{{ status }}</option>
        </select>
      </label>
      <label>
        <span>开发负责人</span>
        <input v-model.trim="filters.developer" data-testid="developer-filter" type="search" placeholder="模糊查询" />
      </label>
      <label>
        <span>科技负责人</span>
        <input v-model.trim="filters.bankOwner" data-testid="bank-owner-filter" type="search" placeholder="模糊查询" />
      </label>
      <label>
        <span>需协同人</span>
        <input v-model.trim="filters.cooperationPerson" data-testid="cooperation-person-filter" type="search" placeholder="姓名或账号" />
      </label>
      <label>
        <span>流水号</span>
        <input v-model.trim="filters.serialNo" data-testid="serial-no-filter" type="search" placeholder="模糊查询" />
      </label>
      <label>
        <span>全局流水号</span>
        <input v-model.trim="filters.globalSerialNo" data-testid="global-serial-no-filter" type="search" placeholder="模糊查询" />
      </label>
      <label>
        <span>缺陷修复日期</span>
        <input v-model="filters.defectRepairDate" data-testid="defect-repair-date-filter" type="date" />
      </label>
      <label>
        <span>出现批次</span>
        <select v-model="filters.coverageRound" data-testid="coverage-round-filter">
          <option value="">全部</option>
          <option v-for="round in options.coverageRounds" :key="round" :value="round">{{ round }}</option>
        </select>
      </label>
      <label class="replay-keyword-field">
        <span>关键词</span>
        <input v-model.trim="filters.keyword" data-testid="keyword-filter" type="search" placeholder="交易码、名称或问题描述" />
      </label>
      <button class="replay-button replay-button-primary" type="button" data-testid="query-button" :disabled="loading" @click="query">
        <Search :size="16" aria-hidden="true" />
        查询
      </button>
      <button class="replay-icon-button" type="button" title="重置筛选" aria-label="重置筛选" @click="resetFilters">
        <RotateCcw :size="16" aria-hidden="true" />
      </button>
    </form>
    </div>

    <div class="replay-table-viewport" data-testid="table-viewport">
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
          <tr v-for="row in items" :key="row.id" data-testid="replay-row">
            <td
              v-for="column in columns"
              :key="column.key"
              :class="{ 'replay-copyable-cell': copyableColumnKeys.has(column.key), 'replay-person-cell': column.key === 'matched_developer' || column.key === 'matched_bank_owner' }"
              :title="cellTitle(column, row)"
              @click="copyableColumnKeys.has(column.key) && copyCell(column, row)"
            >
              <div v-if="column.key === 'operation'" class="replay-operation-buttons">
                <button class="replay-button replay-button-compact" type="button" :data-testid="`edit-${row.id}`" :disabled="row.issue_status === '已修复'" :title="row.issue_status === '已修复' ? '已修复问题不可编辑' : '编辑'" @click="openEdit(row)"><Pencil :size="13" aria-hidden="true" />编辑</button>
                <button class="replay-button replay-button-compact" type="button" :data-testid="`tracking-${row.id}`" @click="openTracking(row)"><HistoryIcon :size="13" aria-hidden="true" />问题跟踪</button>
              </div>
              <span v-else-if="manualDisplayKeys.has(column.key)" class="replay-manual-value">{{ displayColumn(column.key, row[column.key], row) }}</span>
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

    <div v-if="importOpen" class="replay-modal-mask" @click.self="!importing && closeImport()">
      <section class="replay-import-modal" role="dialog" aria-modal="true" aria-labelledby="replay-import-title">
        <header>
          <div>
            <h3 id="replay-import-title">导入回放问题</h3>
            <p>上传 Excel 文件后将按 issue_key 合并问题状态。</p>
          </div>
          <button class="replay-icon-button" type="button" title="关闭导入窗口" aria-label="关闭导入窗口" :disabled="importing" @click="closeImport"><X :size="16" aria-hidden="true" /></button>
        </header>
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

    <div v-if="fullRefreshOpen" class="replay-modal-mask" @click.self="!fullRefreshing && closeFullRefresh()">
      <section class="replay-import-modal replay-full-refresh-modal" role="dialog" aria-modal="true" aria-labelledby="replay-full-refresh-title" data-testid="full-refresh-modal">
        <header>
          <div>
            <h3 id="replay-full-refresh-title">全量更新基础数据</h3>
            <p class="replay-danger-copy">仅处理 Excel 第一个 Sheet，按 issue_key 覆盖匹配数据；未匹配数据新增，其他已有数据和历史记录保留。</p>
          </div>
          <button class="replay-icon-button" type="button" title="关闭全量更新窗口" aria-label="关闭全量更新窗口" :disabled="fullRefreshing" @click="closeFullRefresh"><X :size="16" aria-hidden="true" /></button>
        </header>
        <label class="replay-file-field">
          <span>Excel 文件</span>
          <input data-testid="full-refresh-file" type="file" accept=".xlsx,.xls" :disabled="fullRefreshing" @change="selectFullRefreshFile" />
          <small>{{ fullRefreshFile?.name || '请选择要处理的 Excel 文件，仅导入第一个 Sheet' }}</small>
        </label>
        <label>
          <span>导入口令</span>
          <input v-model="fullRefreshToken" data-testid="full-refresh-token" type="password" autocomplete="off" :disabled="fullRefreshing" placeholder="X-DII-Trigger-Token" />
        </label>
        <label class="replay-destructive-confirm">
          <input v-model="fullRefreshConfirmed" data-testid="full-refresh-confirm" type="checkbox" :disabled="fullRefreshing" />
          <span>我确认按 issue_key 覆盖或新增首个 Sheet 数据</span>
        </label>
        <p v-if="fullRefreshMessage" class="replay-import-message" :class="{ 'is-error': fullRefreshError }">{{ fullRefreshMessage }}</p>
        <footer>
          <button class="replay-button" type="button" :disabled="fullRefreshing" @click="closeFullRefresh">取消</button>
          <button class="replay-button replay-button-danger" type="button" data-testid="submit-full-refresh" :disabled="!fullRefreshFile || !fullRefreshToken.trim() || !fullRefreshConfirmed || fullRefreshing || fullRefreshComplete" @click="submitFullRefresh">
            <RefreshCw :size="16" aria-hidden="true" />
            {{ fullRefreshing ? '更新中…' : (fullRefreshComplete ? '已更新' : '确认全量更新') }}
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
            <select v-model="editDraft.issueStatus" data-testid="edit-status">
              <option value="" disabled>{{ editIssue && !manualStatuses.includes(editIssue.issue_status) ? `当前：${display(editIssue.issue_status)}，请选择` : '请选择状态' }}</option>
              <option v-for="status in manualStatuses" :key="status" :value="status">{{ status }}</option>
            </select>
          </label>
          <label>
            <span>问题类型 <em class="replay-required-mark">*</em></span>
            <select v-model="editDraft.issueType" data-testid="edit-type" :class="{ 'replay-invalid': editError && !editDraft.issueType }">
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
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Download, HelpCircle, History as HistoryIcon, Menu, Pencil, RefreshCw, RotateCcw, Save, Search, Upload, Users, X } from 'lucide-vue-next'
import { exportReplayIssues, fullRefreshReplayIssues, getReplayImportRounds, getReplayIssueGroupSummaries, getReplayIssueHeaderFilterOptions, getReplayIssueMailStatus, getReplayIssueOptions, getReplayIssuePersonRankings, getReplayIssueRoundTracking, getReplayIssueStats, importReplayIssues, listReplayIssues, searchReplayIssueUsers, sendReplayIssueMail, updateReplayIssue } from '../../api/replayIssues.js'

defineEmits(['toggleNavigation'])

const columns = [
  ['domain', '领域', 'calc(4em + 20px)'], ['issue_id', 'issue_id', '112px'], ['is_sandbox', '是否沙箱', 'calc(4em + 20px)'],
  ['transaction_code', '交易码', 'calc(4em + 20px)'], ['transaction_name', '交易名称', '180px'], ['issue_level', '问题级别', '100px'],
  ['field_name', '字段名', '120px'], ['serial_no', '流水号', '160px'], ['global_serial_no', '全局流水号', '180px'], ['issue_description', '问题描述', '220px'],
  ['matched_developer', '开发负责人', '10em'], ['matched_bank_owner', '科技负责人', '10em'], ['operation', '操作', '176px'], ['issue_status', '问题状态', '132px'], ['issue_type', '问题类型', '132px'], ['initial_analysis', '初步问题分析', '220px'],
  ['final_solution', '最终处理方案', '220px'], ['cooperation_person_username', '需协同人', '180px'], ['remark', '备注', '160px'], ['batch_no', '批次', '220px'],
  ['import_date', '导入时间', '108px'], ['registered_date', '登记时间', '108px'], ['defect_repair_date', '缺陷修复日期', '120px'],
  ['affected_transaction_count', '该问题出现在的交易笔数', '176px'],
  ['issue_key', 'issue_key', '180px'], ['historical_occurrence_count', '历史出现次数', '128px'],
  ['first_occurrence_date', '首次出现日期', '180px'], ['last_occurrence_date', '上次出现日期', '180px'],
  ['occurrence_rounds', '出现批次', '220px'],
].map(([key, label, width]) => ({ key, label, width }))

const headerFilterConfig = {
  transaction_code: ['transactionCode', 'transactionCodes'], issue_level: ['issueLevel', 'issueLevels'],
  matched_developer: ['developer', 'developers'], matched_bank_owner: ['bankOwner', 'bankOwners'],
  issue_status: ['issueStatus', 'issueStatuses'], issue_type: ['issueType', 'issueTypes'],
  cooperation_person_username: ['cooperationPerson', 'cooperationPersons'],
  occurrence_rounds: ['occurrenceBatch', 'occurrenceBatches'],
}
const headerFilters = reactive({})
const headerFilterOpen = ref(false)
const activeHeaderColumn = ref(null)
const headerFilterPanelStyle = reactive({ top: '96px', left: '12px' })
const headerFilterSearch = ref('')
const headerFilterOptions = ref([])
const headerFilterDraft = ref([])

const copyableColumnKeys = new Set(['batch_no', 'transaction_name', 'field_name', 'issue_description', 'initial_analysis', 'final_solution', 'remark', 'serial_no', 'global_serial_no', 'issue_key'])
const manualStatuses = ['打开', '延后修复', '修复待验证']
const issueTypes = ['迁移问题', '防腐问题', '代码问题', '新核心下线', '参数问题', '平台问题', '规则差异问题', '合理差异', '其他问题']
const manualDisplayKeys = new Set(['issue_status', 'issue_type', 'initial_analysis', 'final_solution', 'cooperation_person_username', 'remark'])
const filters = reactive({ groupName: '', issueLevel: '', issueType: '', issueStatus: '', sandbox: '', developer: '', bankOwner: '', cooperationPerson: '', serialNo: '', globalSerialNo: '', defectRepairDate: '', coverageRound: '', keyword: '' })
const allStatuses = ['新建', '打开', '延后修复', '修复待验证', '重新打开', '已修复']
const options = reactive({ groups: [], issueLevels: [], issueTypes, issueStatuses: allStatuses, coverageRounds: [] })
const stats = reactive({ total: 0, openTotal: 0, processingTotal: 0, pendingVerificationTotal: 0, fixedTotal: 0, groupCounts: {}, importedAt: '' })
const queryPanelCollapsed = ref(false)
watch(queryPanelCollapsed, async () => {
  await nextTick()
  const viewport = document.querySelector('[data-testid="table-viewport"]')
  if (viewport) viewport.scrollTop = 0
})
const summaryGroups = ['公共组', '存款组', '贷款组', '结算组']
const filteredGroupSummaryRows = computed(() => groupSummaryRows.value)
const filteredPersonRankingRows = computed(() => personRankingRows.value)
const summaryCards = [
  { key: 'total', label: '问题总数（全部状态）', valueKey: 'total' },
  { key: 'new', label: '问题新建总数', valueKey: 'newTotal' },
  { key: 'open', label: '问题打开总数', valueKey: 'openTotal' },
  { key: 'reopened', label: '问题重新打开总数', valueKey: 'reopenedTotal' },
  { key: 'deferred', label: '问题延后修复总数', valueKey: 'deferredTotal' },
  { key: 'pendingVerification', label: '问题待验证总数', valueKey: 'pendingVerificationTotal' },
  { key: 'fixed', label: '问题已修复总数', valueKey: 'fixedTotal' },
]
const groupSummaryColumns = [
  { key: 'groupName', label: '分组' },
  { key: 'newCount', label: '新建' },
  { key: 'openCount', label: '打开' },
  { key: 'deferredCount', label: '延后修复' },
  { key: 'reopenedCount', label: '重新打开' },
  { key: 'pendingVerificationCount', label: '修复待验证' },
  { key: 'totalCount', label: '总数' },
]
const personRankingColumns = [
  { key: 'rank', label: '排名' },
  { key: 'groupName', label: '分组' },
  { key: 'developer', label: '开发负责人' },
  { key: 'newCount', label: '新建' },
  { key: 'openCount', label: '打开' },
  { key: 'deferredCount', label: '延后修复' },
  { key: 'reopenedCount', label: '重新打开' },
  { key: 'pendingVerificationCount', label: '修复待验证' },
  { key: 'totalCount', label: '总数' },
]
const items = ref([])
const total = ref(0)
const page = ref(0)
const pageSize = ref(50)
const loading = ref(false)
const error = ref('')
const copyMessage = ref('')
let copyMessageTimer = null
const activeHoverSummary = ref('')
const groupSummaryRows = ref([])
const personRankingRows = ref([])
const groupSummaryLoading = ref(false)
const personRankingLoading = ref(false)
const groupSummaryError = ref('')
const personRankingError = ref('')

const importOpen = ref(false)
const importFile = ref(null)
const importToken = ref('')
const importing = ref(false)
const exporting = ref(false)
const importComplete = ref(false)
const importMessage = ref('')
const importError = ref(false)
const fullRefreshOpen = ref(false)
const fullRefreshFile = ref(null)
const fullRefreshToken = ref('')
const fullRefreshConfirmed = ref(false)
const fullRefreshing = ref(false)
const fullRefreshComplete = ref(false)
const fullRefreshMessage = ref('')
const fullRefreshError = ref(false)
const savingId = ref(null)
const editOpen = ref(false)
const editIssue = ref(null)
const editDraft = reactive({ issueStatus: '', issueType: '', initialAnalysis: '', finalSolution: '', cooperationPersonUsername: '', cooperationPersonDisplay: '', remark: '' })
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
  if (key === 'cooperation_person_username') {
    const realName = row?.cooperation_person_real_name
    if (realName && value) return `${realName}(${value})`
    return realName || value || '-'
  }
  return display(value)
}

function summaryValue(card) {
  if (!Object.keys(stats.groupCounts || {}).length) return stats[card.valueKey] ?? (card.key === 'deferred' ? stats.processingTotal : 0)
  if (card.key === 'total') return Object.values(stats.groupCounts).reduce((sum, group) => sum + Number(group?.total || 0), 0)
  const key = card.key === 'new' ? 'new' : card.key === 'open' ? 'open' : card.key === 'reopened' ? 'reopened' : card.key === 'deferred' ? 'deferred' : card.key === 'pendingVerification' ? 'pendingVerification' : 'fixed'
  return Object.values(stats.groupCounts).reduce((sum, group) => sum + Number(group?.[key] || 0), 0)
}

function groupSummary(card, group) {
  if (card.key === 'total') return stats.groupCounts?.[group]?.total ?? 0
  const key = card.key === 'new' ? 'new' : card.key === 'open' ? 'open' : card.key === 'reopened' ? 'reopened' : card.key === 'deferred' ? 'deferred' : card.key === 'pendingVerification' ? 'pendingVerification' : 'fixed'
  return stats.groupCounts?.[group]?.[key] ?? 0
}

async function openHoverSummary(type, event) {
  if (event?.type === 'focusin' && activeHoverSummary.value === type) return
  activeHoverSummary.value = type
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

function closeHoverSummary(type, event) {
  if (event?.type === 'focusout' && event.currentTarget?.contains(event.relatedTarget)) return
  if (activeHoverSummary.value === type) activeHoverSummary.value = ''
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
    sandbox: filters.sandbox === '' ? undefined : filters.sandbox === 'true',
    ...(filters.developer ? { developer: filters.developer } : {}),
    ...(filters.bankOwner ? { bankOwner: filters.bankOwner } : {}),
    ...(filters.cooperationPerson ? { cooperationPerson: filters.cooperationPerson } : {}),
    ...(filters.serialNo ? { serialNo: filters.serialNo } : {}),
    ...(filters.globalSerialNo ? { globalSerialNo: filters.globalSerialNo } : {}),
    ...(filters.defectRepairDate ? { defectRepairDate: filters.defectRepairDate } : {}),
    ...(filters.coverageRound ? { coverageRound: filters.coverageRound } : {}),
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
  const rect = event?.currentTarget?.getBoundingClientRect?.()
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
  headerFilterOpen.value = true
  await loadHeaderFilterOptions()
}

async function loadHeaderFilterOptions() {
  if (!activeHeaderColumn.value) return
  const [field] = headerFilterConfig[activeHeaderColumn.value.key]
  headerFilterOptions.value = await getReplayIssueHeaderFilterOptions({ ...headerFilterParams(activeHeaderColumn.value.key), field, keyword: headerFilterSearch.value || undefined }) || []
}

function baseFilterParams() {
  return { groupName: filters.groupName || undefined, sandbox: filters.sandbox === '' ? undefined : filters.sandbox === 'true', issueLevel: filters.issueLevel || undefined, issueType: filters.issueType || undefined, issueStatus: filters.issueStatus || undefined, developer: filters.developer || undefined, bankOwner: filters.bankOwner || undefined, cooperationPerson: filters.cooperationPerson || undefined, coverageRound: filters.coverageRound || undefined }
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
function closeHeaderFilter() { headerFilterOpen.value = false }
async function applyHeaderFilter() { headerFilters[activeHeaderColumn.value.key] = [...headerFilterDraft.value]; page.value = 0; closeHeaderFilter(); await loadList() }
async function clearHeaderFilter() { delete headerFilters[activeHeaderColumn.value.key]; page.value = 0; closeHeaderFilter(); await loadList() }

async function openEdit(row) {
  if (row.issue_status === '已修复') return
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
    if (saved?.issue_status !== '修复待验证' && editDraft.issueStatus !== '修复待验证') {
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
    const [nextOptions, nextStats, rounds] = await Promise.all([getReplayIssueOptions(), getReplayIssueStats(), getReplayImportRounds()])
    Object.assign(options, nextOptions || {})
    options.coverageRounds = (nextOptions?.coverageRounds || (rounds || []).map((round) => round.roundCode)).filter(Boolean)
    options.issueStatuses = allStatuses
    Object.assign(stats, nextStats || {})
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
  Object.assign(filters, { groupName: '', issueLevel: '', issueType: '', issueStatus: '', sandbox: '', developer: '', bankOwner: '', cooperationPerson: '', serialNo: '', globalSerialNo: '', defectRepairDate: '', coverageRound: '', keyword: '' })
  return query()
}

watch(filters, () => {
  clearHeaderFilters()
  if (headerFilterOpen.value) closeHeaderFilter()
}, { deep: true })

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
    const result = await importReplayIssues(importFile.value, importToken.value)
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

function openFullRefresh() {
  fullRefreshOpen.value = true
  fullRefreshFile.value = null
  fullRefreshToken.value = ''
  fullRefreshConfirmed.value = false
  fullRefreshComplete.value = false
  fullRefreshMessage.value = ''
  fullRefreshError.value = false
}

function closeFullRefresh() {
  if (!fullRefreshing.value) fullRefreshOpen.value = false
}

function selectFullRefreshFile(event) {
  fullRefreshFile.value = event.target.files?.[0] || null
  fullRefreshComplete.value = false
  fullRefreshMessage.value = ''
  fullRefreshError.value = false
}

async function submitFullRefresh() {
  if (!fullRefreshFile.value || !fullRefreshToken.value.trim() || !fullRefreshConfirmed.value
    || fullRefreshing.value || fullRefreshComplete.value) return
  fullRefreshing.value = true
  fullRefreshMessage.value = ''
  fullRefreshError.value = false
  try {
    const result = await fullRefreshReplayIssues(fullRefreshFile.value, fullRefreshToken.value)
    fullRefreshComplete.value = true
    fullRefreshMessage.value = `全量更新完成：${result.totalRows ?? 0} 条；自动生成标识 ${result.generatedIdentityRows ?? 0} 条${result.coverageRound ? `；覆盖批次 ${result.coverageRound}` : ''}`
    page.value = 0
    await Promise.all([loadList(), loadMetadata()])
  } catch (cause) {
    fullRefreshError.value = true
    fullRefreshMessage.value = `全量更新失败：${cause?.message || cause}`
  } finally {
    fullRefreshing.value = false
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
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-primary, #1f2937);
  background: var(--bg-page, #f0f2f7);
}

.replay-toolbar, .replay-filters, .replay-pager { flex: 0 0 auto; }

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
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
  padding: 12px 20px 0;
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
.replay-summary-entries { position: relative; z-index: 10; flex: 0 0 auto; display: flex; align-items: center; gap: 10px; padding: 10px 20px 12px; }
.replay-summary-entry { position: relative; min-height: 32px; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px; border: 1px solid var(--border, #d7dee8); border-radius: 4px; color: var(--text-secondary, #374151); background: var(--bg-card, #fff); cursor: default; outline: none; font-size: 12px; }
.replay-summary-entry:hover, .replay-summary-entry:focus-visible, .replay-summary-entry:focus-within { border-color: var(--text-active, #3b5adb); color: var(--text-active, #3b5adb); }
.replay-summary-panel { z-index: 1000; display: flex; flex-direction: column; padding: 14px; border: 1px solid var(--border, #d7dee8); border-radius: 6px; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); box-shadow: 0 18px 48px rgba(13, 20, 36, .28); }
.replay-summary-panel-fixed { position: fixed; top: 50%; left: 50%; height: min(70vh, 640px); max-height: calc(100vh - 48px); transform: translate(-50%, -50%); }
.replay-summary-panel-group { width: min(80vw, 1200px); }
.replay-summary-panel-person { width: min(90vw, 1500px); }
.replay-summary-panel > header { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 0 9px; }
.replay-summary-panel h3 { margin: 0; font-size: 14px; line-height: 20px; }
.replay-summary-table-wrap { min-height: 0; overflow: auto; }
.replay-summary-table { width: 100%; border-collapse: collapse; color: var(--text-primary, #1f2937); background: var(--bg-card, #fff); font-size: 12px; font-variant-numeric: tabular-nums; }
.replay-summary-table th, .replay-summary-table td { min-width: 88px; padding: 7px 9px; border: 1px solid var(--border, #d7dee8); text-align: right; white-space: nowrap; }
.replay-summary-table th { position: sticky; top: 0; z-index: 1; color: #fff; background: var(--replay-teal); }
.replay-summary-table th:first-child, .replay-summary-table td:first-child { text-align: left; }
.replay-person-ranking-table th:nth-child(3), .replay-person-ranking-table td:nth-child(3) { min-width: 250px; text-align: left; white-space: normal; overflow-wrap: anywhere; }
.replay-summary-state { margin: 0; padding: 18px; color: var(--text-muted, #6b7280); text-align: center; }
.replay-field-label { position: relative; display: flex !important; align-items: center; justify-content: flex-start !important; width: 100%; gap: 2px !important; }
.replay-field-label > em { margin-left: auto; }
.replay-field-help-trigger { color: var(--text-secondary, #687386); cursor: help; outline: none; }
.replay-field-help-trigger:hover, .replay-field-help-trigger:focus-visible { color: var(--accent, #2563eb); }
.replay-field-help-tooltip { position: absolute; z-index: 30; left: 0; top: calc(100% + 7px); display: none; width: min(520px, calc(100vw - 64px)); max-height: 260px; overflow: auto; padding: 10px 12px; border: 1px solid var(--border, #d7dee8); border-radius: 5px; background: var(--bg-card, #fff); color: var(--text-primary, #1f2937); box-shadow: 0 10px 24px rgba(13, 20, 36, .2); font-size: 12px; font-weight: 400; line-height: 1.65; white-space: normal; }
.replay-field-help-trigger:hover + .replay-field-help-tooltip, .replay-field-help-trigger:focus-visible + .replay-field-help-tooltip { display: block; }

.replay-filters {
  display: flex;
  align-items: end;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 20px;
  background: var(--bg-card, #fff);
  border-bottom: 1px solid var(--border, #e8edf5);
}

.replay-filters label, .replay-import-modal label { display: grid; gap: 4px; color: var(--text-secondary, #374151); font-size: 12px; line-height: 16px; }
.replay-filters select { width: 126px; }
.replay-keyword-field input { width: min(250px, 35vw); }
.replay-filters select, .replay-filters input, .replay-import-modal input {
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
  padding: 0 20px;
  scrollbar-gutter: stable both-edges;
}
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
.replay-copyable-cell { cursor: copy; }
.replay-copyable-cell:hover { background: var(--bg-domain-hover, #f5f7fa) !important; }
.replay-state { text-align: center !important; color: var(--text-muted, #6b7280); }
.replay-error { color: var(--c-error-code-text, #cf1124); }
.replay-manual-value { color: #cf1124; white-space: pre-wrap; overflow-wrap: anywhere; }
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
.replay-file-field small { color: var(--text-muted, #6b7280); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.replay-import-message { margin: 0 !important; padding: 8px 10px; border: 1px solid var(--border, #e8edf5); border-radius: 4px; background: var(--bg-badge, #f0f2f5); color: var(--text-secondary, #374151) !important; }
.replay-import-message.is-error { color: var(--c-error-code-text, #cf1124) !important; }
.replay-danger-copy { color: #b42318 !important; }
.replay-destructive-confirm { display: flex !important; align-items: center; gap: 8px !important; }
.replay-destructive-confirm input { width: 16px !important; height: 16px !important; margin: 0; padding: 0; }

[data-theme="dark"] .replay-page { --replay-teal: #145c67; --replay-row-alt: rgba(126, 184, 255, .07); }

@media (max-width: 768px) {
  .replay-toolbar, .replay-filters, .replay-pager { padding-left: 12px; padding-right: 12px; }
  .replay-toolbar { min-height: auto; align-items: flex-start; flex-wrap: wrap; }
  .replay-toolbar-actions { width: 100%; justify-content: flex-end; }
  .replay-toolbar-title { width: 100%; }
  .replay-icon-button.replay-mobile-navigation { flex: 0 0 auto; display: inline-grid; }
  .replay-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); padding-left: 12px; padding-right: 12px; }
  .replay-summary-card { padding-left: 8px; padding-right: 8px; }
  .replay-summary-entries { padding-left: 12px; padding-right: 12px; flex-wrap: wrap; }
  .replay-summary-panel-fixed, .replay-summary-panel-group, .replay-summary-panel-person { top: 50%; right: auto; left: 50%; width: calc(100vw - 24px); height: min(70vh, 640px); max-height: calc(100vh - 24px); transform: translate(-50%, -50%); }
  .replay-header-filter-panel { max-height: calc(100vh - 116px); }
  .replay-filters label { flex: 1 1 126px; }
  .replay-filters select { width: 100%; }
  .replay-keyword-field, .replay-keyword-field input { width: 100% !important; }
  .replay-edit-grid { grid-template-columns: 1fr; }
  .replay-edit-wide { grid-column: auto; }
  .replay-table-viewport { padding-left: 12px; padding-right: 12px; }
  .replay-pager { justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .replay-tracking-drawer { width: 100%; }
}
</style>
