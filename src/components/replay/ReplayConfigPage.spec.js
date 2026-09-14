import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ReplayConfigPage from './ReplayConfigPage.vue'
import {
  createReplayConfig,
  listReplayConfigOperations,
  listReplayConfigs,
} from '../../api/replayConfigs.js'

vi.mock('../../api/replayConfigs.js', () => ({
  listReplayConfigs: vi.fn(),
  createReplayConfig: vi.fn(),
  updateReplayConfig: vi.fn(),
  deleteReplayConfig: vi.fn(),
  batchDeleteReplayConfigs: vi.fn(),
  listReplayConfigOperations: vi.fn(),
}))

function arrangeApi() {
  listReplayConfigs.mockResolvedValue({
    total: 2,
    items: [
      { id: 1, tranCode: 'S1&sop', fieldName: 'accountNo', version: 0 },
      { id: 2, tranCode: 'S2&soap', fieldName: 'status', version: 1 },
    ],
  })
  createReplayConfig.mockResolvedValue({ id: 3 })
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
        changes: [{ field: 'tran_code', label: '服务码', oldValue: null, newValue: 'S1&sop' }],
      },
    ],
  })
}

describe('ReplayConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    arrangeApi()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads a page with default 30 size and renders rows', async () => {
    const wrapper = mount(ReplayConfigPage, { props: { type: 'unconditional-ignores' } })
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenCalledWith('unconditional-ignores', { limit: 30, offset: 0 })
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('S1&sop')
    expect(wrapper.text()).toContain('accountNo')
  })

  it('creates a new record from the modal', async () => {
    const wrapper = mount(ReplayConfigPage, { props: { type: 'unconditional-ignores' } })
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
    expect(wrapper.find('[data-testid="notice-message"]').text()).toContain('新增成功')
  })

  it('rejects invalid service code before calling API', async () => {
    const wrapper = mount(ReplayConfigPage, { props: { type: 'unconditional-ignores' } })
    await flushPromises()

    await wrapper.find('[data-testid="create-config"]').trigger('click')
    await wrapper.find('[data-testid="form-tranCode"]').setValue('bad-code')
    await wrapper.find('[data-testid="form-fieldName"]').setValue('accountNo')
    await wrapper.find('form.replay-edit-grid').trigger('submit')
    await flushPromises()

    expect(createReplayConfig).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="form-error"]').text()).toContain('格式不正确')
  })

  it('opens history drawer and renders changes', async () => {
    const wrapper = mount(ReplayConfigPage, { props: { type: 'unconditional-ignores' } })
    await flushPromises()

    await wrapper.find('[data-testid="history-1"]').trigger('click')
    await flushPromises()

    expect(listReplayConfigOperations).toHaveBeenCalledWith('unconditional-ignores', 1, { limit: 100, offset: 0 })
    const drawer = wrapper.find('[data-testid="history-drawer"]')
    expect(drawer.text()).toContain('张三')
    expect(drawer.text()).toContain('服务码')
  })

  it('renders conditional schema with backend-managed index column', async () => {
    listReplayConfigs.mockResolvedValue({
      total: 1,
      items: [{ id: 4, origTrcd: 'S1&sop', fieldRmoveName: 'accounts', fieldFileIndx: 1, fieldFileFlag: 2, version: 0 }],
    })
    const wrapper = mount(ReplayConfigPage, { props: { type: 'conditional-ignores' } })
    await flushPromises()

    expect(listReplayConfigs).toHaveBeenCalledWith('conditional-ignores', { limit: 30, offset: 0 })
    expect(wrapper.text()).toContain('字段索引')
    expect(wrapper.text()).toContain('对象或数组')
  })
})
