import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DaoSlowSqlList from './DaoSlowSqlList.vue'
import { importSlowSql, listSlowSql, listSlowSqlDomains, listSlowSqlBizTypes, listSlowSqlRounds, getWhitelistApprovers } from '../../api/daoIndex.js'

vi.mock('../../api/daoIndex.js', async importOriginal => ({
  ...await importOriginal(),
  importSlowSql: vi.fn(),
  listSlowSql: vi.fn(),
  listSlowSqlDomains: vi.fn(),
  listSlowSqlBizTypes: vi.fn(),
  listSlowSqlRounds: vi.fn(),
  getWhitelistApprovers: vi.fn(),
}))
vi.mock('../../api/auth.js', () => ({ getCurrentUser: vi.fn().mockResolvedValue({ username: 'editor' }) }))

const importStats = {
  round: '20261101-20261107', rawRows: 7, aggregatedRows: 3,
  repeatHit: 1, skipped: 2, filtered: 1, overwritten: 4, reappearedHit: 1,
}

async function prepareImport(wrapper) {
  await flushPromises()
  await wrapper.findAll('.slow-tb-right button').find(button => button.text() === '导入 Excel/CSV').trigger('click')
  const fileInput = wrapper.get('.slow-modal input[type="file"]')
  Object.defineProperty(fileInput.element, 'files', { value: [new File(['fixture'], 'slow-sql.csv')], configurable: true })
  await fileInput.trigger('change')
  await wrapper.get('.slow-modal input[placeholder^="轮次"]').setValue('20261101-20261107')
}

describe('DaoSlowSqlList import feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    importSlowSql.mockReset().mockResolvedValue(importStats)
    listSlowSql.mockResolvedValue({ items: [], total: 0 })
    listSlowSqlDomains.mockResolvedValue([])
    listSlowSqlBizTypes.mockResolvedValue([])
    listSlowSqlRounds.mockResolvedValue([])
    getWhitelistApprovers.mockResolvedValue({ l1Approvers: [], l2Approvers: [] })
  })

  it.each([
    [true, '使用sssCount累计执行次数'],
    [false, '按每行1次累计执行次数'],
    [undefined, '按每行1次累计执行次数'],
  ])('explains the counting mode for preAggregated=%s while retaining import statistics', async (preAggregated, countingMode) => {
    importSlowSql.mockResolvedValue({ ...importStats, preAggregated })
    const wrapper = mount(DaoSlowSqlList)
    try {
      await prepareImport(wrapper)
      await wrapper.get('.slow-modal-foot button.primary').trigger('click')
      await flushPromises()
      const message = wrapper.get('.slow-modal').findAll('p.slow-hint').at(-1).text()
      expect(message).toContain(countingMode)
      expect(message).toContain('有效输入 7 行')
      expect(message).toContain('聚合 3 类')
      expect(message).toContain('1 条曾在历史轮次出现')
      expect(message).toContain('跳过 2')
      expect(message).toContain('采集过滤名单排除 1 行')
      expect(message).toContain('覆盖旧轮 4 条')
      expect(message).toContain('本批次 1 条优化未生效')
      expect(wrapper.get('.slow-modal-foot button.primary').text()).toBe('已导入')
      expect(wrapper.get('.slow-modal-foot button.primary').element.disabled).toBe(true)
    } finally { wrapper.unmount() }
  })
})
