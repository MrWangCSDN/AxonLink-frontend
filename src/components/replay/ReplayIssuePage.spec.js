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
  fullRefreshReplayIssues,
  importReplayIssues,
  listReplayIssues,
  searchReplayIssueUsers,
  sendReplayIssueMail,
  updateReplayIssue,
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
  fullRefreshReplayIssues: vi.fn(),
  importReplayIssues: vi.fn(),
  listReplayIssues: vi.fn(),
  searchReplayIssueUsers: vi.fn(),
  sendReplayIssueMail: vi.fn(),
  updateReplayIssue: vi.fn(),
}))

const fixtureRow = {
  id: 1, source_sheet: '贷款组', group_name: '贷款组', is_sandbox: 0, row_order: 2,
  domain: '贷款组', sequence_no: '59', batch_no: 'RPT20260803-194444-3815',
  transaction_code: '6208', transaction_name: '对公贷款还款计划查询', issue_level: '交易级',
  registered_date: '20260803', field_name: '响应码', issue_description: 'CCBS响应不一致',
  transaction_owner: '张济华', matched_developer: '张三(c-zhangs3)、李四(c-lisi)', matched_bank_owner: '刘六(c-liul6)', issue_status: '延后修复', issue_type: '代码问题', initial_analysis: '核对返回值',
  final_solution: '修正映射', cooperation_person_username: 'sunhy1', cooperation_person_real_name: '孙海英',
  serial_no: '001012213710102', defect_repair_date: '', remark: '历史备注', import_date: '2026-08-04',
  affected_transaction_count: '58', issue_id: '000845', issue_key: 'TRAN|6208|响应码',
  historical_occurrence_count: '4', first_occurrence_date: '2026-07-28 00:00:00.0',
  last_occurrence_date: '2026-07-31 00:00:00.0', imported_at: '2026-08-04T10:00:00',
  coverage_round: '20260808-001', occurrence_rounds: '20260808-001、20260807-001',
}

const visibleColumnLabels = [
  '领域', 'issue_id', '是否沙箱', '交易码', '交易名称', '问题级别', '字段名', '流水号', '全局流水号', '问题描述',
  '开发负责人', '科技负责人', '操作', '问题状态', '问题类型', '初步问题分析', '最终处理方案', '需协同人', '备注',
  '批次', '导入时间', '登记时间', '缺陷修复日期', '该问题出现在的交易笔数', 'issue_key', '历史出现次数', '首次出现日期', '上次出现日期', '出现批次',
]

