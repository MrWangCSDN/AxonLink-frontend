import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReplayIssuePage from './ReplayIssuePage.vue'
import {
  exportReplayIssues,
  getReplayIssueOptions,
  getReplayIssueHeaderFilterOptions,
  getReplayIssueMailStatus,
  getReplayImportRounds,
  getReplayIssueRoundTracking,
  getReplayIssueGroupSummaries,
  getReplayIssuePersonRankings,
  getReplayIssueStats,
  getReplayCompletionDatePoints,
  getReplayCompletionDashboard,
  getReplayCompletionIssues,
  getReplayIssueReviewPermissions,
  getReplayIssuePlanDatePermissions,
  approveReplayIssue,
  getReplayWeeklyTask,
  replaceReplayWeeklyTask,
  importReplayIssues,
  listReplayIssues,
  searchReplayIssueUsers,
  sendReplayIssueMail,
  updateReplayIssue,
  updateReplayIssuePlannedCompletionDate,
} from '../../api/replayIssues.js'

vi.mock('../../api/replayIssues.js', () => ({
  exportReplayIssues: vi.fn(),
  getReplayIssueOptions: vi.fn(),
  getReplayIssueHeaderFilterOptions: vi.fn(),
  getReplayIssueMailStatus: vi.fn(),
  getReplayImportRounds: vi.fn(),
  getReplayIssueRoundTracking: vi.fn(),
  getReplayIssueGroupSummaries: vi.fn(),
  getReplayIssuePersonRankings: vi.fn(),
  getReplayIssueStats: vi.fn(),
  getReplayCompletionDatePoints: vi.fn(),
  getReplayCompletionDashboard: vi.fn(),
  getReplayCompletionIssues: vi.fn(),
  getReplayIssueReviewPermissions: vi.fn(),
  getReplayIssuePlanDatePermissions: vi.fn(),
  approveReplayIssue: vi.fn(),
  getReplayWeeklyTask: vi.fn(),
  replaceReplayWeeklyTask: vi.fn(),
  importReplayIssues: vi.fn(),
  listReplayIssues: vi.fn(),
  searchReplayIssueUsers: vi.fn(),
  sendReplayIssueMail: vi.fn(),
  updateReplayIssue: vi.fn(),
  updateReplayIssuePlannedCompletionDate: vi.fn(),
}))

const fixtureRow = {
  id: 1, source_sheet: '贷款组', group_name: '贷款组', is_sandbox: 0, row_order: 2,
  domain: '贷款组', sequence_no: '59', batch_no: 'RPT20260803-194444-3815',
  transaction_code: '6208', transaction_name: '对公贷款还款计划查询', issue_level: '交易级',
  registered_date: '20260803', field_name: '响应码', issue_description: 'CCBS响应不一致',
  transaction_owner: '张济华', matched_developer: '张三(c-zhangs3)、李四(c-lisi)', matched_bank_owner: '刘六(c-liul6)', matched_bank_owner_emp_nos: '200001', issue_status: '延后修复', issue_type: '代码问题', initial_analysis: '核对返回值',
  final_solution: '修正映射', cooperation_person_username: 'sunhy1', cooperation_person_real_name: '孙海英',
  serial_no: '001012213710102', planned_completion_date: '', defect_repair_date: '', remark: '历史备注', import_date: '2026-08-04',
  affected_transaction_count: '58', issue_id: '000845', issue_key: 'TRAN|6208|响应码',
  historical_occurrence_count: '4', first_occurrence_date: '2026-07-28 00:00:00.0',
  last_occurrence_date: '2026-07-31 00:00:00.0', imported_at: '2026-08-04T10:00:00',
  coverage_round: '20260808-001', occurrence_rounds: '20260808-001、20260807-001', weekly_task: true,
}

const visibleColumnLabels = [
  '任务标记', '领域', 'issue_id', '是否沙箱', '交易码', '交易名称', '问题级别', '字段名', '流水号', '全局流水号', '问题描述',
  '计划验证日期', '缺陷修复日期', '开发负责人', '科技负责人', '操作', '问题状态', '审核状态', '问题类型', '需协同人', '初步问题分析', '最终处理方案', '备注',
  '该问题出现在的交易笔数', 'issue_key', '首次出现日期', '上次出现日期', '出现批次',
]

function arrangeApi({ total = 4607, items = [fixtureRow] } = {}) {
  listReplayIssues.mockResolvedValue({ total, items })
  getReplayIssueMailStatus.mockResolvedValue({ status: 'UNSENT', sentAt: null })
  getReplayIssueOptions.mockResolvedValue({
    groups: ['公共组'],
    issueLevels: ['交易级'],
    issueTypes: ['迁移问题', '防腐问题', '代码问题', '新核心下线', '参数问题', '平台问题', '规则差异问题', '合理差异', '外围问题', '其他问题'],
    issueStatuses: ['新建', '打开', '无需处理', '延后修复', '修复待验证', '重新打开', '已修复'],
    reviewStatuses: ['待审核', '已审核'],
    coverageRounds: ['20260808-001', '20260807-001'],
  })
  getReplayIssueHeaderFilterOptions.mockResolvedValue(['张三(c-zhangs3)', '李四(c-lisi)', '赵六(c-zhaol6)'])
  getReplayIssueReviewPermissions.mockResolvedValue({ reviewableGroups: ['贷款组'], reviewersByGroup: { 贷款组: ['审核甲', '审核乙'] }, reviewableTransactionCodes: [] })
  getReplayIssuePlanDatePermissions.mockResolvedValue({ editableGroups: ['公共组'] })
  updateReplayIssuePlannedCompletionDate.mockImplementation((id, value) => Promise.resolve({ id, plannedCompletionDate: value }))
  approveReplayIssue.mockResolvedValue({ ...fixtureRow, issue_status: '无需处理', review_status: '已审核', reviewer_real_name: '审核甲' })
  getReplayWeeklyTask.mockResolvedValue({ batchNames: ['20260808-001'], availableBatchNames: ['20260807-001', '20260808-001'], issueCount: 30 })
  replaceReplayWeeklyTask.mockResolvedValue({ batchNames: ['20260807-001'], availableBatchNames: ['20260807-001', '20260808-001'], issueCount: 18 })
  getReplayImportRounds.mockResolvedValue([
    { id: 2, roundCode: '20260808-001', inputRows: 3000 },
    { id: 1, roundCode: '20260807-001', inputRows: 2300 },
  ])
  getReplayIssueStats.mockResolvedValue({
    total,
    newTotal: 0,
    openTotal: 1200,
    reopenedTotal: 0,
    deferredTotal: 800,
    pendingVerificationTotal: 500,
    fixedTotal: 2107,
    groupCounts: {
      公共组: { total: 1000, new: 0, open: 300, reopened: 0, deferred: 200, pendingVerification: 100, fixed: 400 },
      存款组: { total: 1100, new: 0, open: 300, reopened: 0, deferred: 200, pendingVerification: 100, fixed: 500 },
      贷款组: { total: 1200, new: 0, open: 300, reopened: 0, deferred: 200, pendingVerification: 100, fixed: 600 },
      结算组: { total: 1307, new: 0, open: 300, reopened: 0, deferred: 200, pendingVerification: 200, fixed: 607 },
    },
    importedAt: '2026-08-04T10:00:00',
  })
  getReplayCompletionDatePoints.mockResolvedValue({
    datePoints: [
      { date: '2026-08-25', plannedCount: 5 },
      { date: '2026-08-26', plannedCount: 8 },
      { date: '2026-08-27', plannedCount: 6 },
    ],
    defaultStartDate: '2026-08-25',
    defaultEndDate: '2026-08-27',
  })
  getReplayCompletionDashboard.mockResolvedValue({
    effectiveStartDate: '2026-08-25', effectiveEndDate: '2026-08-27', today: '2026-08-27',
    summary: { plannedTotal: 19, onTimeFixedCount: 8, lateFixedCount: 2, unfinishedCount: 6, overdueUnfinishedCount: 3, completionRate: 52.63 },
    groups: [],
  })
  getReplayCompletionIssues.mockResolvedValue({ total: 0, items: [], limit: 20, offset: 0 })
  getReplayIssueGroupSummaries.mockResolvedValue([
    { groupName: '贷款组', newCount: 1, openCount: 8, reopenedCount: 2, deferredCount: 3, pendingVerificationCount: 1, pendingTotalCount: 15, noActionCount: 2, fixedCount: 4, fixedTotalCount: 6, totalCount: 21 },
  ])
  getReplayIssuePersonRankings.mockResolvedValue([
    { rank: 1, groupName: '贷款组', developer: '张三(c-zhangs3)、李四(c-lisi)', newCount: 1, openCount: 5, reopenedCount: 1, deferredCount: 2, pendingVerificationCount: 1, pendingTotalCount: 10, noActionCount: 2, fixedCount: 3, fixedTotalCount: 5, totalCount: 15 },
  ])
  importReplayIssues.mockResolvedValue({ totalRows: 16, sandboxRows: 8, nonSandboxRows: 8, rowsBySheet: {} })
  exportReplayIssues.mockResolvedValue({ fileName: '回放问题清单.xlsx' })
}

