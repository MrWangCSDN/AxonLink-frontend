import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Ledger from './ReplayReopenLedgerModal.vue'
import * as api from '../../api/replayReopens.js'

vi.mock('../../api/replayReopens.js', () => ({
  getReopenPermissions: vi.fn(), getReopenFilters: vi.fn(), listReopenEvents: vi.fn(), getReopenStatistics: vi.fn(),
  createReopenAppeal: vi.fn(), getReopenHistory: vi.fn(), searchReopenDevelopers: vi.fn(), listReopenAppeals: vi.fn(),
  getReopenAppeal: vi.fn(), decideReopenAppeal: vi.fn(), withdrawReopenAppeal: vi.fn(), reassignReopenAppeal: vi.fn(),
  assignReopenEvent: vi.fn(), getReopenPolicies: vi.fn(), saveReopenPolicy: vi.fn(),
  transferReopenCounts: vi.fn(),
}))
vi.mock('../../api/replayIssues.js', () => ({ searchReplayIssueUsers: vi.fn().mockResolvedValue([]) }))

const deferred = () => {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
const statistics = totalEvents => ({
  totalEvents, distinctIssues: 8, pendingEvents: 3,
  people: [{ username: null, realName: null, defaultCount: 2, adjustedIn: 0, adjustedOut: 0, currentCount: 2, issueCount: 2, pendingCount: 0 }],
  batches: [],
})
const batch = (wrapper, name) => wrapper.get(`input[data-batch="${name}"]`)
const apply = async wrapper => {
  await wrapper.get('[data-testid="apply-reopen-filters"]').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  vi.resetAllMocks()
  api.getReopenPermissions.mockResolvedValue({ enabled: true, canManagePermissions: true, policies: [], issueDomains: ['结算组'] })
  api.getReopenFilters.mockResolvedValue({ batchNames: ['RPT-1', 'RPT-2', 'DZ-1', 'OTHER-1'], issueDomains: ['结算组'] })
  api.getReopenStatistics.mockResolvedValue(statistics(40))
  api.listReopenEvents.mockResolvedValue({ items: [], total: 0 })
})

