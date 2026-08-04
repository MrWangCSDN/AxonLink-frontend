import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TransactionAnalysis from './TransactionAnalysis.vue'

vi.mock('../api/index.js', () => ({
  exportAllErrorCodes: vi.fn(),
  exportFlowtranImpactAll: vi.fn(),
  exportFlowtranImpactCurrent: vi.fn(),
  getBuildSyncStatus: vi.fn().mockResolvedValue({}),
  getFlowtranChain: vi.fn(),
  getFlowtranComponentCatalog: vi.fn().mockResolvedValue({ items: [] }),
  getFlowtranComponentImpact: vi.fn(),
  getFlowtranDomains: vi.fn().mockResolvedValue([]),
  getFlowtranImpactStats: vi.fn().mockResolvedValue({}),
  getFlowtranServiceCatalog: vi.fn().mockResolvedValue({ items: [] }),
  getFlowtranServiceImpact: vi.fn(),
  getFlowtranTableImpact: vi.fn(),
  getFlowtranTransactions: vi.fn(),
  getNeo4jTableCatalog: vi.fn().mockResolvedValue({ items: [] }),
  getSystemStats: vi.fn().mockResolvedValue({}),
}))

const stubs = {
  AppHeader: { template: '<header />' },
  ChainImpactSidebar: {
    emits: ['selectDomain', 'selectImpactMode', 'selectDiiPage', 'selectReplayPage', 'selectCodePage'],
    template: '<aside data-testid="mobile-drawer" />',
  },
  TransactionCard: { template: '<article />' },
  ImpactAnalysisPage: { template: '<section />' },
  DaoIndexPage: { template: '<section />' },
  ReplayIssuePage: {
    emits: ['toggleNavigation'],
    template: '<button data-testid="open-mobile-drawer" @click="$emit(\'toggleNavigation\')" />',
  },
  CodeDashboard: { template: '<section />' },
}

function mountPage() {
  return mount(TransactionAnalysis, { global: { stubs } })
}

afterEach(() => {
  vi.clearAllTimers()
  window.location.hash = ''
})

describe('TransactionAnalysis mobile navigation', () => {
  it.each([
    ['domain selection', 'selectDomain', [{ id: 'loan', name: '贷款领域' }]],
    ['SQL inspection selection', 'selectDiiPage', ['dii-dashboard']],
    ['code dashboard selection', 'selectCodePage', []],
    ['impact mode selection', 'selectImpactMode', ['table']],
  ])('closes an open replay drawer after %s', async (_label, event, args) => {
    window.location.hash = 'replay-issues'
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="open-mobile-drawer"]').trigger('click')
    expect(wrapper.get('[data-testid="mobile-drawer"]').classes()).toContain('is-mobile-open')
    expect(wrapper.find('.replay-mobile-backdrop').exists()).toBe(true)

    wrapper.getComponent('[data-testid="mobile-drawer"]').vm.$emit(event, ...args)
    await flushPromises()

    expect(wrapper.get('[data-testid="mobile-drawer"]').classes()).not.toContain('is-mobile-open')
    expect(wrapper.find('.replay-mobile-backdrop').exists()).toBe(false)
  })
})
