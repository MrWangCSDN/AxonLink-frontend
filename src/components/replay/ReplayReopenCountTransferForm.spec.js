import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TransferForm from './ReplayReopenCountTransferForm.vue'
import { searchReopenDevelopers, transferReopenCounts } from '../../api/replayReopens.js'

vi.mock('../../api/replayReopens.js', () => ({ searchReopenDevelopers: vi.fn(), transferReopenCounts: vi.fn() }))
vi.mock('../../api/replayIssues.js', () => ({ searchReplayIssueUsers: vi.fn() }))

const person = { username: 'alice', realName: '开发甲', currentCount: 5, pendingCount: 1 }
const scope = { replayType: 'QUERY', batchNames: ['RPT-1'], onlyMine: true }
let wrapper

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('c538a5a1-56a6-463d-858a-cbddc18866cc').mockReturnValue('d23579d2-4fcb-4823-a28e-b44220b2af45') })
  searchReopenDevelopers.mockResolvedValue([{ username: 'alice', realName: '开发甲' }, { username: 'bob', realName: '开发乙' }])
  transferReopenCounts.mockResolvedValue({ requestId: 'c538a5a1-56a6-463d-858a-cbddc18866cc', count: 2, sourceOwnerUsername: 'alice', targetOwnerUsername: 'bob', occurredAt: '2026-11-09T18:00:00' })
})
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })

async function filledForm(props = {}) {
  wrapper = mount(TransferForm, { props: { person, scope, canTransferCounts: true, ...props } })
  await flushPromises()
  await wrapper.get('[data-testid="count-transfer-target"] select').setValue('bob')
  await wrapper.get('[data-testid="count-transfer-amount"]').setValue('2')
  await wrapper.get('[data-testid="count-transfer-reason"]').setValue(' 核实归属 ')
  return wrapper
}

describe('reopen count transfer form', () => {
  it('submits only count, owner and the displayed applied scope', async () => {
    const w = await filledForm()
    expect(w.text()).toContain('开发甲')
    expect(w.text()).toContain('RPT-1')
    expect(w.get('[data-testid="count-transfer-amount"]').attributes('max')).toBe('4')
    await w.get('form').trigger('submit')
    await flushPromises()

    expect(transferReopenCounts).toHaveBeenCalledWith({ requestId: 'c538a5a1-56a6-463d-858a-cbddc18866cc', replayType: 'QUERY', batchNames: ['RPT-1'], sourceOwnerUsername: 'alice', targetOwnerUsername: 'bob', count: 2, reason: '核实归属' })
    expect(w.emitted('changed')[0][0]).toMatchObject({ count: 2, targetOwnerUsername: 'bob' })
  })

  it('rejects invalid quantities, same-owner transfers and missing reasons without sending', async () => {
    const w = await filledForm()
    for (const amount of ['0', '-1', '1.5', '5', '']) {
      await w.get('[data-testid="count-transfer-amount"]').setValue(amount)
      expect(w.get('[data-testid="submit-count-transfer"]').attributes('disabled')).toBeDefined()
      await w.get('form').trigger('submit')
    }
    await w.get('[data-testid="count-transfer-amount"]').setValue('2')
    await w.get('[data-testid="count-transfer-target"] select').setValue('alice')
    await w.get('form').trigger('submit')
    await w.get('[data-testid="count-transfer-target"] select').setValue('bob')
    await w.get('[data-testid="count-transfer-reason"]').setValue(' ')
    await w.get('form').trigger('submit')
    await w.get('[data-testid="count-transfer-reason"]').setValue('字'.repeat(1001))
    await w.get('form').trigger('submit')
    expect(transferReopenCounts).not.toHaveBeenCalled()
  })

  it('limits one operation to 10000 and sends null for the unassigned owner', async () => {
    const w = await filledForm({ person: { username: null, realName: null, currentCount: 20000, pendingCount: 0 } })
    expect(w.get('[data-testid="count-transfer-amount"]').attributes('max')).toBe('10000')
    await w.get('[data-testid="count-transfer-amount"]').setValue('10001')
    await w.get('form').trigger('submit')
    expect(transferReopenCounts).not.toHaveBeenCalled()
    await w.get('[data-testid="count-transfer-amount"]').setValue('10000')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(transferReopenCounts).toHaveBeenCalledWith(expect.objectContaining({ sourceOwnerUsername: null, count: 10000 }))
  })

  it('preserves retry identity and draft after failures, and changes the ID for changed content', async () => {
    const w = await filledForm()
    transferReopenCounts.mockRejectedValue(new Error('服务暂不可用'))
    await w.get('form').trigger('submit')
    await flushPromises()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(transferReopenCounts.mock.calls[1][0].requestId).toBe('c538a5a1-56a6-463d-858a-cbddc18866cc')
    expect(w.get('[data-testid="count-transfer-reason"]').element.value).toBe(' 核实归属 ')
    expect(w.get('[role="alert"]').text()).toContain('服务暂不可用')
    await w.get('[data-testid="count-transfer-amount"]').setValue('1')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(transferReopenCounts.mock.calls[2][0].requestId).toBe('d23579d2-4fcb-4823-a28e-b44220b2af45')
  })

  it('blocks duplicate submissions and ignores completion after closing', async () => {
    let resolve
    transferReopenCounts.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const w = await filledForm()
    await w.get('form').trigger('submit')
    await w.get('form').trigger('submit')
    expect(transferReopenCounts).toHaveBeenCalledTimes(1)
    expect(w.get('[data-testid="submit-count-transfer"]').attributes('disabled')).toBeDefined()
    w.unmount()
    resolve({ count: 2 })
    await flushPromises()
    expect(w.emitted('changed')).toBeUndefined()
  })

  it('closes permission to submit as soon as the capability is revoked', async () => {
    const w = await filledForm()
    await w.setProps({ canTransferCounts: false })
    await w.get('form').trigger('submit')
    expect(transferReopenCounts).not.toHaveBeenCalled()
    expect(w.get('[data-testid="submit-count-transfer"]').attributes('disabled')).toBeDefined()
  })

  it('uses the new scope and a new request ID after a scope change', async () => {
    const w = await filledForm()
    transferReopenCounts.mockRejectedValue(new Error('服务暂不可用'))
    await w.get('form').trigger('submit')
    await flushPromises()
    await w.setProps({ scope: { replayType: 'DZ', batchNames: ['DZ-2'] } })
    await w.get('[data-testid="count-transfer-target"] select').setValue('bob')
    await w.get('[data-testid="count-transfer-amount"]').setValue('1')
    await w.get('[data-testid="count-transfer-reason"]').setValue('新范围')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(transferReopenCounts.mock.calls[1][0]).toMatchObject({ requestId: 'd23579d2-4fcb-4823-a28e-b44220b2af45', replayType: 'DZ', batchNames: ['DZ-2'] })
  })

  it('preserves the draft and avoids sending when secure request IDs are unavailable', async () => {
    const w = await filledForm()
    vi.stubGlobal('crypto', undefined)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('无法生成安全的请求编号')
    expect(w.get('[data-testid="count-transfer-reason"]').element.value).toBe(' 核实归属 ')
    expect(transferReopenCounts).not.toHaveBeenCalled()
  })
})