describe('reopen personnel and batch statistics', () => {
  it('opens statistics directly without hidden issue or import constraints or workflow pages', async () => {
    const w = mount(Ledger, { props: { replayType: 'ALL' }, attrs: { issueKey: 'KEY-1', sourceRoundId: 1022 } })
    await flushPromises()

    expect(api.getReopenStatistics).toHaveBeenLastCalledWith({ replayType: 'ALL', batchNames: [], onlyMine: false })
    expect(api.listReopenEvents).not.toHaveBeenCalled()
    expect(api.listReopenAppeals).not.toHaveBeenCalled()
    expect(api.getReopenPolicies).not.toHaveBeenCalled()
    expect(w.find('[data-testid="tab-events"]').exists()).toBe(false)
    expect(w.find('[data-testid="tab-appeals"]').exists()).toBe(false)
    expect(w.find('[data-testid="tab-policies"]').exists()).toBe(false)
    expect(w.find('[data-testid="issue-key-filter"]').exists()).toBe(false)
    expect(w.find('[data-testid="source-round-filter"]').exists()).toBe(false)
    for (const label of ['问题所属领域', '问题 key', '来源导入轮次', '事件编号', '当前负责人账号']) {
      expect(w.text()).not.toContain(label)
    }
    expect(w.text()).toContain('人员与批次统计')
    expect(w.text()).toContain('40 次')
    expect(w.text()).not.toContain('8 个问题')
    expect(w.text()).not.toContain('3 次待审')
    w.unmount()
  })

  it('selects multiple batches across transaction types and keeps applied arrays independent from drafts', async () => {
    const w = mount(Ledger)
    await flushPromises()
    await batch(w, 'RPT-1').setValue(true)
    await batch(w, 'DZ-1').setValue(true)
    await apply(w)

    expect(api.getReopenStatistics).toHaveBeenLastCalledWith({ replayType: 'ALL', batchNames: ['RPT-1', 'DZ-1'], onlyMine: false })
    const applied = api.getReopenStatistics.mock.calls.at(-1)[0]
    await batch(w, 'RPT-2').setValue(true)
    expect(applied.batchNames).toEqual(['RPT-1', 'DZ-1'])
    expect(w.get('[data-testid="applied-reopen-scope"]').text()).toContain('RPT-1、DZ-1')
    expect(w.get('[data-testid="applied-reopen-scope"]').text()).not.toContain('RPT-2')
    w.unmount()
  })

  it('restricts query and accounting batches immediately and preserves only compatible selections', async () => {
    const w = mount(Ledger)
    await flushPromises()
    await batch(w, 'RPT-1').setValue(true)
    await batch(w, 'DZ-1').setValue(true)
    await w.get('[data-testid="replay-type-filter"]').setValue('QUERY')
    await flushPromises()

    expect(api.getReopenFilters).toHaveBeenLastCalledWith({ replayType: 'QUERY' })
    expect(batch(w, 'RPT-1').element.checked).toBe(true)
    expect(w.find('input[data-batch="DZ-1"]').exists()).toBe(false)
    expect(w.find('input[data-batch="OTHER-1"]').exists()).toBe(false)
    await batch(w, 'RPT-2').setValue(true)
    await apply(w)
    expect(api.getReopenStatistics).toHaveBeenLastCalledWith({ replayType: 'QUERY', batchNames: ['RPT-1', 'RPT-2'], onlyMine: false })

    await w.get('[data-testid="replay-type-filter"]').setValue('DZ')
    await flushPromises()
    expect(w.find('input[data-batch="RPT-1"]').exists()).toBe(false)
    expect(batch(w, 'DZ-1').exists()).toBe(true)
    expect(w.get('[data-testid="all-batches-option"]').element.checked).toBe(true)
    await apply(w)
    expect(api.getReopenStatistics).toHaveBeenLastCalledWith({ replayType: 'DZ', batchNames: [], onlyMine: false })
    w.unmount()
  })

  it('clears batches within the selected type and preserves only-mine scope', async () => {
    const w = mount(Ledger, { props: { replayType: 'QUERY' } })
    await flushPromises()
    await batch(w, 'RPT-1').setValue(true)
    await w.get('[data-testid="only-mine-filter"]').setValue(true)
    await apply(w)
    expect(api.getReopenStatistics).toHaveBeenLastCalledWith({ replayType: 'QUERY', batchNames: ['RPT-1'], onlyMine: true })

    await w.get('[data-testid="all-reopen-batches"]').trigger('click')
    await flushPromises()
    expect(api.getReopenStatistics).toHaveBeenLastCalledWith({ replayType: 'QUERY', batchNames: [], onlyMine: true })
    expect(w.get('[data-testid="all-batches-option"]').element.checked).toBe(true)
    await batch(w, 'RPT-2').setValue(true)
    await w.get('[data-testid="all-batches-option"]').setValue(true)
    await apply(w)
    expect(api.getReopenStatistics).toHaveBeenLastCalledWith({ replayType: 'QUERY', batchNames: [], onlyMine: true })
    w.unmount()
  })

  it('keeps the all-batches choice checked when no batch restriction is selected', async () => {
    const w = mount(Ledger)
    await flushPromises()
    const allBatches = w.get('[data-testid="all-batches-option"]')
    expect(allBatches.element.checked).toBe(true)
    await allBatches.setValue(false)
    expect(allBatches.element.checked).toBe(true)
    await apply(w)
    expect(api.getReopenStatistics).toHaveBeenLastCalledWith({ replayType: 'ALL', batchNames: [], onlyMine: false })

    await batch(w, 'RPT-1').setValue(true)
    expect(allBatches.element.checked).toBe(false)
    await allBatches.setValue(true)
    expect(allBatches.element.checked).toBe(true)
    expect(batch(w, 'RPT-1').element.checked).toBe(false)
    await apply(w)
    expect(api.getReopenStatistics).toHaveBeenLastCalledWith({ replayType: 'ALL', batchNames: [], onlyMine: false })
    w.unmount()
  })

  it('ignores late batch options from a previous transaction type', async () => {
    const late = deferred()
    api.getReopenFilters.mockReturnValueOnce(late.promise).mockResolvedValueOnce({ batchNames: ['DZ-2'], issueDomains: [] })
    const w = mount(Ledger)
    await flushPromises()
    await w.get('[data-testid="replay-type-filter"]').setValue('DZ')
    await flushPromises()
    late.resolve({ batchNames: ['RPT-old'], issueDomains: [] })
    await flushPromises()

    expect(batch(w, 'DZ-2').exists()).toBe(true)
    expect(w.find('input[data-batch="RPT-old"]').exists()).toBe(false)
    w.unmount()
  })

  it('ignores late statistics after another scope has been applied', async () => {
    const late = deferred()
    api.getReopenStatistics.mockReturnValueOnce(late.promise).mockResolvedValueOnce(statistics(2))
    const w = mount(Ledger)
    await flushPromises()
    await batch(w, 'RPT-2').setValue(true)
    await apply(w)
    late.resolve(statistics(99))
    await flushPromises()

    expect(w.get('[aria-label="重开人员统计"]').text()).toContain('2 次')
    expect(w.get('[aria-label="重开人员统计"]').text()).not.toContain('99 次')
    w.unmount()
  })

  it('removes stale totals when loading another scope fails and allows retry', async () => {
    const w = mount(Ledger)
    await flushPromises()
    expect(w.find('[aria-label="重开人员统计"]').exists()).toBe(true)
    api.getReopenStatistics.mockRejectedValueOnce(new Error('统计读取失败'))
    await batch(w, 'RPT-1').setValue(true)
    await apply(w)

    expect(w.get('[role="alert"]').text()).toContain('统计读取失败')
    expect(w.find('[aria-label="重开人员统计"]').exists()).toBe(false)
    await apply(w)
    expect(w.find('[aria-label="重开人员统计"]').exists()).toBe(true)
    w.unmount()
  })

  it('shows permission failures and disabled feature state without loading data', async () => {
    api.getReopenPermissions.mockRejectedValueOnce(new Error('权限读取失败'))
    const failed = mount(Ledger)
    await flushPromises()
    expect(failed.get('[role="alert"]').text()).toContain('权限读取失败')
    expect(api.getReopenStatistics).not.toHaveBeenCalled()
    failed.unmount()

    api.getReopenPermissions.mockResolvedValueOnce({ enabled: false })
    const disabled = mount(Ledger)
    await flushPromises()
    expect(disabled.text()).toContain('尚未启用')
    expect(api.getReopenFilters).not.toHaveBeenCalled()
    expect(api.getReopenStatistics).not.toHaveBeenCalled()
    disabled.unmount()
  })

  it('keeps batch lookup errors visible through statistics success and retries for the current type', async () => {
    api.getReopenFilters.mockRejectedValueOnce(new Error('批次读取失败'))
    const w = mount(Ledger)
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('批次读取失败')
    expect(w.find('[aria-label="重开人员统计"]').exists()).toBe(true)
    api.getReopenFilters.mockResolvedValueOnce({ batchNames: ['RPT-retry'], issueDomains: [] })
    await w.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(batch(w, 'RPT-retry').exists()).toBe(true)
    expect(w.find('[role="alert"]').exists()).toBe(false)
    w.unmount()
  })

  it('closes the batch picker with Escape or applying a selection', async () => {
    const w = mount(Ledger)
    await flushPromises()
    const picker = w.get('[data-testid="batch-filter"]')
    picker.element.open = true
    await picker.trigger('keydown', { key: 'Escape' })
    expect(picker.element.open).toBe(false)
    picker.element.open = true
    await batch(w, 'RPT-1').setValue(true)
    await apply(w)
    expect(picker.element.open).toBe(false)
    w.unmount()
  })

  it('ignores pending permission resolution after closing', async () => {
    const permission = deferred()
    api.getReopenPermissions.mockReturnValueOnce(permission.promise)
    const w = mount(Ledger)
    w.unmount()
    permission.resolve({ enabled: true })
    await flushPromises()
    expect(api.getReopenStatistics).not.toHaveBeenCalled()
    expect(api.getReopenFilters).not.toHaveBeenCalled()
  })

  it('does not treat permission management as permission to transfer counts', async () => {
    const w = mount(Ledger)
    await flushPromises()
    expect(w.find('[data-testid="transfer-count-unassigned"]').exists()).toBe(false)
    w.unmount()
  })

  it('transfers from the applied range and refreshes the results and count-transfer capability', async () => {
    api.getReopenPermissions.mockResolvedValueOnce({ enabled: true, canTransferCounts: true }).mockResolvedValueOnce({ enabled: true, canTransferCounts: false })
    api.getReopenStatistics.mockResolvedValue({ totalEvents: 5, distinctIssues: 3, people: [{ username: 'alice', realName: '开发甲', currentCount: 5, pendingCount: 1, issueCount: 3 }], batches: [] })
    api.searchReopenDevelopers.mockResolvedValue([{ username: 'bob', realName: '开发乙' }])
    api.transferReopenCounts.mockResolvedValue({ requestId: 'uuid', count: 2, sourceOwnerUsername: 'alice', targetOwnerUsername: 'bob', occurredAt: '2026-11-09T18:00:00' })
    const w = mount(Ledger, { props: { replayType: 'QUERY' } })
    await flushPromises()
    await batch(w, 'RPT-1').setValue(true)
    await apply(w)
    await w.get('[data-testid="transfer-count-alice"]').trigger('click')
    await flushPromises()
    await batch(w, 'RPT-2').setValue(true)
    expect(w.get('[aria-label="转移问题次数"]').text()).toContain('RPT-1')
    expect(w.get('[aria-label="转移问题次数"]').text()).not.toContain('RPT-2')
    await w.get('[data-testid="count-transfer-target"] select').setValue('bob')
    await w.get('[data-testid="count-transfer-amount"]').setValue('2')
    await w.get('[data-testid="count-transfer-reason"]').setValue('核实归属')
    await w.get('[data-testid="count-transfer-form"]').trigger('submit')
    await flushPromises()

    expect(api.transferReopenCounts).toHaveBeenCalledWith(expect.objectContaining({ replayType: 'QUERY', batchNames: ['RPT-1'], sourceOwnerUsername: 'alice', targetOwnerUsername: 'bob', count: 2, reason: '核实归属' }))
    expect(api.getReopenStatistics).toHaveBeenCalledTimes(3)
    expect(api.getReopenPermissions).toHaveBeenCalledTimes(2)
    expect(w.text()).toContain('已转移 2 次')
    expect(w.find('[aria-label="转移问题次数"]').exists()).toBe(false)
    expect(w.find('[data-testid="transfer-count-alice"]').exists()).toBe(false)
    w.unmount()
  })

  it('closes the transfer draft when applying a different scope or changing transaction type', async () => {
    api.getReopenPermissions.mockResolvedValue({ enabled: true, canTransferCounts: true })
    const w = mount(Ledger)
    await flushPromises()
    await w.get('[data-testid="transfer-count-unassigned"]').trigger('click')
    await flushPromises()
    expect(w.find('[aria-label="转移问题次数"]').exists()).toBe(true)
    await batch(w, 'RPT-1').setValue(true)
    await apply(w)
    expect(w.find('[aria-label="转移问题次数"]').exists()).toBe(false)
    await w.get('[data-testid="transfer-count-unassigned"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="replay-type-filter"]').setValue('DZ')
    await flushPromises()
    expect(w.find('[aria-label="转移问题次数"]').exists()).toBe(false)
    expect(api.transferReopenCounts).not.toHaveBeenCalled()
    w.unmount()
  })

  it('keeps a pending transfer fixed while blocking another transfer or scope change', async () => {
    api.getReopenPermissions.mockResolvedValue({ enabled: true, canTransferCounts: true })
    api.searchReopenDevelopers.mockResolvedValue([{ username: 'bob', realName: '开发乙' }])
    const pending = deferred()
    api.transferReopenCounts.mockReturnValueOnce(pending.promise)
    const w = mount(Ledger)
    await flushPromises()
    await w.get('[data-testid="transfer-count-unassigned"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="count-transfer-target"] select').setValue('bob')
    await w.get('[data-testid="count-transfer-amount"]').setValue('1')
    await w.get('[data-testid="count-transfer-reason"]').setValue('核实归属')
    await w.get('[data-testid="count-transfer-form"]').trigger('submit')

    expect(w.find('[data-testid="transfer-count-unassigned"]').exists()).toBe(false)
    expect(w.get('[data-testid="replay-type-filter"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="apply-reopen-filters"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="all-reopen-batches"]').attributes('disabled')).toBeDefined()
    expect(batch(w, 'RPT-1').attributes('disabled')).toBeDefined()
    const close = w.get('[aria-label="关闭重开台账"]')
    expect(close.attributes('disabled')).toBeDefined()
    await close.trigger('click')
    await w.get('[data-testid="apply-reopen-filters"]').trigger('submit')
    await w.get('[data-testid="all-reopen-batches"]').trigger('click')
    await w.get('[data-testid="replay-type-filter"]').setValue('DZ')
    w.findComponent({ name: 'ReplayReopenStatistics' }).vm.$emit('transfer', { username: 'alice', currentCount: 3, pendingCount: 0 })
    await flushPromises()
    expect(w.emitted('close')).toBeUndefined()
    expect(w.get('[aria-label="转移问题次数"]').text()).toContain('待归属')
    expect(w.get('[aria-label="转移问题次数"]').text()).toContain('全部交易类型')
    expect(api.getReopenStatistics).toHaveBeenCalledTimes(1)
    pending.resolve({ count: 1 })
    await flushPromises()
    expect(w.get('[data-testid="replay-type-filter"]').attributes('disabled')).toBeUndefined()
    expect(api.transferReopenCounts).toHaveBeenCalledTimes(1)
    expect(api.getReopenStatistics).toHaveBeenCalledTimes(2)
    expect(w.text()).toContain('已转移 1 次')
    w.unmount()
  })

  it('keeps successful transfer feedback and closes editing if the permission refresh fails', async () => {
    api.getReopenPermissions.mockResolvedValueOnce({ enabled: true, canTransferCounts: true }).mockRejectedValueOnce(new Error('权限读取失败'))
    api.searchReopenDevelopers.mockResolvedValue([{ username: 'bob', realName: '开发乙' }])
    api.transferReopenCounts.mockResolvedValue({ count: 1 })
    const w = mount(Ledger)
    await flushPromises()
    await w.get('[data-testid="transfer-count-unassigned"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="count-transfer-target"] select').setValue('bob')
    await w.get('[data-testid="count-transfer-amount"]').setValue('1')
    await w.get('[data-testid="count-transfer-reason"]').setValue('核实归属')
    await w.get('[data-testid="count-transfer-form"]').trigger('submit')
    await flushPromises()

    expect(w.text()).toContain('已转移 1 次')
    expect(w.get('[role="alert"]').text()).toContain('权限读取失败')
    expect(w.find('[data-testid="transfer-count-unassigned"]').exists()).toBe(false)
    expect(w.find('[aria-label="重开人员统计"]').exists()).toBe(true)
    w.unmount()
  })
})
