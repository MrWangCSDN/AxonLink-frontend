import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReplayIssuePage from './ReplayIssuePage.vue'
import {
  getReplayIssueOptions,
  getReplayIssueStats,
  importReplayIssues,
  listReplayIssues,
} from '../../api/replayIssues.js'

vi.mock('../../api/replayIssues.js', () => ({
  getReplayIssueOptions: vi.fn(),
  getReplayIssueStats: vi.fn(),
  importReplayIssues: vi.fn(),
  listReplayIssues: vi.fn(),
}))

const fixtureRow = {
  id: 1, source_sheet: '贷款组', group_name: '贷款组', is_sandbox: 0, row_order: 2,
  domain: '贷款组', sequence_no: '59', batch_no: 'RPT20260803-194444-3815',
  transaction_code: '6208', transaction_name: '对公贷款还款计划查询', issue_level: '交易级',
  registered_date: '20260803', field_name: '响应码', issue_description: 'CCBS响应不一致',
  transaction_owner: '张济华', issue_type: '数据差异', initial_analysis: '核对返回值',
  final_solution: '修正映射', resolved_date: '', cooperation_group: '', resolver: '',
  serial_no: '001012213710102', data_repair_date: '', remark: '',
  affected_transaction_count: '58', issue_id: '000845', issue_key: 'TRAN|6208|响应码',
  historical_occurrence_count: '4', first_occurrence_date: '2026-07-28 00:00:00.0',
  last_occurrence_date: '2026-07-31 00:00:00.0', imported_at: '2026-08-04T10:00:00',
}

const visibleFields = [
  'domain', 'sequence_no', 'batch_no', 'transaction_code', 'transaction_name', 'issue_level',
  'registered_date', 'field_name', 'issue_description', 'transaction_owner', 'issue_type',
  'initial_analysis', 'final_solution', 'resolved_date', 'cooperation_group', 'resolver',
  'serial_no', 'data_repair_date', 'remark', 'affected_transaction_count', 'issue_id',
  'issue_key', 'historical_occurrence_count', 'first_occurrence_date', 'last_occurrence_date',
  'imported_at',
]

function arrangeApi({ total = 4607, items = [fixtureRow] } = {}) {
  listReplayIssues.mockResolvedValue({ total, items })
  getReplayIssueOptions.mockResolvedValue({
    groups: ['公共组'],
    issueLevels: ['交易级'],
    issueTypes: ['数据差异'],
  })
  getReplayIssueStats.mockResolvedValue({
    total,
    groupCount: 4,
    sandboxCount: 1213,
    importedAt: '2026-08-04T10:00:00',
  })
  importReplayIssues.mockResolvedValue({ totalRows: 16, sandboxRows: 8, nonSandboxRows: 8, rowsBySheet: {} })
}

async function openImport(wrapper) {
  await wrapper.get('[data-testid="open-import"]').trigger('click')
  const input = wrapper.get('[data-testid="import-file"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [new File(['x'], 'issues.xlsx')] })
  await input.trigger('change')
  await wrapper.get('[data-testid="import-token"]').setValue('secret')
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
    await wrapper.get('[data-testid="issue-type-filter"]').setValue('数据差异')
    await wrapper.get('[data-testid="sandbox-filter"]').setValue('false')
    await wrapper.get('[data-testid="keyword-filter"]').setValue('CCBS')
    await wrapper.get('[data-testid="query-button"]').trigger('click')

    expect(listReplayIssues).toHaveBeenLastCalledWith({
      groupName: '公共组',
      issueLevel: '交易级',
      issueType: '数据差异',
      sandbox: false,
      keyword: 'CCBS',
      limit: 50,
      offset: 0,
    })
  })

  it('successful import reports counts and refreshes stats options and first page', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()
    await openImport(wrapper)
    await wrapper.get('[data-testid="submit-import"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('导入完成：16 条')
    expect(wrapper.text()).toContain('沙箱 8 条')
    expect(wrapper.text()).toContain('非沙箱 8 条')
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

  it('renders all 26 visible snake_case-backed columns in order', async () => {
    const wrapper = mount(ReplayIssuePage)
    await flushPromises()

    expect(wrapper.findAll('thead th')).toHaveLength(26)
    expect(wrapper.get('[data-testid="replay-row"]').findAll('td').map((cell) => cell.text())).toEqual(
      visibleFields.map((field) => fixtureRow[field] || '-'),
    )
  })
})
