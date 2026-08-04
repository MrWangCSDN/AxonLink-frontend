import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChainImpactSidebar from './ChainImpactSidebar.vue'

describe('ChainImpactSidebar', () => {
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
