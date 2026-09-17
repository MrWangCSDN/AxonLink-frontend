import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ReplayConfigPage from './ReplayConfigPage.vue'
import {
  createReplayConfig,
  listReplayConfigOperations,
  listReplayConfigs,
  reviewReplayConfig,
} from '../../api/replayConfigs.js'

vi.mock('../../api/replayConfigs.js', () => ({
  listReplayConfigs: vi.fn(),
  createReplayConfig: vi.fn(),
  updateReplayConfig: vi.fn(),
  deleteReplayConfig: vi.fn(),
  batchDeleteReplayConfigs: vi.fn(),
  listReplayConfigOperations: vi.fn(),
  reviewReplayConfig: vi.fn(),
}))

function arrangeApi() {
  listReplayConfigs.mockResolvedValue({
    total: 2,
    items: [
      { id: 1, tranCode: 'S1&sop', fieldName: 'accountNo', version: 0 },
      { id: 2, tranCode: 'S2&soap', fieldName: 'status', version: 1 },
    ],
  })
  createReplayConfig.mockResolvedValue({ id: 3, version: 0 })
  listReplayConfigOperations.mockResolvedValue({
    total: 1,
    items: [
      {
        id: 9,
        operationType: 'CREATE',
        operatorUsername: 'zhangs3',
        operatorRealName: '张三',
        operationSource: 'MANUAL',
        createdAt: '2026-09-11T10:20:30',
        changes: [
          { field: 'tran_code', label: '服务码', oldValue: null, newValue: 'S1&sop' },
          { field: 'review_status', label: '审核状态', oldValue: '0', newValue: '1' },
        ],
      },
    ],
  })
}

describe('ReplayConfigPage（忽略清单）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    arrangeApi()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the first tab with default 10 per page', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenCalledWith('unconditional-ignores', { limit: 10, offset: 0 })
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('S1&sop')
    // 四个 tab 都在
    expect(wrapper.find('[data-testid="tab-unconditional-ignores"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-conditional-ignores"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-error-code-ignores"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-sort-fields"]').exists()).toBe(true)
  })

  it('switches tab and reloads with the new resource type', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="tab-conditional-ignores"]').trigger('click')
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenLastCalledWith('conditional-ignores', { limit: 10, offset: 0 })
    expect(wrapper.text()).toContain('字段索引')
  })

  it('creates a record and shows an auto-dismiss toast', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-tranCode"]').setValue('S3&bzjson')
    await wrapper.find('[data-testid="form-fieldName"]').setValue('accountNumber')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(createReplayConfig).toHaveBeenCalledWith('unconditional-ignores', {
      tranCode: 'S3&bzjson',
      fieldName: 'accountNumber',
    })
    expect(wrapper.find('[data-testid="toast"]').text()).toContain('新增成功')
  })

  it('rejects invalid service code before calling API', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-tranCode"]').setValue('bad-code')
    await wrapper.find('[data-testid="form-fieldName"]').setValue('accountNo')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(createReplayConfig).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="form-error"]').text()).toContain('格式不正确')
  })

  it('creates sort fields from the triple form and reports three rows', async () => {
    createReplayConfig.mockResolvedValue([{ id: 11 }, { id: 12 }, { id: 13 }])
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="tab-sort-fields"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-tranCode"]').setValue('6208')
    await wrapper.find('[data-testid="form-oldSortField"]').setValue('accounts.accountNo')
    await wrapper.find('[data-testid="form-newSortField"]').setValue('loans(loanNo,loanType)')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(createReplayConfig).toHaveBeenCalledWith('sort-fields', {
      tranCode: '6208',
      oldSortField: 'accounts.accountNo',
      newSortField: 'loans(loanNo,loanType)',
    })
    expect(wrapper.find('[data-testid="toast"]').text()).toContain('新增成功（3 条）')
  })

  it('rejects a malformed sort field before calling API', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="tab-sort-fields"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-tranCode"]').setValue('6208')
    await wrapper.find('[data-testid="form-oldSortField"]').setValue('accounts')
    await wrapper.find('[data-testid="form-newSortField"]').setValue('loans.loanNo')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(createReplayConfig).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="form-error"]').text()).toContain('格式不正确')
  })

  it('reviews a row when permission allows', async () => {
    listReplayConfigs.mockResolvedValue({
      total: 1,
      items: [{
        id: 1, tranCode: 'S1&sop', fieldName: 'accountNo', version: 0, reviewStatus: 0,
        oldTransactionCode: 'Y444', developer: '张三', bankOwner: '李四',
        canReview: true, reviewDisabledReason: null,
      }],
    })
    reviewReplayConfig.mockResolvedValue({ id: 1, reviewStatus: 1 })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    const button = wrapper.find('[data-testid="review-1"]')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    const modal = wrapper.find('[data-testid="confirm-modal"]')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('服务码')
    expect(modal.text()).toContain('S1&sop')
    expect(modal.text()).toContain('accountNo')
    expect(reviewReplayConfig).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="confirm-ok"]').trigger('click')
    await flushPromises()

    expect(reviewReplayConfig).toHaveBeenCalledWith('unconditional-ignores', 1, 0)
    expect(wrapper.find('[data-testid="toast"]').text()).toContain('审核通过')
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
  })

  it('cancels the review confirmation without calling API', async () => {
    listReplayConfigs.mockResolvedValue({
      total: 1,
      items: [{
        id: 1, tranCode: 'S1&sop', fieldName: 'accountNo', version: 0, reviewStatus: 0,
        canReview: true, reviewDisabledReason: null,
      }],
    })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="review-1"]').trigger('click')
    await wrapper.find('[data-testid="confirm-cancel"]').trigger('click')
    await flushPromises()

    expect(reviewReplayConfig).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
  })

  it('disables review button without permission', async () => {
    listReplayConfigs.mockResolvedValue({
      total: 1,
      items: [{
        id: 1, tranCode: 'S1&sop', fieldName: 'accountNo', version: 0, reviewStatus: 0,
        canReview: false, reviewDisabledReason: '没有权限，请联系李四进行审核',
      }],
    })
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    const button = wrapper.find('[data-testid="review-1"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('title')).toBe('没有权限，请联系李四进行审核')
  })

  it('sends the reviewStatus filter to the list API', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="filter-reviewStatus"]').setValue('1')
    await wrapper.find('form.replay-filters').trigger('submit')
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenLastCalledWith('unconditional-ignores', {
      limit: 10, offset: 0, reviewStatus: '1',
    })
  })

  it('opens history drawer and renders changes', async () => {
    const wrapper = mount(ReplayConfigPage)
    await flushPromises()

    await wrapper.find('[data-testid="history-1"]').trigger('click')
    await flushPromises()

    expect(listReplayConfigOperations).toHaveBeenCalledWith('unconditional-ignores', 1, { limit: 100, offset: 0 })
    const drawer = wrapper.find('[data-testid="history-drawer"]')
    expect(drawer.text()).toContain('张三')
    expect(drawer.text()).toContain('服务码')
    expect(drawer.text()).toContain('未审核')
    expect(drawer.text()).toContain('已审核')
  })
})
