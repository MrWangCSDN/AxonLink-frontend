import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChainImpactSidebar from './ChainImpactSidebar.vue'

describe('ChainImpactSidebar', () => {
  it('starts with only the current page section expanded', () => {
    const wrapper = mount(ChainImpactSidebar, { props: {
      domains: [],
      activeDomainId: '',
      systemStats: { status: 'normal', statusText: '系统运行正常' },
      totalTransactions: 0,
      impactStats: {},
      currentPage: 'replay-issues',
      impactMode: 'table',
    } })

    const submenus = wrapper.findAll('.cis-block-sub')
    expect(submenus).toHaveLength(5)
    expect(submenus.map((submenu) => !submenu.attributes('style')?.includes('display: none'))).toEqual([
      false, false, false, true, false,
    ])
  })

  it('expands the section when the current page changes externally', async () => {
    const wrapper = mount(ChainImpactSidebar, { props: {
      domains: [],
      activeDomainId: '',
      systemStats: { status: 'normal', statusText: '系统运行正常' },
      totalTransactions: 0,
      impactStats: {},
      currentPage: 'replay-issues',
      impactMode: 'table',
    } })

    await wrapper.setProps({ currentPage: 'code-dashboard' })

    const submenus = wrapper.findAll('.cis-block-sub')
    expect(submenus.at(4).attributes('style')?.includes('display: none') ?? false).toBe(false)
  })

  it('emits replay page selection from a SQL-peer first-level menu', async () => {
    const wrapper = mount(ChainImpactSidebar, { props: {
      domains: [],
      activeDomainId: '',
      systemStats: { status: 'normal', statusText: '系统运行正常' },
      totalTransactions: 0,
      impactStats: {},
      currentPage: 'chain',
      impactMode: 'table',
    } })

    await wrapper.get('[data-testid="replay-section-toggle"]').trigger('click')
    await wrapper.get('[data-testid="replay-issues-menu"]').trigger('click')

    expect(wrapper.emitted('selectReplayPage')).toEqual([['replay-issues']])
  })

  it('places database comparison registration immediately after replay issues', async () => {
    const wrapper = mount(ChainImpactSidebar, { props: {
      domains: [],
      activeDomainId: '',
      systemStats: { status: 'normal', statusText: '系统运行正常' },
      totalTransactions: 0,
      impactStats: {},
      currentPage: 'replay-issues',
      impactMode: 'table',
    } })

    const replayItems = wrapper.findAll('[data-testid^="replay-"]')
      .filter((item) => item.attributes('data-testid') !== 'replay-section-toggle')
    expect(replayItems.map((item) => item.text())).toEqual([
      expect.stringContaining('全量交易人员清单'),
      expect.stringContaining('无条件忽略'),
      expect.stringContaining('有条件忽略'),
      expect.stringContaining('错误码忽略'),
      expect.stringContaining('排序字段'),
      expect.stringContaining('回放问题清单'),
      expect.stringContaining('回放数据库比对字段登记'),
    ])

    await wrapper.get('[data-testid="replay-database-comparison-fields-menu"]').trigger('click')
    expect(wrapper.emitted('selectReplayPage')?.at(-1)).toEqual(['replay-database-comparison-fields'])
  })
})
