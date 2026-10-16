import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReplayDatabaseTablePersonPage from './ReplayDatabaseTablePersonPage.vue'
import * as api from '../../api/replayDatabaseTablePersons.js'

vi.mock('../../api/replayDatabaseTablePersons.js', () => ({
  listReplayDatabaseTablePersons: vi.fn(),
  importReplayDatabaseTablePersons: vi.fn(),
  exportReplayDatabaseTablePersons: vi.fn(),
}))

describe('ReplayDatabaseTablePersonPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listReplayDatabaseTablePersons.mockResolvedValue({ total: 1, items: [{
      id: 1, domain: '贷款组', tableName: 'koba_a', tableComment: '账户表',
      developer: '张三(dev1)', technologyOwner: '王五(owner1)',
    }] })
  })

  it('shows five columns and searches the shared personnel list', async () => {
    const wrapper = mount(ReplayDatabaseTablePersonPage)
    await flushPromises()
    expect(wrapper.findAll('th').map(item => item.text())).toEqual([
      '领域', '表英文名称', '表中文名称', '开发负责人', '科技负责人',
    ])
    expect(wrapper.text()).toContain('王五(owner1)')
    await wrapper.find('[data-testid="database-table-person-keyword"]').setValue('koba')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(api.listReplayDatabaseTablePersons).toHaveBeenLastCalledWith({ keyword: 'koba', limit: 50, offset: 0 })
  })
})
