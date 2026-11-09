import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RequestForm from './ReplayReopenRequestForm.vue'
import { createReopenAppeal, searchReopenDevelopers } from '../../api/replayReopens.js'
vi.mock('../../api/replayReopens.js', () => ({ createReopenAppeal: vi.fn(), searchReopenDevelopers: vi.fn() }))
vi.mock('../../api/replayIssues.js', () => ({ searchReplayIssueUsers: vi.fn() }))
let wrapper
beforeEach(() => {
  vi.resetAllMocks()
  searchReopenDevelopers.mockResolvedValue([{ username: 'liu', realName: '刘洋' }])
})
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })
async function filledForm() {
  wrapper = mount(RequestForm, { props: { selection: [{ event: { id: 7, version: 4, issueDomain: '结算组', currentOwnerUsername: 'zhang' }, canAppeal: true }] } })
  await flushPromises()
  await wrapper.get('[data-testid="suggested-owner"] select').setValue('liu')
  await wrapper.get('[data-testid="request-reason"]').setValue('公共组件遗漏')
  await wrapper.get('[data-testid="request-evidence"]').setValue('日志 1022')
  return wrapper
}
describe('adjustment request IDs', () => {
  it('uses secure UUID v4 fallback when randomUUID is unavailable and preserves retry identity', async () => {
    vi.stubGlobal('crypto', { getRandomValues: bytes => bytes.fill(0x11) })
    const w = await filledForm()
    createReopenAppeal.mockRejectedValueOnce(new Error('请求超时'))
    await w.get('form').trigger('submit'); await flushPromises()
    expect(createReopenAppeal).toHaveBeenCalledWith(expect.objectContaining({ requestId: '11111111-1111-4111-9111-111111111111' }))
    expect(w.get('[data-testid="request-evidence"]').element.value).toBe('日志 1022')
    createReopenAppeal.mockResolvedValueOnce({ id: 3 })
    await w.get('form').trigger('submit'); await flushPromises()
    expect(createReopenAppeal.mock.calls[1][0].requestId).toBe(createReopenAppeal.mock.calls[0][0].requestId)
    expect(w.emitted('changed')).toHaveLength(1)
  })
  it('reports unavailable secure randomness while keeping the complete draft', async () => {
    vi.stubGlobal('crypto', undefined)
    const w = await filledForm()
    await w.get('form').trigger('submit'); await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('无法生成安全的请求编号')
    expect(createReopenAppeal).not.toHaveBeenCalled()
    expect(w.get('[data-testid="suggested-owner"] select').element.value).toBe('liu')
    expect(w.get('[data-testid="request-reason"]').element.value).toBe('公共组件遗漏')
    expect(w.get('[data-testid="request-evidence"]').element.value).toBe('日志 1022')
    expect(w.get('[data-testid="submit-adjustment"]').attributes('disabled')).toBeUndefined()
  })
})
