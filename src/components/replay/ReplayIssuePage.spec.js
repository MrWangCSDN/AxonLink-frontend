import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReplayIssuePage from './ReplayIssuePage.vue'
import {
  getReplayIssueOptions,
  getReplayIssueStats,
  importReplayIssues,
  listReplayIssues,
  searchReplayIssueUsers,
  getReplayIssueTracking,
  updateReplayIssue,
} from '../../api/replayIssues.js'

vi.mock('../../api/replayIssues.js', () => ({
  getReplayIssueOptions: vi.fn(),
  getReplayIssueStats: vi.fn(),
  importReplayIssues: vi.fn(),
  listReplayIssues: vi.fn(),
  searchReplayIssueUsers: vi.fn(),
  getReplayIssueTracking: vi.fn(),
  updateReplayIssue: vi.fn(),
}))

const fixtureRow = {
  id: 1, source_sheet: '贷款组', group_name: '贷款组', is_sandbox: 0, row_order: 2,
  domain: '贷款组', sequence_no: '59', batch_no: 'RPT20260803-194444-3815',
  transaction_code: '6208', transaction_name: '对公贷款还款计划查询', issue_level: '交易级',
  registered_date: '20260803', field_name: '响应码', issue_description: 'CCBS响应不一致',
  transaction_owner: '张济华', issue_status: '分析中', issue_type: '代码问题', initial_analysis: '核对返回值',
  final_solution: '修正映射', cooperation_person_username: 'sunhy1', cooperation_person_real_name: '孙海英',
  serial_no: '001012213710102', defect_repair_date: '', remark: '历史备注', import_date: '2026-08-04',
  affected_transaction_count: '58', issue_id: '000845', issue_key: 'TRAN|6208|响应码',
  historical_occurrence_count: '4', first_occurrence_date: '2026-07-28 00:00:00.0',
  last_occurrence_date: '2026-07-31 00:00:00.0', imported_at: '2026-08-04T10:00:00',
}

const visibleColumnLabels = [
  '领域', '是否沙箱', '批次', '交易码', '交易名称', '问题级别', '登记日期', '导入时间', '字段名', '问题描述',
  '交易负责人', '操作', '问题状态', '问题类型', '初步问题分析', '最终处理方案', '需协同人', '备注', '流水号', '缺陷修复日期',
  '该问题出现在的交易笔数', 'issue_id', 'issue_key', '历史出现次数', '首次出现日期', '上次出现日期',
]

