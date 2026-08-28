import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TransactionAnalysis from './TransactionAnalysis.vue'
import {
  exportFlowtranDomainChains,
  getFlowtranDomains,
  getFlowtranTransactions,
} from '../api/index.js'

vi.mock('../api/index.js', () => ({
  exportAllErrorCodes: vi.fn(),
  exportFlowtranDomainChains: vi.fn(),
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
  vi.clearAllMocks()
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

describe('TransactionAnalysis desktop navigation', () => {
  it('starts expanded, collapses the sidebar from the edge control and restores it again', async () => {
    window.location.hash = 'replay-issues'
    const wrapper = mountPage()
    await flushPromises()

    const toggle = wrapper.get('[data-testid="desktop-sidebar-toggle"]')
    expect(toggle.attributes('aria-label')).toBe('收起左侧导航')
    expect(wrapper.get('.page-body').classes()).not.toContain('is-sidebar-collapsed')
    expect(wrapper.get('[data-testid="mobile-drawer"]').classes()).not.toContain('is-desktop-collapsed')

    await toggle.trigger('click')

    expect(wrapper.get('.page-body').classes()).toContain('is-sidebar-collapsed')
    expect(wrapper.get('[data-testid="mobile-drawer"]').classes()).toContain('is-desktop-collapsed')
    expect(toggle.attributes('aria-label')).toBe('展开左侧导航')

    await toggle.trigger('click')

    expect(wrapper.get('.page-body').classes()).not.toContain('is-sidebar-collapsed')
    expect(wrapper.get('[data-testid="mobile-drawer"]').classes()).not.toContain('is-desktop-collapsed')
    expect(toggle.attributes('aria-label')).toBe('收起左侧导航')
  })
})

describe('TransactionAnalysis domain chain export', () => {
  it('opens a token dialog before exporting all chains for the active domain', async () => {
    getFlowtranDomains.mockResolvedValue([{ id: 'public', name: '公共领域', count: 330 }])
    getFlowtranTransactions.mockResolvedValue({ list: [], total: 330, page: 1, size: 10 })
    exportFlowtranDomainChains.mockResolvedValue({ fileName: '公共领域-全量交易链路.xlsx' })
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="export-domain-chains"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="chain-export-token-dialog"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="confirm-chain-export"]').attributes('disabled')).toBeDefined()
    expect(exportFlowtranDomainChains).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="chain-export-token"]').setValue('secret')
    await wrapper.get('[data-testid="confirm-chain-export"]').trigger('click')
    await flushPromises()

    expect(exportFlowtranDomainChains).toHaveBeenCalledWith('public', 'secret')
    expect(wrapper.find('[data-testid="chain-export-token-dialog"]').exists()).toBe(false)
  })

  it('cancels without requesting and clears the token', async () => {
    getFlowtranDomains.mockResolvedValue([{ id: 'public', name: '公共领域', count: 330 }])
    getFlowtranTransactions.mockResolvedValue({ list: [], total: 330, page: 1, size: 10 })
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="export-domain-chains"]').trigger('click')
    await wrapper.get('[data-testid="chain-export-token"]').setValue('secret')
    await wrapper.get('[data-testid="cancel-chain-export"]').trigger('click')

    expect(wrapper.find('[data-testid="chain-export-token-dialog"]').exists()).toBe(false)
    expect(exportFlowtranDomainChains).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="export-domain-chains"]').trigger('click')
    expect(wrapper.get('[data-testid="chain-export-token"]').element.value).toBe('')
  })

  it('disables export actions while the file is being generated', async () => {
    getFlowtranDomains.mockResolvedValue([{ id: 'deposit', name: '存款领域', count: 101 }])
    getFlowtranTransactions.mockResolvedValue({ list: [], total: 101, page: 1, size: 10 })
    let finishExport
    exportFlowtranDomainChains.mockImplementation(() => new Promise((resolve) => {
      finishExport = resolve
    }))
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="export-domain-chains"]').trigger('click')
    await wrapper.get('[data-testid="chain-export-token"]').setValue('secret')
    await wrapper.get('[data-testid="confirm-chain-export"]').trigger('click')

    expect(wrapper.get('[data-testid="export-domain-chains"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="export-domain-chains"]').text()).toContain('导出中')
    expect(wrapper.get('[data-testid="confirm-chain-export"]').attributes('disabled')).toBeDefined()
    finishExport({ fileName: '存款领域-全量交易链路.xlsx' })
    await flushPromises()
  })

  it('keeps the dialog open and clears the token when the token is rejected', async () => {
    getFlowtranDomains.mockResolvedValue([{ id: 'loan', name: '贷款领域', count: 20 }])
    getFlowtranTransactions.mockResolvedValue({ list: [], total: 20, page: 1, size: 10 })
    exportFlowtranDomainChains.mockRejectedValue(new Error('口令错误'))
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="export-domain-chains"]').trigger('click')
    await wrapper.get('[data-testid="chain-export-token"]').setValue('wrong')
    await wrapper.get('[data-testid="confirm-chain-export"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="chain-export-token-dialog"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="chain-export-token"]').element.value).toBe('')
    expect(wrapper.get('[data-testid="chain-export-dialog-error"]').text()).toContain('口令错误')
  })

  it('shows other backend errors in the export dialog', async () => {
    getFlowtranDomains.mockResolvedValue([{ id: 'loan', name: '贷款领域', count: 20 }])
    getFlowtranTransactions.mockResolvedValue({ list: [], total: 20, page: 1, size: 10 })
    exportFlowtranDomainChains.mockRejectedValue(new Error('Neo4j 不可用'))
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="export-domain-chains"]').trigger('click')
    await wrapper.get('[data-testid="chain-export-token"]').setValue('secret')
    await wrapper.get('[data-testid="confirm-chain-export"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="chain-export-dialog-error"]').text()).toContain('Neo4j 不可用')
  })
})
