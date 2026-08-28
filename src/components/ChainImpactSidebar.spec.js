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
})