async function openImport(wrapper) {
  await wrapper.get('[data-testid="open-import"]').trigger('click')
  const input = wrapper.get('[data-testid="import-file"]')
  const file = new File(['x'], 'issues.xlsx')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
  await input.trigger('change')
  await wrapper.get('[data-testid="import-token"]').setValue('secret')
  return file
}

beforeEach(() => {
  vi.clearAllMocks()
  arrangeApi()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ReplayIssuePage', () => {
  it('places planned completion after the two summary entries and hides the whole action row when statistics collapse', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.find('.replay-filters').exists()).toBe(false)
    expect(wrapper.find('[data-testid="query-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-filter"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="replay-filter-actions"]').exists()).toBe(false)
    expect(wrapper.findAll('.replay-summary-card > span').map(card => card.text())).toEqual([
      '问题总数（全部状态）',
      '问题新建总数',
      '问题打开总数',
      '问题重新打开总数',
      '问题延后修复总数',
      '问题无需处理总数',
      '问题待验证总数',
      '问题已修复总数',
    ])
    const row = wrapper.get('[data-testid="replay-summary-actions-row"]')
    const entries = row.get('.replay-summary-entries')
    const actions = row.get('[data-testid="replay-summary-right-actions"]')
    expect(row.classes()).toContain('replay-summary-actions-row-transparent')
    expect(wrapper.get('[data-testid="table-viewport"]').classes()).toContain('replay-table-viewport-aligned')
    expect(entries.findAll('.replay-summary-entry').map(entry => entry.text())).toEqual([
      '各组问题数',
      '各组开发负责人问题排名',
      '计划完成情况',
    ])
    expect(actions.findAll('[data-testid]')).toHaveLength(2)
    expect(actions.find('[data-testid="planned-completion-entry"]').exists()).toBe(false)
    expect(actions.get('[data-testid="weekly-task-only"]').exists()).toBe(true)
    expect(actions.get('[data-testid="reset-filters"]').exists()).toBe(true)

    await actions.get('[data-testid="weekly-task-only"]').setValue(true)
    await flushPromises()
    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({ weeklyTask: true, offset: 0 }))

    await actions.get('[data-testid="reset-filters"]').trigger('click')
    await flushPromises()
    const resetParams = listReplayIssues.mock.calls.at(-1)[0]
    expect(resetParams.weeklyTask).toBeUndefined()
    expect(resetParams.offset).toBe(0)

    await wrapper.get('[data-testid="query-panel-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="group-summary-entry"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="person-ranking-entry"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="replay-summary-actions-row"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="planned-completion-entry"]').exists()).toBe(false)
  })

  it('opens planned completion statistics beside the two existing summary entries without changing list filters', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    const listCallsBeforeOpen = listReplayIssues.mock.calls.length

    const entries = wrapper.findAll('.replay-summary-entry').map(entry => entry.text())
    expect(entries).toEqual(['各组问题数', '各组开发负责人问题排名', '计划完成情况'])

    await wrapper.get('[data-testid="planned-completion-entry"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[aria-label="计划验证日期时间轴"]').exists()).toBe(true)
    expect(getReplayCompletionDatePoints).toHaveBeenCalledTimes(1)
    expect(listReplayIssues).toHaveBeenCalledTimes(listCallsBeforeOpen)
  })

  it('places planned completion date between description and defect date and applies group permissions', async () => {
    arrangeApi({ items: [
      { ...fixtureRow, id: 1, group_name: '公共组', domain: '公共组', planned_completion_date: '2026-08-26' },
      { ...fixtureRow, id: 2, issue_key: 'TRAN|6208|第二个字段', planned_completion_date: '2026-09-10' },
      { ...fixtureRow, id: 3, issue_key: 'TRAN|6208|已完成字段', group_name: '公共组', domain: '公共组', planned_completion_date: '2026-08-25', defect_repair_date: '2026-08-26' },
    ] })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.findAll('thead th').map((header) => header.text())).toEqual(visibleColumnLabels)
    expect(wrapper.get('[data-testid="plan-date-display-1"]').text()).toBe('2026-08-26')
    expect(wrapper.get('[data-testid="plan-date-edit-1"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="plan-date-display-2"]').text()).toBe('2026-09-10')
    expect(wrapper.find('[data-testid="plan-date-edit-2"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="plan-date-display-3"]').text()).toBe('2026-08-25')
    expect(wrapper.find('[data-testid="plan-date-edit-3"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="plan-date-display-3"]').classes()).toContain('is-repair-date-locked')
    expect(wrapper.get('[data-testid="plan-date-display-3"]').attributes('title')).toBe('已有缺陷修复日期，计划验证日期不可修改')
  })

  it('uses the approved list order, colors, compact widths, and date-only occurrence values', async () => {
    arrangeApi({ items: [{ ...fixtureRow, group_name: '公共组', domain: '公共组', planned_completion_date: '2026-08-30' }] })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const headers = wrapper.findAll('thead th')
    expect(headers.map(header => header.text())).toEqual(visibleColumnLabels)
    const cells = wrapper.findAll('tbody tr[data-testid="replay-row"] td')
    expect(cells.at(visibleColumnLabels.indexOf('计划验证日期')).find('.replay-plan-date-emphasis').exists()).toBe(true)
    for (const label of ['初步问题分析', '最终处理方案', '备注']) {
      expect(cells.at(visibleColumnLabels.indexOf(label)).find('.replay-detail-value').exists()).toBe(true)
    }
    expect(cells.at(visibleColumnLabels.indexOf('问题状态')).find('.replay-manual-value').exists()).toBe(true)
    expect(cells.at(visibleColumnLabels.indexOf('需协同人')).find('.replay-manual-value').exists()).toBe(true)
    expect(cells.at(visibleColumnLabels.indexOf('首次出现日期')).text()).toBe('2026-07-28')
    expect(cells.at(visibleColumnLabels.indexOf('上次出现日期')).text()).toBe('2026-07-31')

    const columnWidths = wrapper.findAll('col').map(column => column.attributes('style'))
    expect(columnWidths[visibleColumnLabels.indexOf('issue_id')]).toContain('width: 80px')
    expect(columnWidths[visibleColumnLabels.indexOf('issue_id')]).not.toBe(columnWidths[visibleColumnLabels.indexOf('领域')])
    expect(columnWidths[visibleColumnLabels.indexOf('是否沙箱')]).toBe(columnWidths[visibleColumnLabels.indexOf('问题级别')])
    expect(columnWidths[visibleColumnLabels.indexOf('交易码')]).toBe(columnWidths[visibleColumnLabels.indexOf('问题级别')])
  })

  it('filters planned completion dates with multiple values while displaying empty cells as dash', async () => {
    arrangeApi({ items: [
      { ...fixtureRow, id: 1, planned_completion_date: '' },
      { ...fixtureRow, id: 2, issue_key: 'TRAN|6208|第二个字段', planned_completion_date: '2026-08-26' },
    ] })
    getReplayIssueHeaderFilterOptions.mockResolvedValue(['空', '2026-08-26', '2026-08-27'])
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.get('[data-testid="plan-date-display-1"]').text()).toBe('-')
    const header = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf('计划验证日期'))
    expect(header.find('.replay-header-filter-button').exists()).toBe(true)

    await header.get('.replay-header-filter-button').trigger('click')
    await flushPromises()
    expect(getReplayIssueHeaderFilterOptions).toHaveBeenLastCalledWith(expect.objectContaining({
      field: 'plannedCompletionDate',
    }))
    expect(wrapper.get('[data-testid="header-filter-panel"]').text()).toContain('空')
    expect(wrapper.get('[data-testid="header-filter-panel"]').text()).toContain('2026-08-26')

    const checkboxes = wrapper.findAll('[data-testid="header-filter-panel"] input[type="checkbox"]')
    await checkboxes.at(0).setValue(true)
    await checkboxes.at(1).setValue(true)
    await wrapper.find('[data-testid="header-filter-panel"] .replay-button-primary').trigger('click')
    await flushPromises()

    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({
      plannedCompletionDates: ['空', '2026-08-26'],
      offset: 0,
    }))
  })

  it('filters issue id serial numbers global serial numbers and defect dates with fuzzy candidates', async () => {
    getReplayIssueHeaderFilterOptions.mockImplementation(({ field, keyword }) => Promise.resolve({
      issueId: keyword ? ['ISS-200'] : ['空', 'ISS-100', 'ISS-200'],
      serialNo: ['空', 'SER-100', 'SER-200'],
      globalSerialNo: ['空', 'GS-100', 'GS-200'],
      defectRepairDate: ['空', '2026-08-20', '2026-08-21'],
    }[field] || []))
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    for (const label of ['issue_id', '流水号', '全局流水号', '缺陷修复日期']) {
      const header = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf(label))
      expect(header.find('.replay-header-filter-button').exists()).toBe(true)
    }

    const issueHeader = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf('issue_id'))
    await issueHeader.get('.replay-header-filter-button').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="header-filter-search"]').setValue('SS-2')
    await wrapper.get('[aria-label="查询筛选选项"]').trigger('click')
    await flushPromises()
    expect(getReplayIssueHeaderFilterOptions).toHaveBeenLastCalledWith(expect.objectContaining({
      field: 'issueId', keyword: 'SS-2', serialNo: undefined, globalSerialNo: undefined, defectRepairDate: undefined,
    }))
    expect(wrapper.get('[data-testid="header-filter-panel"]').text()).toContain('ISS-200')
    await wrapper.findAll('[data-testid="header-filter-panel"] input[type="checkbox"]').at(0).setValue(true)
    await wrapper.find('[data-testid="header-filter-panel"] .replay-button-primary').trigger('click')
    await flushPromises()

    const serialHeader = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf('流水号'))
    await serialHeader.get('.replay-header-filter-button').trigger('click')
    await flushPromises()
    expect(getReplayIssueHeaderFilterOptions).toHaveBeenLastCalledWith(expect.objectContaining({
      field: 'serialNo', issueIds: ['ISS-200'],
    }))
    await wrapper.findAll('[data-testid="header-filter-panel"] input[type="checkbox"]').at(0).setValue(true)
    await wrapper.find('[data-testid="header-filter-panel"] .replay-button-primary').trigger('click')
    await flushPromises()

    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({
      issueIds: ['ISS-200'], serialNos: ['空'], offset: 0,
    }))
  })

  it('keeps an open header filter attached to its title after collapsing the query panel', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const header = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf('计划验证日期'))
    const filterButton = header.get('.replay-header-filter-button')
    let anchorRect = { left: 520, right: 540, top: 100, bottom: 120, width: 20, height: 20 }
    vi.spyOn(filterButton.element, 'getBoundingClientRect').mockImplementation(() => anchorRect)

    await filterButton.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="header-filter-panel"]').attributes('style')).toContain('top: 128px')

    anchorRect = { left: 520, right: 540, top: 40, bottom: 60, width: 20, height: 20 }
    await wrapper.get('[data-testid="query-panel-toggle"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="header-filter-panel"]').attributes('style')).toContain('top: 68px')
  })

  it('validates and auto-saves a changed plan date on blur without saving unchanged values', async () => {
    getReplayIssuePlanDatePermissions.mockResolvedValue({ editableGroups: ['贷款组'] })
    arrangeApi({ items: [{ ...fixtureRow, planned_completion_date: '' }] })
    getReplayIssuePlanDatePermissions.mockResolvedValue({ editableGroups: ['贷款组'] })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    await wrapper.get('[data-testid="plan-date-edit-1"]').trigger('click')
    const input = wrapper.get('[data-testid="plan-date-input-1"]')
    await input.setValue('2026-08-32')
    await input.trigger('blur')
    await flushPromises()
    expect(updateReplayIssuePlannedCompletionDate).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="plan-date-error"]').text()).toBe('填写日期格式不合法，请按 2026-08-26 格式填写')

    await wrapper.get('[data-testid="plan-date-input-1"]').setValue('2026-08-26')
    await wrapper.get('[data-testid="plan-date-input-1"]').trigger('blur')
    await flushPromises()
    expect(updateReplayIssuePlannedCompletionDate).toHaveBeenCalledWith(1, '2026-08-26')
    expect(wrapper.get('[data-testid="plan-date-display-1"]').text()).toBe('2026-08-26')

    await wrapper.get('[data-testid="plan-date-edit-1"]').trigger('click')
    await wrapper.get('[data-testid="plan-date-input-1"]').trigger('blur')
    await flushPromises()
    expect(updateReplayIssuePlannedCompletionDate).toHaveBeenCalledTimes(1)
  })

  it('clears an existing plan date and cancels changes with Escape', async () => {
    getReplayIssuePlanDatePermissions.mockResolvedValue({ editableGroups: ['贷款组'] })
    arrangeApi({ items: [{ ...fixtureRow, planned_completion_date: '2026-08-26' }] })
    getReplayIssuePlanDatePermissions.mockResolvedValue({ editableGroups: ['贷款组'] })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    await wrapper.get('[data-testid="plan-date-edit-1"]').trigger('click')
    await wrapper.get('[data-testid="plan-date-input-1"]').setValue('2026-08-27')
    await wrapper.get('[data-testid="plan-date-input-1"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(updateReplayIssuePlannedCompletionDate).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="plan-date-display-1"]').text()).toBe('2026-08-26')

    await wrapper.get('[data-testid="plan-date-edit-1"]').trigger('click')
    await wrapper.get('[data-testid="plan-date-input-1"]').setValue('')
    await wrapper.get('[data-testid="plan-date-input-1"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(updateReplayIssuePlannedCompletionDate).toHaveBeenCalledWith(1, null)
    expect(wrapper.get('[data-testid="plan-date-display-1"]').text()).toBe('-')
  })
  it('shows review status after issue status and lets the configured group reviewer approve it', async () => {
    arrangeApi({ items: [{ ...fixtureRow, issue_status: '无需处理', issue_type: '合理差异', review_status: '待审核' }] })
    window.confirm = vi.fn(() => true)
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.findAll('th').map(node => node.text())).toEqual(expect.arrayContaining(['问题状态', '审核状态']))
    expect(wrapper.get('[data-testid="review-1"]').text()).toBe('待审核')
    expect(wrapper.get('[data-testid="edit-1"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="review-1"]').trigger('click')
    await flushPromises()

    expect(approveReplayIssue).toHaveBeenCalledWith(1)
  })

  it('locks no-action review rows for non-reviewers and force-binds issue types', async () => {
    getReplayIssueReviewPermissions.mockResolvedValue({ reviewableGroups: [], reviewersByGroup: { 贷款组: ['审核甲', '审核乙'] } })
    arrangeApi({ items: [{ ...fixtureRow, issue_status: '无需处理', issue_type: '合理差异', review_status: '已审核' }] })
    getReplayIssueReviewPermissions.mockResolvedValue({ reviewableGroups: [], reviewersByGroup: { 贷款组: ['审核甲', '审核乙'] } })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.get('[data-testid="edit-1"]').attributes('disabled')).toBeDefined()

    arrangeApi()
    getReplayIssueReviewPermissions.mockResolvedValue({ reviewableGroups: ['贷款组'], reviewersByGroup: { 贷款组: ['审核甲'] } })
    const editable = mount(ReplayIssuePage)
    await flushPromises()
    await editable.get('[data-testid="edit-1"]').trigger('click')
    await editable.get('[data-testid="edit-status"]').setValue('无需处理')
    await flushPromises()
    expect(editable.get('[data-testid="edit-type"]').element.value).toBe('合理差异')
    expect(editable.get('[data-testid="edit-type"]').attributes('disabled')).toBeDefined()
    await editable.get('[data-testid="edit-status"]').setValue('延后修复')
    await flushPromises()
    expect(editable.get('[data-testid="edit-type"]').element.value).toBe('迁移问题')
  })

  it('keeps pending no-action issues editable for ordinary users', async () => {
    getReplayIssueReviewPermissions.mockResolvedValue({ reviewableGroups: [], reviewersByGroup: { 贷款组: ['审核甲'] }, reviewableTransactionCodes: [] })
    arrangeApi({ items: [{ ...fixtureRow, issue_status: '无需处理', issue_type: '合理差异', review_status: '待审核' }] })
    getReplayIssueReviewPermissions.mockResolvedValue({ reviewableGroups: [], reviewersByGroup: { 贷款组: ['审核甲'] }, reviewableTransactionCodes: [] })

    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.get('[data-testid="edit-1"]').attributes('disabled')).toBeUndefined()
  })

  it('lets a technology owner edit and approve its approved transaction', async () => {
    getReplayIssueReviewPermissions.mockResolvedValue({ reviewableGroups: [], reviewersByGroup: { 贷款组: ['审核甲'] }, reviewableTransactionCodes: ['6208'] })
    arrangeApi({ items: [
      { ...fixtureRow, issue_status: '无需处理', issue_type: '合理差异', review_status: '待审核' },
      { ...fixtureRow, id: 2, issue_key: 'TRAN|6208|第二个字段', issue_status: '无需处理', issue_type: '合理差异', review_status: '已审核' },
    ] })
    getReplayIssueReviewPermissions.mockResolvedValue({ reviewableGroups: [], reviewersByGroup: { 贷款组: ['审核甲'] }, reviewableTransactionCodes: ['6208'] })
    window.confirm = vi.fn(() => true)

    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    expect(wrapper.get('[data-testid="edit-2"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="review-1"]').trigger('click')
    await flushPromises()

    expect(approveReplayIssue).toHaveBeenCalledWith(1)
  })

  it('deduplicates technology owners and configured reviewers in the permission hint', async () => {
    getReplayIssueReviewPermissions.mockResolvedValue({ reviewableGroups: [], reviewersByGroup: { 贷款组: ['刘六', '审核甲'] }, reviewableTransactionCodes: [] })
    arrangeApi({ items: [{ ...fixtureRow, matched_bank_owner: '刘六(c-liul6)、科技乙(c-tech2)', issue_status: '无需处理', issue_type: '合理差异', review_status: '待审核' }] })
    getReplayIssueReviewPermissions.mockResolvedValue({ reviewableGroups: [], reviewersByGroup: { 贷款组: ['刘六', '审核甲'] }, reviewableTransactionCodes: [] })

    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.get('[data-testid="review-1"]').attributes('title')).toBe('没有权限，请联系刘六、科技乙、审核甲进行审核')
  })

  it('highlights weekly task rows and supports token-protected batch replacement plus task-only querying', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.get('[data-testid="open-weekly-task"]').text()).toContain('配置优先任务')
    expect(wrapper.get('[data-testid="weekly-task-only"]').element.parentElement.textContent).toContain('仅看优先任务')
    expect(wrapper.get('[data-testid="replay-row"]').classes()).toContain('replay-weekly-task-row')
    expect(wrapper.get('[data-testid="weekly-task-badge"]').text()).toBe('优先任务')

    await wrapper.get('[data-testid="weekly-task-only"]').setValue(true)
    await flushPromises()
    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({ weeklyTask: true }))

    await wrapper.get('[data-testid="open-weekly-task"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="weekly-task-modal"]').text()).toContain('配置优先任务')
    expect(wrapper.text()).not.toContain('本周任务')
    const checkboxes = wrapper.findAll('[data-testid="weekly-task-batch-option"]')
    await checkboxes[0].setValue(true)
    await checkboxes[1].setValue(false)
    await wrapper.get('[data-testid="weekly-task-token"]').setValue('secret')
    await wrapper.get('[data-testid="save-weekly-task"]').trigger('click')
    await flushPromises()
    expect(replaceReplayWeeklyTask).toHaveBeenCalledWith(['20260807-001'], 'secret')
  })

  it('keeps active header filters when weekly-task-only is toggled', async () => {
    getReplayIssueHeaderFilterOptions.mockResolvedValue(['6208'])
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const transactionHeader = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf('交易码'))
    const transactionFilterButton = transactionHeader.get('.replay-header-filter-button')
    await transactionFilterButton.trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="header-filter-panel"] input[type="checkbox"]').setValue(true)
    await wrapper.find('[data-testid="header-filter-panel"] .replay-button-primary').trigger('click')
    await flushPromises()

    expect(transactionFilterButton.classes()).toContain('active')

    const weeklyTaskOnly = wrapper.get('[data-testid="weekly-task-only"]')
    await weeklyTaskOnly.setValue(true)
    await flushPromises()

    expect(transactionFilterButton.classes()).toContain('active')
    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({
      transactionCodes: ['6208'], weeklyTask: true, offset: 0,
    }))

    await weeklyTaskOnly.setValue(false)
    await flushPromises()

    expect(transactionFilterButton.classes()).toContain('active')
    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({
      transactionCodes: ['6208'], offset: 0,
    }))
  })

  it('does not expose the retired daily report test import entry', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.find('[data-testid="open-daily-report-import"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="daily-report-import-modal"]').exists()).toBe(false)
  })

  it('opens the group summary by click and closes it only from the explicit X button', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const groupEntry = wrapper.get('[data-testid="group-summary-entry"]')
    await groupEntry.trigger('mouseenter')
    await flushPromises()
    expect(getReplayIssueGroupSummaries).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="summary-modal-mask"]').exists()).toBe(false)

    await groupEntry.trigger('click')
    await flushPromises()
    expect(getReplayIssueGroupSummaries).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="summary-modal"]').attributes('aria-label')).toBe('各组问题数')
    expect(wrapper.get('[data-testid="summary-modal"] tbody').text()).toContain('贷款组')

    await wrapper.get('[data-testid="summary-modal-mask"]').trigger('click')
    expect(wrapper.find('[data-testid="summary-modal"]').exists()).toBe(true)

    await wrapper.get('[data-testid="close-summary-modal"]').trigger('click')
    expect(wrapper.find('[data-testid="summary-modal"]').exists()).toBe(false)
  })

  it('opens the developer ranking by click without loading the group summary', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    await wrapper.get('[data-testid="person-ranking-entry"]').trigger('click')
    await flushPromises()

    expect(getReplayIssuePersonRankings).toHaveBeenCalledTimes(1)
    expect(getReplayIssueGroupSummaries).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="summary-modal"]').attributes('aria-label')).toBe('各组开发负责人问题排名')
    await wrapper.findAll('[data-testid="person-ranking-group-tab"]')[1].trigger('click')
    expect(wrapper.get('[data-testid="summary-modal"] tbody').text()).toContain('张三(c-zhangs3)、李四(c-lisi)')
  })

  it('uses the approved pending and fixed column segments in both summary tables', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    await wrapper.get('[data-testid="group-summary-entry"]').trigger('click')
    await flushPromises()
    const groupHeaders = wrapper.findAll('[data-testid="summary-modal"] thead th')
    expect(groupHeaders.map(header => header.text())).toEqual([
      '分组', '新建', '打开', '重新打开', '延后修复', '修复待验证', '未修复总数', '无需处理', '已修复', '已修复总数',
    ])
    expect(groupHeaders.slice(1, 7).every(header => header.classes('is-pending-segment'))).toBe(true)
    expect(groupHeaders.slice(7).every(header => header.classes('is-fixed-segment'))).toBe(true)
    expect(groupHeaders[6].classes()).toContain('is-segment-total')
    expect(groupHeaders[9].classes()).toContain('is-segment-total')
    expect(groupHeaders.map(header => header.text())).not.toContain('总数')

    await wrapper.get('[data-testid="close-summary-modal"]').trigger('click')
    await wrapper.get('[data-testid="person-ranking-entry"]').trigger('click')
    await flushPromises()
    const personHeaders = wrapper.findAll('[data-testid="summary-modal"] thead th')
    expect(personHeaders.map(header => header.text())).toEqual([
      '排名', '分组', '开发负责人', '新建', '打开', '重新打开', '延后修复', '修复待验证', '未修复总数', '无需处理', '已修复', '已修复总数',
    ])
    expect(personHeaders.slice(3, 9).every(header => header.classes('is-pending-segment'))).toBe(true)
    expect(personHeaders.slice(9).every(header => header.classes('is-fixed-segment'))).toBe(true)
  })

  it('defaults developer rankings to deposit, switches among four groups, and resets after reopening', async () => {
    getReplayIssuePersonRankings.mockResolvedValue([
      { rank: 1, groupName: '存款组', developer: '存款负责人', newCount: 1, openCount: 2, reopenedCount: 0, deferredCount: 0, pendingVerificationCount: 0, pendingTotalCount: 3, noActionCount: 0, fixedCount: 1, fixedTotalCount: 1, totalCount: 4 },
      { rank: 1, groupName: '贷款组', developer: '贷款负责人', newCount: 2, openCount: 3, reopenedCount: 0, deferredCount: 0, pendingVerificationCount: 0, pendingTotalCount: 5, noActionCount: 0, fixedCount: 2, fixedTotalCount: 2, totalCount: 7 },
      { rank: 1, groupName: '公共组', developer: '公共负责人', newCount: 3, openCount: 4, reopenedCount: 0, deferredCount: 0, pendingVerificationCount: 0, pendingTotalCount: 7, noActionCount: 0, fixedCount: 3, fixedTotalCount: 3, totalCount: 10 },
      { rank: 1, groupName: '结算组', developer: '结算负责人', newCount: 4, openCount: 5, reopenedCount: 0, deferredCount: 0, pendingVerificationCount: 0, pendingTotalCount: 9, noActionCount: 0, fixedCount: 4, fixedTotalCount: 4, totalCount: 13 },
    ])
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    await wrapper.get('[data-testid="person-ranking-entry"]').trigger('click')
    await flushPromises()

    const tabs = wrapper.findAll('[data-testid="person-ranking-group-tab"]')
    expect(tabs.map(tab => tab.text())).toEqual(['存款组', '贷款组', '公共组', '结算组'])
    expect(tabs.map(tab => tab.attributes('data-active'))).toEqual(['true', 'false', 'false', 'false'])
    expect(wrapper.get('[data-testid="summary-modal"] tbody').text()).toContain('存款负责人')
    expect(wrapper.get('[data-testid="summary-modal"] tbody').text()).not.toContain('贷款负责人')

    await tabs[1].trigger('click')
    expect(wrapper.get('[data-testid="summary-modal"] tbody').text()).toContain('贷款负责人')
    expect(wrapper.get('[data-testid="summary-modal"] tbody').text()).not.toContain('存款负责人')
    expect(getReplayIssuePersonRankings).toHaveBeenCalledTimes(1)

    await wrapper.get('[data-testid="close-summary-modal"]').trigger('click')
    await wrapper.get('[data-testid="person-ranking-entry"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="person-ranking-group-tab"]')[0].attributes('data-active')).toBe('true')
    expect(wrapper.get('[data-testid="summary-modal"] tbody').text()).toContain('存款负责人')
  })

  it('renumbers developer rankings from one inside the selected group', async () => {
    getReplayIssuePersonRankings.mockResolvedValue([
      { rank: 2, groupName: '存款组', developer: '存款负责人02', totalCount: 20 },
      { rank: 6, groupName: '存款组', developer: '存款负责人06', totalCount: 18 },
      { rank: 1, groupName: '贷款组', developer: '贷款负责人01', totalCount: 30 },
    ])
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    await wrapper.get('[data-testid="person-ranking-entry"]').trigger('click')
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="summary-modal"] tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.findAll('td')[0].text())).toEqual(['1', '2'])
  })

  it('copies only the selected developer-ranking group', async () => {
    getReplayIssuePersonRankings.mockResolvedValue([
      { rank: 1, groupName: '存款组', developer: '存款负责人', newCount: 1, openCount: 2, reopenedCount: 0, deferredCount: 0, pendingVerificationCount: 0, pendingTotalCount: 3, noActionCount: 0, fixedCount: 1, fixedTotalCount: 1, totalCount: 4 },
      { rank: 1, groupName: '贷款组', developer: '贷款负责人', newCount: 2, openCount: 3, reopenedCount: 5, deferredCount: 4, pendingVerificationCount: 6, pendingTotalCount: 20, noActionCount: 1, fixedCount: 7, fixedTotalCount: 8, totalCount: 28 },
    ])
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })

    try {
      const wrapper = mount(ReplayIssuePage)
      await flushPromises()
      await wrapper.get('[data-testid="person-ranking-entry"]').trigger('click')
      await flushPromises()
      await wrapper.findAll('[data-testid="person-ranking-group-tab"]')[1].trigger('click')
      await wrapper.get('[data-testid="copy-person-ranking"]').trigger('click')
      await flushPromises()

      expect(writeText).toHaveBeenCalledWith(
        '排名\t分组\t开发负责人\t新建\t打开\t重新打开\t延后修复\t修复待验证\t未修复总数\t无需处理\t已修复\t已修复总数\n1\t贷款组\t贷款负责人\t2\t3\t5\t4\t6\t20\t1\t7\t8',
      )
      expect(writeText.mock.calls[0][0]).not.toContain('存款负责人')
    } finally {
      if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
      else delete navigator.clipboard
      if (secureContextDescriptor) Object.defineProperty(window, 'isSecureContext', secureContextDescriptor)
      else delete window.isSecureContext
    }
  })

  it('loads summary data only after a click and reloads it after closing and reopening', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(getReplayIssueGroupSummaries).not.toHaveBeenCalled()
    expect(getReplayIssuePersonRankings).not.toHaveBeenCalled()

    const groupEntry = wrapper.get('[data-testid="group-summary-entry"]')
    await groupEntry.trigger('click')
    await flushPromises()
    expect(getReplayIssueGroupSummaries).toHaveBeenCalledTimes(1)
    expect(getReplayIssuePersonRankings).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="summary-modal"] thead').text()).toContain('分组')
    expect(wrapper.get('[data-testid="summary-modal"] thead').text()).toContain('修复待验证')
    expect(wrapper.get('[data-testid="summary-modal"] tbody').text()).toContain('贷款组')

    await wrapper.get('[data-testid="close-summary-modal"]').trigger('click')
    expect(wrapper.find('[data-testid="summary-modal"]').exists()).toBe(false)
    await groupEntry.trigger('click')
    await flushPromises()
    expect(getReplayIssueGroupSummaries).toHaveBeenCalledTimes(2)
  })

  it('renders the compact four-group summary while keeping the person ranking scrollable', async () => {
    getReplayIssueGroupSummaries.mockResolvedValue([
      { groupName: '贷款组', totalCount: 30 },
      { groupName: '测试组-应忽略', totalCount: 99 },
      { groupName: '结算组', totalCount: 40 },
      { groupName: '公共组', totalCount: 10 },
      { groupName: '存款组', totalCount: 20 },
    ])
    getReplayIssuePersonRankings.mockResolvedValue(Array.from({ length: 30 }, (_, index) => ({
      rank: index + 1,
      groupName: '存款组',
      developer: `开发负责人${String(index + 1).padStart(2, '0')}(c-dev${index + 1})`,
      newCount: index + 1,
      openCount: index + 2,
      deferredCount: index + 3,
      reopenedCount: index + 4,
      pendingVerificationCount: index + 5,
      totalCount: index + 15,
    })))

    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const groupEntry = wrapper.get('[data-testid="group-summary-entry"]')
    await groupEntry.trigger('click')
    await flushPromises()
    const groupRows = wrapper.findAll('[data-testid="summary-modal"] tbody tr')
    expect(groupRows).toHaveLength(4)
    expect(groupRows.map((row) => row.find('td').text())).toEqual(['公共组', '存款组', '贷款组', '结算组'])
    expect(wrapper.get('[data-testid="summary-modal"] tbody').text()).not.toContain('测试组-应忽略')
    expect(wrapper.get('[data-testid="summary-modal"]').classes()).toContain('replay-summary-modal-group')

    await wrapper.get('[data-testid="close-summary-modal"]').trigger('click')
    const personEntry = wrapper.get('[data-testid="person-ranking-entry"]')
    await personEntry.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="summary-modal"] tbody tr')).toHaveLength(30)
    expect(wrapper.get('[data-testid="summary-modal"]').classes()).toContain('replay-summary-modal-person')
  })

  it('deduplicates repeated clicks while a summary request is running', async () => {
    let resolveRequest
    getReplayIssuePersonRankings.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve }))
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const entry = wrapper.get('[data-testid="person-ranking-entry"]')
    await entry.trigger('click')
    await entry.trigger('click')
    expect(getReplayIssuePersonRankings).toHaveBeenCalledTimes(1)

    resolveRequest([])
    await flushPromises()
    await wrapper.get('[data-testid="close-summary-modal"]').trigger('click')
    await entry.trigger('click')
    expect(getReplayIssuePersonRankings).toHaveBeenCalledTimes(2)
  })

  it('copies visible modal tables as TSV including their title rows', async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })

    try {
      const wrapper = mount(ReplayIssuePage)
      await flushPromises()

      const groupEntry = wrapper.get('[data-testid="group-summary-entry"]')
      await groupEntry.trigger('click')
      await flushPromises()
      await wrapper.get('[data-testid="copy-group-summary"]').trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenLastCalledWith(
        '分组\t新建\t打开\t重新打开\t延后修复\t修复待验证\t未修复总数\t无需处理\t已修复\t已修复总数\n贷款组\t1\t8\t2\t3\t1\t15\t2\t4\t6',
      )

      await wrapper.get('[data-testid="close-summary-modal"]').trigger('click')
      const personEntry = wrapper.get('[data-testid="person-ranking-entry"]')
      await personEntry.trigger('click')
      await flushPromises()
      expect(wrapper.get('[data-testid="summary-modal"]').text()).toContain('各组开发负责人问题排名')
      await wrapper.findAll('[data-testid="person-ranking-group-tab"]')[1].trigger('click')
      await wrapper.get('[data-testid="copy-person-ranking"]').trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenLastCalledWith(
        '排名\t分组\t开发负责人\t新建\t打开\t重新打开\t延后修复\t修复待验证\t未修复总数\t无需处理\t已修复\t已修复总数\n1\t贷款组\t张三(c-zhangs3)、李四(c-lisi)\t1\t5\t1\t2\t1\t10\t2\t3\t5',
      )
    } finally {
      if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
      else delete navigator.clipboard
      if (secureContextDescriptor) Object.defineProperty(window, 'isSecureContext', secureContextDescriptor)
      else delete window.isSecureContext
    }
  })

  it('exports all rows using the current filters', async () => {
    getReplayIssueHeaderFilterOptions.mockResolvedValueOnce(['公共组'])
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    const domainHeader = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf('领域'))
    await domainHeader.get('.replay-header-filter-button').trigger('click')
    await flushPromises()
    await wrapper.findAll('[data-testid="header-filter-panel"] input[type="checkbox"]').at(0).setValue(true)
    await wrapper.find('[data-testid="header-filter-panel"] .replay-button-primary').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="export-excel"]').trigger('click')
    await flushPromises()

    expect(exportReplayIssues).toHaveBeenCalledWith(expect.objectContaining({
      groupNames: ['公共组'],
    }))
  })

  it('keeps domain and sandbox available through header filters', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    for (const label of ['领域', '是否沙箱']) {
      const header = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf(label))
      expect(header.find('.replay-header-filter-button').exists()).toBe(true)
    }
  })

  it('loads formal import metadata and exposes occurrence rounds through the header filter', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const occurrenceHeader = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf('出现批次'))
    await occurrenceHeader.get('.replay-header-filter-button').trigger('click')
    await flushPromises()

    expect(getReplayIssueHeaderFilterOptions).toHaveBeenLastCalledWith(expect.objectContaining({ field: 'occurrenceBatch' }))
    expect(getReplayImportRounds).toHaveBeenCalledTimes(1)
  })

  it('successful import reports counts and refreshes stats options and first page', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    const selectedFile = await openImport(wrapper)
    await wrapper.get('[data-testid="submit-import"]').trigger('click')
    await flushPromises()

    expect(importReplayIssues).toHaveBeenCalledWith(selectedFile, 'secret', 'QUERY')
    expect(wrapper.text()).toContain('导入完成：16 条')
    expect(wrapper.text()).toContain('新增 0 条')
    expect(wrapper.text()).toContain('忽略 0 条')
    expect(getReplayIssueStats).toHaveBeenCalledTimes(2)
    expect(getReplayIssueOptions).toHaveBeenCalledTimes(2)
    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }))
  })

  it('defaults formal import to query, submits dz, and has no full refresh entry', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.find('[data-testid="open-full-refresh"]').exists()).toBe(false)
    const selectedFile = await openImport(wrapper)
    expect(wrapper.get('[data-testid="import-type-query"]').element.checked).toBe(true)

    await wrapper.get('[data-testid="import-type-dz"]').setValue(true)
    await wrapper.get('[data-testid="submit-import"]').trigger('click')
    await flushPromises()

    expect(importReplayIssues).toHaveBeenCalledWith(selectedFile, 'secret', 'DZ')
    expect(wrapper.find('[data-testid="full-refresh-modal"]').exists()).toBe(false)
  })

  it('disables previous and next controls at server page boundaries', async () => {
    arrangeApi({ total: 51 })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const previous = wrapper.get('[data-testid="previous-page"]')
    const next = wrapper.get('[data-testid="next-page"]')
    expect(previous.attributes('disabled')).toBeDefined()
    expect(next.attributes('disabled')).toBeUndefined()

    await next.trigger('click')
    await flushPromises()
    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50, limit: 50 }))
    expect(wrapper.get('[data-testid="next-page"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="previous-page"]').trigger('click')
    await flushPromises()
    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0, limit: 50 }))
  })

  it('resets to the first page when the page size changes', async () => {
    arrangeApi({ total: 101 })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="next-page"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="page-size"]').setValue('100')
    await flushPromises()

    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0, limit: 100 }))
  })

  it('reports import failures from the API', async () => {
    importReplayIssues.mockRejectedValueOnce(new Error('口令不正确'))
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await openImport(wrapper)
    await wrapper.get('[data-testid="submit-import"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('导入失败：口令不正确')
  })

  it('prevents duplicate imports while an import is pending', async () => {
    let resolveImport
    importReplayIssues.mockImplementationOnce(() => new Promise((resolve) => {
      resolveImport = resolve
    }))
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await openImport(wrapper)

    const submit = wrapper.get('[data-testid="submit-import"]')
    await submit.trigger('click')
    await submit.trigger('click')
    expect(importReplayIssues).toHaveBeenCalledTimes(1)
    expect(submit.attributes('disabled')).toBeDefined()

    resolveImport({ totalRows: 16, sandboxRows: 8, nonSandboxRows: 8, rowsBySheet: {} })
    await flushPromises()
  })

  it('renders the requested columns in order and keeps manual content read-only', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.findAll('thead th').map((header) => header.text())).toEqual(visibleColumnLabels)
    const row = wrapper.get('[data-testid="replay-row"]')
    expect(row.find('.replay-manual-value').exists()).toBe(true)
    expect(row.find('.replay-manual-value').attributes('class')).toContain('replay-manual-value')
    expect(row.find('[data-testid="edit-1"]').exists()).toBe(true)
    expect(row.find('[data-testid="tracking-1"]').exists()).toBe(true)
    expect(row.find('select').exists()).toBe(false)
  })

  it('displays developer and technology owners in separate columns', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const cells = wrapper.get('[data-testid="replay-row"]').findAll('td')
    const developerCell = cells.at(visibleColumnLabels.indexOf('开发负责人'))
    const bankOwnerCell = cells.at(visibleColumnLabels.indexOf('科技负责人'))
    expect(developerCell.text()).toBe('张三(c-zhangs3)、李四(c-lisi)')
    expect(developerCell.classes()).toContain('replay-person-cell')
    expect(developerCell.attributes('title')).toBe('张三(c-zhangs3)、李四(c-lisi)')
    expect(bankOwnerCell.text()).toBe('刘六(c-liul6)')
    expect(bankOwnerCell.classes()).toContain('replay-person-cell')
  })

  it('uses split person values in header filters and applies them as list filters', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const developerHeader = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf('开发负责人'))
    await developerHeader.get('.replay-header-filter-button').trigger('click')
    await flushPromises()
    expect(getReplayIssueHeaderFilterOptions).toHaveBeenLastCalledWith(expect.objectContaining({ field: 'developer' }))
    expect(wrapper.get('[data-testid="header-filter-panel"]').text()).toContain('张三(c-zhangs3)')
    expect(wrapper.get('[data-testid="header-filter-panel"]').text()).toContain('李四(c-lisi)')

    await wrapper.findAll('[data-testid="header-filter-panel"] input[type="checkbox"]').at(1).setValue(true)
    await wrapper.find('[data-testid="header-filter-panel"] .replay-button-primary').trigger('click')
    await flushPromises()

    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({
      developers: ['李四(c-lisi)'],
      offset: 0,
    }))
  })

  it('supports composable domain and sandbox header filters and clears them on reset', async () => {
    getReplayIssueHeaderFilterOptions
      .mockResolvedValueOnce(['公共组', '贷款组'])
      .mockResolvedValueOnce(['否', '是'])
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const domainHeader = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf('领域'))
    expect(domainHeader.find('.replay-header-filter-button').exists()).toBe(true)
    await domainHeader.get('.replay-header-filter-button').trigger('click')
    await flushPromises()
    expect(getReplayIssueHeaderFilterOptions).toHaveBeenLastCalledWith(expect.objectContaining({ field: 'groupName' }))
    await wrapper.findAll('[data-testid="header-filter-panel"] input[type="checkbox"]').at(0).setValue(true)
    await wrapper.find('[data-testid="header-filter-panel"] .replay-button-primary').trigger('click')
    await flushPromises()
    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({ groupNames: ['公共组'] }))

    const sandboxHeader = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf('是否沙箱'))
    expect(sandboxHeader.find('.replay-header-filter-button').exists()).toBe(true)
    await sandboxHeader.get('.replay-header-filter-button').trigger('click')
    await flushPromises()
    expect(getReplayIssueHeaderFilterOptions).toHaveBeenLastCalledWith(expect.objectContaining({
      field: 'sandbox',
      groupNames: ['公共组'],
    }))
    await wrapper.findAll('[data-testid="header-filter-panel"] input[type="checkbox"]').at(1).setValue(true)
    await wrapper.find('[data-testid="header-filter-panel"] .replay-button-primary').trigger('click')
    await flushPromises()
    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({
      groupNames: ['公共组'],
      sandboxes: ['是'],
      offset: 0,
    }))

    await wrapper.get('[data-testid="reset-filters"]').trigger('click')
    await flushPromises()
    const lastQuery = listReplayIssues.mock.calls.at(-1)[0]
    expect(lastQuery.groupNames).toBeUndefined()
    expect(lastQuery.sandboxes).toBeUndefined()
    expect(lastQuery.offset).toBe(0)
  })

  it('displays the cooperation person as real name and username', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const cooperationIndex = visibleColumnLabels.indexOf('需协同人')
    expect(wrapper.get('[data-testid="replay-row"]').findAll('td').at(cooperationIndex).text()).toBe('孙海英(sunhy1)')
  })

  it('displays a raw collaborator name when no username was matched', async () => {
    arrangeApi({ items: [{ ...fixtureRow, cooperation_person_username: '', cooperation_person_real_name: '夏燕' }] })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const cooperationIndex = visibleColumnLabels.indexOf('需协同人')
    expect(wrapper.get('[data-testid="replay-row"]').findAll('td').at(cooperationIndex).text()).toBe('夏燕')
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    expect(wrapper.get('[data-testid="edit-collaborator"]').element.value).toBe('夏燕')
  })

  it('disables editing for fixed issues', async () => {
    arrangeApi({ items: [{ ...fixtureRow, issue_status: '已修复' }] })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const editButton = wrapper.get('[data-testid="edit-1"]')
    expect(editButton.attributes('disabled')).toBeDefined()
    await editButton.trigger('click')
    expect(wrapper.find('[data-testid="edit-modal"]').exists()).toBe(false)
  })

  it('copies complete values only from the nine selected columns', async () => {
    const longDescription = '这是一个在表格中会被省略但复制时必须保留的完整问题描述'.repeat(8)
    arrangeApi({ items: [{ ...fixtureRow, issue_description: longDescription }] })
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })

    try {
      const wrapper = mount(ReplayIssuePage)
      await flushPromises()
      const cells = wrapper.get('[data-testid="replay-row"]').findAll('td')
      const copyableLabels = cells
        .map((cell, index) => cell.classes().includes('replay-copyable-cell') ? visibleColumnLabels[index] : null)
        .filter(Boolean)

      expect(copyableLabels).toEqual([
        '交易名称', '字段名', '流水号', '全局流水号', '问题描述', '初步问题分析', '最终处理方案', '备注', 'issue_key',
      ])

      await cells.at(visibleColumnLabels.indexOf('问题描述')).trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenCalledWith(longDescription)

      await cells.at(visibleColumnLabels.indexOf('交易码')).trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenCalledTimes(1)
    } finally {
      if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
      else delete navigator.clipboard
      if (secureContextDescriptor) Object.defineProperty(window, 'isSecureContext', secureContextDescriptor)
      else delete window.isSecureContext
    }
  })

  it('renders five lifecycle totals with four merged group details and all statuses', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const cards = wrapper.findAll('.replay-summary-card')
    expect(cards).toHaveLength(8)
    expect(cards.map((card) => card.find('strong').text())).toEqual(['4607', '0', '1200', '0', '800', '0', '500', '2107'])
    expect(cards[0].find('.replay-summary-tooltip').text()).toContain('公共组1000')
    const statusHeader = wrapper.findAll('thead th').at(visibleColumnLabels.indexOf('问题状态'))
    expect(statusHeader.find('.replay-header-filter-button').exists()).toBe(true)
  })

  it('keeps all eight desktop summary cards in one grid row', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.findAll('.replay-summary-card')).toHaveLength(8)
    expect(wrapper.get('.replay-summary').attributes('style')).toContain('--replay-summary-columns: 8')
  })

  it('normalizes numeric and boolean is_sandbox values for the visible sandbox column', async () => {
    arrangeApi({
      total: 4,
      items: [
        { ...fixtureRow, id: 1, is_sandbox: 1 },
        { ...fixtureRow, id: 2, is_sandbox: 0 },
        { ...fixtureRow, id: 3, is_sandbox: true },
        { ...fixtureRow, id: 4, is_sandbox: false },
      ],
    })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const sandboxIndex = visibleColumnLabels.indexOf('是否沙箱')
    expect(wrapper.findAll('[data-testid="replay-row"]').map((row) => row.findAll('td').at(sandboxIndex).text())).toEqual(['是', '否', '是', '否'])
  })

  it('requests the mobile navigation drawer from the compact toolbar control', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    await wrapper.get('[data-testid="mobile-navigation-toggle"]').trigger('click')

    expect(wrapper.emitted('toggleNavigation')).toEqual([[]])
  })

  it('edits all six fields together and opens tracking from the operation column', async () => {
    updateReplayIssue.mockResolvedValueOnce({ ...fixtureRow })
    searchReplayIssueUsers.mockResolvedValueOnce([{ username: 'sunhy1', realName: '孙海英', displayName: '孙海英(sunhy1)' }])
    getReplayIssueRoundTracking.mockResolvedValueOnce([{
      roundId: 2, roundCode: '20260808-001', importedAt: '2026-08-08 10:00:00', appeared: true,
      statusBefore: '延后修复', statusAfter: '重新打开', actionType: '再次出现',
      manualChangeCount: 2, finalStatus: '修复待验证',
      inheritedEvents: [
        { id: 3, operationType: '基础数据覆盖，人工内容继承', operationAt: '2026-08-08 10:00:00', operatorRealName: '系统', operatorUsername: 'SYSTEM', issueStatus: '打开', issueType: '代码问题', initialAnalysis: '人工分析', finalSolution: '人工方案', cooperationPersonUsername: 'alice', cooperationPersonRealName: '艾丽丝', remark: '人工备注', beforeSnapshot: '{"issueDescription":"旧基础数据"}', afterSnapshot: '{"issueDescription":"新基础数据"}', incomingSnapshot: '{"issueDescription":"Excel输入"}' },
      ],
      manualEvents: [
        { id: 2, operationType: '人工保存', operationAt: '2026-08-08 12:00:00', operatorRealName: '编辑人', operatorUsername: 'editor', issueStatus: '修复待验证', issueType: '代码问题', initialAnalysis: '核对返回值', finalSolution: '修正映射', cooperationPersonUsername: 'sunhy1', cooperationPersonRealName: '孙海英', beforeSnapshot: '{}', afterSnapshot: '{}', incomingSnapshot: null },
        { id: 1, operationType: '人工保存', operationAt: '2026-08-08 11:00:00', operatorRealName: '编辑人', operatorUsername: 'editor', issueStatus: '延后修复', issueType: '代码问题', initialAnalysis: '核对返回值', finalSolution: '修正映射', cooperationPersonUsername: 'sunhy1', cooperationPersonRealName: '孙海英', beforeSnapshot: '{}', afterSnapshot: '{}', incomingSnapshot: null },
      ],
    }])
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    expect(wrapper.get('[data-testid="edit-modal"]').text()).toContain('编辑回放问题')
    expect(wrapper.get('[data-testid="edit-modal"]').text()).not.toContain(fixtureRow.issue_key)
    await wrapper.get('.replay-modal-mask').trigger('click')
    expect(wrapper.get('[data-testid="edit-modal"]').exists()).toBe(true)
    await wrapper.get('[data-testid="edit-status"]').setValue('修复待验证')
    await wrapper.get('[data-testid="edit-remark"]').setValue('本批次需要联调验证')
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    await flushPromises()
    expect(updateReplayIssue).toHaveBeenCalledWith(1, expect.objectContaining({ issueStatus: '修复待验证', issueType: '代码问题', cooperationPersonUsername: 'sunhy1', remark: '本批次需要联调验证' }))

    await wrapper.get('[data-testid="tracking-1"]').trigger('click')
    await flushPromises()
    expect(getReplayIssueRoundTracking).toHaveBeenCalledWith(1)
    expect(wrapper.get('[data-testid="tracking-drawer"]').text()).toContain('20260808-001')
    expect(wrapper.get('[data-testid="tracking-drawer"]').text()).toContain('批次编号 20260808-001')
    expect(wrapper.get('[data-testid="tracking-drawer"]').text()).toContain('延后修复 → 重新打开')
    expect(wrapper.get('[data-testid="tracking-drawer"]').text()).toContain('人工修改 2 次')
    expect(wrapper.get('[data-testid="tracking-drawer"]').text()).toContain('本批次最终状态 修复待验证')
    expect(wrapper.get('[data-testid="tracking-drawer"]').text()).toContain('编辑人')
    expect(wrapper.get('[data-testid="tracking-round-2"]').attributes()).toHaveProperty('open')
    expect(wrapper.get('[data-testid="manual-events-2"]').attributes()).toHaveProperty('open')
    const inherited = wrapper.get('[data-testid="inherited-events-2"]')
    expect(inherited.attributes()).toHaveProperty('open')
    expect(inherited.text()).toContain('本批次继承内容（1）')
    expect(inherited.text()).toContain('人工分析')
    expect(inherited.text()).toContain('人工方案')
    expect(inherited.text()).toContain('艾丽丝(alice)')
    expect(inherited.text()).toContain('人工备注')
    expect(inherited.text()).toContain('旧基础数据')
    expect(inherited.text()).toContain('新基础数据')
    expect(inherited.text()).toContain('Excel输入')
    expect(wrapper.findAll('.replay-manual-events details').every((details) => !('open' in details.attributes()))).toBe(true)
    expect(wrapper.get('.replay-drawer-mask').exists()).toBe(true)
  })

  it('requires an issue type before saving', async () => {
    arrangeApi({ items: [{ ...fixtureRow, issue_status: '打开' }] })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await wrapper.get('[data-testid="edit-type"]').setValue('')
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    expect(updateReplayIssue).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="edit-modal"]').text()).toContain('问题类型为必填项')
  })

  it('offers open as an editable status and places the new issue types before other issues', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')

    expect(wrapper.get('[data-testid="edit-status"]').findAll('option').map((option) => option.text()).slice(1))
      .toEqual(['打开', '无需处理', '延后修复', '修复待验证'])
    const editTypes = wrapper.get('[data-testid="edit-type"]').findAll('option').map((option) => option.text())
    expect(editTypes.slice(-3)).toEqual(['合理差异', '外围问题', '其他问题'])
    expect(editTypes).not.toContain('esf问题')
  })

  it('shows unsent immediately after selecting a collaborator', async () => {
    searchReplayIssueUsers.mockResolvedValueOnce([{ displayName: '张三', username: 'c-zhangs3', email: 'c-zhangs3@spdbdev.com' }])
    getReplayIssueMailStatus.mockResolvedValueOnce({
      status: 'PENDING',
      recipients: [{ displayName: '张三', username: 'c-zhangs3', email: 'c-zhangs3@spdbdev.com', role: '协同人', status: 'SENT', failureMessage: null }],
    })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await wrapper.get('[data-testid="edit-collaborator"]').setValue('张三')
    await flushPromises()
    await wrapper.get('[data-testid="edit-collaborator"]').trigger('input')
    await wrapper.get('.replay-user-options button').trigger('click')
    expect(wrapper.get('[data-testid="edit-mail-status"]').text()).toBe('未发送')
  })

  it('shows one aggregated collaborator mail status and hides recipient details', async () => {
    getReplayIssueMailStatus.mockResolvedValueOnce({
      status: 'PENDING',
      recipients: [
        { displayName: '孙海英', username: 'sunhy1', email: 'sunhy1@example.com', role: '协同人', status: 'PENDING', failureMessage: null },
        { displayName: '张三', username: 'c-zhangs3', email: 'c-zhangs3@spdbdev.com', role: '开发负责人', status: 'SENT', failureMessage: null },
        { displayName: '刘六', username: 'liul6', email: 'liul6@example.com', role: '科技负责人', status: 'FAILED', failureMessage: 'SMTP 连接超时' },
      ],
    })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="edit-send-mail"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="edit-mail-section"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="edit-mail-status"]').text()).toContain('发送失败')
    expect(wrapper.get('[data-testid="edit-mail-status"]').attributes('title')).toBe('SMTP 连接超时')
  })

  it('projects a sent recipient to pending when any fingerprint field changes', async () => {
    getReplayIssueMailStatus.mockResolvedValueOnce({
      status: 'SENT',
      recipients: [{ displayName: '孙海英', username: 'sunhy1', email: 'sunhy1@example.com', role: '协同人', status: 'SENT', failureMessage: null }],
    })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="edit-mail-status"]').text()).toContain('已发送')
    await wrapper.get('[data-testid="edit-remark"]').setValue('内容变更')
    expect(wrapper.get('[data-testid="edit-mail-status"]').text()).toContain('待发送（内容已经变更）')
  })

  it('hides mail status when no collaborator is selected', async () => {
    arrangeApi({ items: [{ ...fixtureRow, cooperation_person_username: '', cooperation_person_real_name: '' }] })
    getReplayIssueMailStatus.mockResolvedValueOnce({
      status: 'PENDING',
      recipients: [{ displayName: '张三', username: 'c-wangsh8', email: 'c-wangsh8@spdbdev.com', role: '协同人', status: 'PENDING', failureMessage: null }],
    })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="edit-mail-status"]').exists()).toBe(false)
  })

  it('defaults the post-save confirmation to no and does not send when confirmed', async () => {
    getReplayIssueMailStatus.mockResolvedValue({
      status: 'PENDING',
      recipients: [{ displayName: '孙海英', username: 'sunhy1', email: 'sunhy1@example.com', role: '协同人', status: 'PENDING', failureMessage: null }],
    })
    updateReplayIssue.mockResolvedValueOnce({ ...fixtureRow, issue_status: '打开' })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="mail-confirm-modal"]').text()).toContain('issue_id 000845')
    expect(wrapper.get('[data-testid="mail-choice-no"]').element.checked).toBe(true)
    await wrapper.get('[data-testid="mail-confirm-submit"]').trigger('click')
    await flushPromises()
    expect(sendReplayIssueMail).not.toHaveBeenCalled()
  })

  it('sends only after choosing yes in the custom confirmation dialog', async () => {
    getReplayIssueMailStatus.mockResolvedValue({
      status: 'PENDING',
      recipients: [{ displayName: '孙海英', username: 'sunhy1', email: 'sunhy1@example.com', role: '协同人', status: 'PENDING', failureMessage: null }],
    })
    updateReplayIssue.mockResolvedValueOnce({ ...fixtureRow, issue_status: '打开' })
    sendReplayIssueMail.mockResolvedValueOnce({ status: 'SENT', recipients: [{ role: '协同人', status: 'SENT' }] })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="mail-choice-yes"]').setValue(true)
    await wrapper.get('[data-testid="mail-confirm-submit"]').trigger('click')
    await flushPromises()
    expect(sendReplayIssueMail).toHaveBeenCalledWith(1, ['sunhy1@example.com'])
  })

  it('never opens mail confirmation for repair-pending verification', async () => {
    getReplayIssueMailStatus.mockResolvedValue({
      status: 'PENDING',
      recipients: [{ displayName: '孙海英', username: 'sunhy1', email: 'sunhy1@example.com', role: '协同人', status: 'PENDING', failureMessage: null }],
    })
    updateReplayIssue.mockResolvedValueOnce({ ...fixtureRow, issue_status: '修复待验证' })
    window.confirm = vi.fn()
    const confirm = window.confirm
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await wrapper.get('[data-testid="edit-status"]').setValue('修复待验证')
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    await flushPromises()

    expect(confirm).not.toHaveBeenCalled()
    expect(sendReplayIssueMail).not.toHaveBeenCalled()
  })

  it('saves a remark while keeping the editable open status', async () => {
    const openIssue = { ...fixtureRow, issue_status: '打开', remark: '原备注' }
    arrangeApi({ items: [openIssue] })
    updateReplayIssue.mockResolvedValueOnce({ ...openIssue, remark: '111' })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    expect(wrapper.get('[data-testid="edit-status"]').element.value).toBe('打开')
    await wrapper.get('[data-testid="edit-remark"]').setValue('111')
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    await flushPromises()

    expect(updateReplayIssue).toHaveBeenCalledWith(1, expect.objectContaining({ issueStatus: '打开', remark: '111' }))
    expect(wrapper.find('[data-testid="edit-modal"]').exists()).toBe(false)
  })

  it('keeps the current page after saving an issue', async () => {
    arrangeApi({ total: 101 })
    updateReplayIssue.mockResolvedValueOnce({ ...fixtureRow })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="next-page"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await wrapper.get('[data-testid="edit-status"]').setValue('延后修复')
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    await flushPromises()

    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50, limit: 50 }))
    expect(wrapper.get('[data-testid="replay-row"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="edit-modal"]').exists()).toBe(false)
  })

  it('refreshes lifecycle totals after saving a status change', async () => {
    const initialStats = {
      total: 4607,
      newTotal: 0,
      openTotal: 1200,
      processingTotal: 800,
      pendingVerificationTotal: 500,
      fixedTotal: 2107,
      groupCounts: {},
      importedAt: '2026-08-04T10:00:00',
    }
    const updatedStats = { ...initialStats, openTotal: 1199, pendingVerificationTotal: 501 }
    getReplayIssueStats.mockReset()
    getReplayIssueStats.mockResolvedValueOnce(initialStats).mockResolvedValueOnce(updatedStats)
    updateReplayIssue.mockResolvedValueOnce({ ...fixtureRow, issue_status: '修复待验证' })

    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    expect(wrapper.findAll('.replay-summary-card')[2].find('strong').text()).toBe('1200')

    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await wrapper.get('[data-testid="edit-status"]').setValue('修复待验证')
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    await flushPromises()

    expect(getReplayIssueStats).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('.replay-summary-card')[2].find('strong').text()).toBe('1199')
    expect(wrapper.findAll('.replay-summary-card')[6].find('strong').text()).toBe('501')
  })

  it('closes the edit modal when a saved status change removes the issue from the refreshed list', async () => {
    updateReplayIssue.mockResolvedValueOnce({ ...fixtureRow, issue_status: '修复待验证' })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await wrapper.get('[data-testid="edit-status"]').setValue('修复待验证')
    listReplayIssues.mockResolvedValueOnce({ total: 0, items: [] })
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    await flushPromises()

    expect(updateReplayIssue).toHaveBeenCalledWith(1, expect.objectContaining({ issueStatus: '修复待验证' }))
    expect(wrapper.find('[data-testid="edit-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="replay-row"]').exists()).toBe(false)
  })
})