function arrangeApi({ total = 4607, items = [fixtureRow] } = {}) {
  listReplayIssues.mockResolvedValue({ total, items })
  getReplayIssueOptions.mockResolvedValue({
    groups: ['公共组'],
    issueLevels: ['交易级'],
    issueTypes: ['迁移问题', '防腐问题', '代码问题', '新核心下线', '其他问题'],
    issueStatuses: ['打开', '分析中', '延后修复', '修复待验证', '重新打开', '已修复'],
  })
  getReplayIssueStats.mockResolvedValue({
    total,
    openTotal: 1200,
    processingTotal: 800,
    pendingVerificationTotal: 500,
    fixedTotal: 2107,
    groupCounts: {
      公共组: { total: 1000, open: 300, processing: 200, pendingVerification: 100, fixed: 400 },
      存款组: { total: 1100, open: 300, processing: 200, pendingVerification: 100, fixed: 500 },
      贷款组: { total: 1200, open: 300, processing: 200, pendingVerification: 100, fixed: 600 },
      结算组: { total: 1307, open: 300, processing: 200, pendingVerification: 200, fixed: 607 },
    },
    importedAt: '2026-08-04T10:00:00',
  })
  importReplayIssues.mockResolvedValue({ totalRows: 16, sandboxRows: 8, nonSandboxRows: 8, rowsBySheet: {} })
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
  it('keeps server paging and all filters in the list request', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    await wrapper.get('[data-testid="group-filter"]').setValue('公共组')
    await wrapper.get('[data-testid="issue-level-filter"]').setValue('交易级')
    await wrapper.get('[data-testid="issue-type-filter"]').setValue('代码问题')
    await wrapper.get('[data-testid="sandbox-filter"]').setValue('false')
    await wrapper.get('[data-testid="transaction-owner-filter"]').setValue('张')
    await wrapper.get('[data-testid="cooperation-person-filter"]').setValue('孙')
    await wrapper.get('[data-testid="keyword-filter"]').setValue('CCBS')
    await wrapper.get('[data-testid="query-button"]').trigger('click')

    expect(listReplayIssues).toHaveBeenLastCalledWith({
      groupName: '公共组',
      issueLevel: '交易级',
      issueType: '代码问题',
      sandbox: false,
      transactionOwner: '张',
      cooperationPerson: '孙',
      keyword: 'CCBS',
      limit: 50,
      offset: 0,
    })
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

  it('renders five lifecycle totals with four merged group details and all statuses', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    const cards = wrapper.findAll('.replay-summary-card')
    expect(cards).toHaveLength(5)
    expect(cards.map((card) => card.find('strong').text())).toEqual(['4607', '1200', '800', '500', '2107'])
    expect(cards[0].find('.replay-summary-tooltip').text()).toContain('公共组1000')
    expect(wrapper.get('[data-testid="issue-status-filter"]').findAll('option').map((option) => option.text())).toEqual([
      '全部', '打开', '分析中', '延后修复', '修复待验证', '重新打开', '已修复',
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

    expect(wrapper.findAll('[data-testid="replay-row"]').map((row) => row.findAll('td').at(1).text())).toEqual(['是', '否', '是', '否'])
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
    getReplayIssueTracking.mockResolvedValueOnce([{ id: 1, operationType: '人工保存', operationAt: '2026-08-05 10:00:00', operatorRealName: '编辑人', operatorUsername: 'editor', issueStatus: '分析中', issueType: '代码问题', initialAnalysis: '核对返回值', finalSolution: '修正映射', cooperationPersonUsername: 'sunhy1', cooperationPersonRealName: '孙海英', beforeSnapshot: '{}', afterSnapshot: '{}', incomingSnapshot: null }])
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    expect(wrapper.get('[data-testid="edit-modal"]').text()).toContain('编辑回放问题')
    expect(wrapper.get('[data-testid="edit-modal"]').text()).not.toContain(fixtureRow.issue_key)
    await wrapper.get('.replay-modal-mask').trigger('click')
    expect(wrapper.get('[data-testid="edit-modal"]').exists()).toBe(true)
    await wrapper.get('[data-testid="edit-status"]').setValue('修复待验证')
    await wrapper.get('[data-testid="edit-remark"]').setValue('本轮需要联调验证')
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    await flushPromises()
    expect(updateReplayIssue).toHaveBeenCalledWith(1, expect.objectContaining({ issueStatus: '修复待验证', issueType: '代码问题', cooperationPersonUsername: 'sunhy1', remark: '本轮需要联调验证' }))

    await wrapper.get('[data-testid="tracking-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="tracking-drawer"]').text()).toContain('人工保存')
    expect(wrapper.get('[data-testid="tracking-drawer"]').text()).toContain('编辑人')
    expect(wrapper.get('.replay-drawer-mask').exists()).toBe(true)
  })

  it('keeps the current page after saving an issue', async () => {
    arrangeApi({ total: 101 })
    updateReplayIssue.mockResolvedValueOnce({ ...fixtureRow })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="next-page"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await wrapper.get('[data-testid="edit-status"]').setValue('分析中')
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    await flushPromises()

    expect(listReplayIssues).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50, limit: 50 }))
    expect(wrapper.get('[data-testid="replay-row"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="edit-modal"]').exists()).toBe(false)
  })

  it('keeps the edited row and modal open when refresh fails after save', async () => {
    updateReplayIssue.mockResolvedValueOnce({ ...fixtureRow })
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await wrapper.get('[data-testid="edit-1"]').trigger('click')
    await wrapper.get('[data-testid="edit-status"]').setValue('分析中')
    listReplayIssues.mockRejectedValueOnce(new Error('网络暂时不可用'))
    await wrapper.get('[data-testid="save-edit"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="edit-modal"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="replay-row"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('保存成功，但列表刷新失败')
  })
})