function arrangeApi({ total = 4607, items = [fixtureRow] } = {}) {
  listReplayIssues.mockResolvedValue({ total, items })
  getReplayIssueMailStatus.mockResolvedValue({ status: 'UNSENT', sentAt: null })
  getReplayIssueOptions.mockResolvedValue({
    groups: ['公共组'],
    issueLevels: ['交易级'],
    issueTypes: ['迁移问题', '防腐问题', '代码问题', '新核心下线', '参数问题', '平台问题', '规则差异问题', '合理差异', '其他问题'],
    issueStatuses: ['新建', '打开', '延后修复', '修复待验证', '重新打开', '已修复'],
    coverageRounds: ['20260808-001', '20260807-001'],
  })
  getReplayIssueHeaderFilterOptions.mockResolvedValue(['张三(c-zhangs3)', '李四(c-lisi)', '赵六(c-zhaol6)'])
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
  getReplayIssueGroupSummaries.mockResolvedValue([
    { groupName: '贷款组', openCount: 8, deferredCount: 3, reopenedCount: 2, pendingVerificationCount: 1, totalCount: 15 },
  ])
  getReplayIssuePersonRankings.mockResolvedValue([
    { rank: 1, groupName: '贷款组', developer: '张三(c-zhangs3)、李四(c-lisi)', openCount: 5, deferredCount: 2, reopenedCount: 1, pendingVerificationCount: 1, totalCount: 10 },
  ])
  importReplayIssues.mockResolvedValue({ totalRows: 16, sandboxRows: 8, nonSandboxRows: 8, rowsBySheet: {} })
  fullRefreshReplayIssues.mockResolvedValue({ totalRows: 2, generatedIdentityRows: 1, rowsBySheet: { 基础数据: 2 } })
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

async function prepareFullRefresh(wrapper) {
  await wrapper.get('[data-testid="open-full-refresh"]').trigger('click')
  const input = wrapper.get('[data-testid="full-refresh-file"]')
  const file = new File(['x'], 'full-refresh.xlsx')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
  await input.trigger('change')
  await wrapper.get('[data-testid="full-refresh-token"]').setValue('secret')
  await wrapper.get('[data-testid="full-refresh-confirm"]').setValue(true)
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
  it('loads hover summaries only when their entries are entered and hides them on leave', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(getReplayIssueGroupSummaries).not.toHaveBeenCalled()
    expect(getReplayIssuePersonRankings).not.toHaveBeenCalled()

    const groupEntry = wrapper.get('[data-testid="group-summary-entry"]')
    await groupEntry.trigger('mouseenter')
    await flushPromises()
    expect(getReplayIssueGroupSummaries).toHaveBeenCalledTimes(1)
    expect(getReplayIssuePersonRankings).not.toHaveBeenCalled()
    expect(groupEntry.get('thead').text()).toContain('分组')
    expect(groupEntry.get('thead').text()).toContain('修复待验证')
    expect(groupEntry.get('tbody').text()).toContain('贷款组')

    await groupEntry.trigger('mouseleave')
    expect(groupEntry.find('table').exists()).toBe(false)
    await groupEntry.trigger('mouseenter')
    await flushPromises()
    expect(getReplayIssueGroupSummaries).toHaveBeenCalledTimes(2)
  })

  it('renders both summary tables in viewport-fixed large overlays with 30 rows', async () => {
    getReplayIssueGroupSummaries.mockResolvedValue(Array.from({ length: 30 }, (_, index) => ({
      groupName: `测试组${String(index + 1).padStart(2, '0')}`,
      newCount: index + 1,
      openCount: index + 2,
      deferredCount: index + 3,
      reopenedCount: index + 4,
      pendingVerificationCount: index + 5,
      totalCount: index + 15,
    })))
    getReplayIssuePersonRankings.mockResolvedValue(Array.from({ length: 30 }, (_, index) => ({
      rank: index + 1,
      groupName: `测试组${(index % 4) + 1}`,
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
    await groupEntry.trigger('mouseenter')
    await flushPromises()
    expect(groupEntry.findAll('tbody tr')).toHaveLength(30)
    expect(groupEntry.get('.replay-summary-panel').classes()).toContain('replay-summary-panel-fixed')

    await groupEntry.trigger('mouseleave')
    const personEntry = wrapper.get('[data-testid="person-ranking-entry"]')
    await personEntry.trigger('mouseenter')
    await flushPromises()
    expect(personEntry.findAll('tbody tr')).toHaveLength(30)
    expect(personEntry.get('.replay-summary-panel').classes()).toContain('replay-summary-panel-fixed')
  })

  it('deduplicates repeated entry events while a hover summary request is running', async () => {
    let resolveRequest
    getReplayIssuePersonRankings.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve }))
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const entry = wrapper.get('[data-testid="person-ranking-entry"]')
    await entry.trigger('mouseenter')
    await entry.trigger('focusin')
    expect(getReplayIssuePersonRankings).toHaveBeenCalledTimes(1)

    resolveRequest([])
    await flushPromises()
    await entry.trigger('focusin')
    expect(getReplayIssuePersonRankings).toHaveBeenCalledTimes(1)
  })

  it('copies visible hover tables as TSV including their title rows', async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const secureContextDescriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })

    try {
      const wrapper = mount(ReplayIssuePage)
      await flushPromises()

      const groupEntry = wrapper.get('[data-testid="group-summary-entry"]')
      await groupEntry.trigger('mouseenter')
      await flushPromises()
      await groupEntry.get('[data-testid="copy-group-summary"]').trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenLastCalledWith(
        '分组\t新建\t打开\t延后修复\t重新打开\t修复待验证\t总数\n贷款组\t\t8\t3\t2\t1\t15',
      )

      const personEntry = wrapper.get('[data-testid="person-ranking-entry"]')
      await personEntry.trigger('mouseenter')
      await flushPromises()
      expect(personEntry.text()).toContain('各组开发负责人问题排名')
      await personEntry.get('[data-testid="copy-person-ranking"]').trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenLastCalledWith(
        '排名\t分组\t开发负责人\t新建\t打开\t延后修复\t重新打开\t修复待验证\t总数\n1\t贷款组\t张三(c-zhangs3)、李四(c-lisi)\t\t5\t2\t1\t1\t10',
      )
    } finally {
      if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
      else delete navigator.clipboard
      if (secureContextDescriptor) Object.defineProperty(window, 'isSecureContext', secureContextDescriptor)
      else delete window.isSecureContext
    }
  })

  it('exports all rows using the current filters', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="group-filter"]').setValue('公共组')
    await wrapper.get('[data-testid="issue-status-filter"]').setValue('延后修复')
    await wrapper.get('[data-testid="developer-filter"]').setValue('张')
    await wrapper.get('[data-testid="bank-owner-filter"]').setValue('刘')
    await wrapper.get('[data-testid="export-excel"]').trigger('click')
    await flushPromises()

    expect(exportReplayIssues).toHaveBeenCalledWith(expect.objectContaining({
      groupName: '公共组', issueStatus: '延后修复', developer: '张', bankOwner: '刘',
    }))
  })

  it('labels and orders the domain and sandbox filters consistently', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.findAll('.replay-filters > label').slice(0, 5).map((label) => label.get('span').text())).toEqual([
      '领域', '是否沙箱', '问题级别', '问题类型', '问题状态',
    ])
    expect(wrapper.get('[data-testid="sandbox-filter"]').findAll('option').map((option) => option.text())).toEqual(['全部', '是', '否'])
  })

  it('keeps server paging and all filters in the list request', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    await wrapper.get('[data-testid="group-filter"]').setValue('公共组')
    await wrapper.get('[data-testid="issue-level-filter"]').setValue('交易级')
    await wrapper.get('[data-testid="issue-type-filter"]').setValue('代码问题')
    await wrapper.get('[data-testid="sandbox-filter"]').setValue('false')
    await wrapper.get('[data-testid="developer-filter"]').setValue('张')
    await wrapper.get('[data-testid="bank-owner-filter"]').setValue('刘')
    await wrapper.get('[data-testid="cooperation-person-filter"]').setValue('孙')
    await wrapper.get('[data-testid="keyword-filter"]').setValue('CCBS')
    await wrapper.get('[data-testid="query-button"]').trigger('click')

    expect(listReplayIssues).toHaveBeenLastCalledWith({
      groupName: '公共组',
      issueLevel: '交易级',
      issueType: '代码问题',
      sandbox: false,
      developer: '张',
      bankOwner: '刘',
      cooperationPerson: '孙',
      keyword: 'CCBS',
      limit: 50,
      offset: 0,
    })
  })

  it('loads occurrence round options from formal imports and filters historical membership', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.get('[data-testid="coverage-round-filter"]').findAll('option').map((option) => option.text()))
      .toEqual(['全部', '20260808-001', '20260807-001'])

    await wrapper.get('[data-testid="coverage-round-filter"]').setValue('20260808-001')
    await wrapper.get('[data-testid="query-button"]').trigger('click')
    await flushPromises()

    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({
      coverageRound: '20260808-001',
      offset: 0,
    }))
    expect(getReplayImportRounds).toHaveBeenCalledTimes(1)
  })

  it('successful import reports counts and refreshes stats options and first page', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    const selectedFile = await openImport(wrapper)
    await wrapper.get('[data-testid="submit-import"]').trigger('click')
    await flushPromises()

    expect(importReplayIssues).toHaveBeenCalledWith(selectedFile, 'secret')
    expect(wrapper.text()).toContain('导入完成：16 条')
    expect(wrapper.text()).toContain('新增 0 条')
    expect(wrapper.text()).toContain('忽略 0 条')
    expect(getReplayIssueStats).toHaveBeenCalledTimes(2)
    expect(getReplayIssueOptions).toHaveBeenCalledTimes(2)
    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }))
  })

  it('keeps full refresh separate and requires file token and destructive confirmation', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.get('[data-testid="open-import"]').text()).toContain('导入 Excel')
    await wrapper.get('[data-testid="open-full-refresh"]').trigger('click')
    expect(wrapper.text()).toContain('仅处理 Excel 第一个 Sheet，按 issue_key 覆盖匹配数据；未匹配数据新增，其他已有数据和历史记录保留。')
    expect(wrapper.text()).toContain('请选择要处理的 Excel 文件，仅导入第一个 Sheet')
    expect(wrapper.text()).toContain('我确认按 issue_key 覆盖或新增首个 Sheet 数据')
    expect(wrapper.text()).not.toContain('清空当前问题和历史记录')
    const submit = wrapper.get('[data-testid="submit-full-refresh"]')
    expect(submit.attributes('disabled')).toBeDefined()

    const input = wrapper.get('[data-testid="full-refresh-file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['x'], 'issues.xlsx')] })
    await input.trigger('change')
    await wrapper.get('[data-testid="full-refresh-token"]').setValue('secret')
    expect(submit.attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="full-refresh-confirm"]').setValue(true)
    expect(submit.attributes('disabled')).toBeUndefined()
  })

  it('successful full refresh reports counts and reloads the first page', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    const file = await prepareFullRefresh(wrapper)

    await wrapper.get('[data-testid="submit-full-refresh"]').trigger('click')
    await flushPromises()

    expect(fullRefreshReplayIssues).toHaveBeenCalledTimes(1)
    expect(fullRefreshReplayIssues).toHaveBeenCalledWith(file, 'secret')
    expect(wrapper.text()).toContain('全量更新完成：2 条')
    expect(wrapper.text()).toContain('自动生成标识 1 条')
    expect(getReplayIssueStats).toHaveBeenCalledTimes(2)
    expect(getReplayIssueOptions).toHaveBeenCalledTimes(2)
    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }))
  })

  it('keeps the full refresh modal open when the backend rejects it', async () => {
    fullRefreshReplayIssues.mockRejectedValueOnce(new Error('基础数据页签缺少 issue_key'))
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await prepareFullRefresh(wrapper)

    await wrapper.get('[data-testid="submit-full-refresh"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="full-refresh-modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('全量更新失败：基础数据页签缺少 issue_key')
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

  it('renders the requested columns in order and keeps manual content read-only and red', async () => {
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
        '交易名称', '字段名', '流水号', '全局流水号', '问题描述', '初步问题分析', '最终处理方案', '备注', '批次', 'issue_key',
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
    expect(cards).toHaveLength(7)
    expect(cards.map((card) => card.find('strong').text())).toEqual(['4607', '0', '1200', '0', '800', '500', '2107'])
    expect(cards[0].find('.replay-summary-tooltip').text()).toContain('公共组1000')
    expect(wrapper.get('[data-testid="issue-status-filter"]').findAll('option').map((option) => option.text())).toEqual([
      '全部', '新建', '打开', '延后修复', '修复待验证', '重新打开', '已修复',
    ])
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
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await wrapper.get('[data-testid="edit-type"]').setValue('')
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    expect(updateReplayIssue).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="edit-modal"]').text()).toContain('问题类型为必填项')
  })

  it('offers open as an editable status and places reasonable difference before other issues', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')

    expect(wrapper.get('[data-testid="edit-status"]').findAll('option').map((option) => option.text()).slice(1))
      .toEqual(['打开', '延后修复', '修复待验证'])
    const editTypes = wrapper.get('[data-testid="edit-type"]').findAll('option').map((option) => option.text())
    expect(editTypes.slice(-2)).toEqual(['合理差异', '其他问题'])

    const queryTypes = wrapper.get('[data-testid="issue-type-filter"]').findAll('option').map((option) => option.text())
    expect(queryTypes.slice(-2)).toEqual(['合理差异', '其他问题'])
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
    expect(wrapper.findAll('.replay-summary-card')[5].find('strong').text()).toBe('501')
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
