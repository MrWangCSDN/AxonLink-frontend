import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Statistics from './ReplayReopenStatistics.vue'

const alice = {
  username: 'alice', realName: '开发甲', defaultCount: 5, adjustedIn: 0,
  adjustedOut: 0, currentCount: 5, pendingCount: 0, issueCount: 3,
}
const data = {
  totalEvents: 5, distinctIssues: 3, pendingEvents: 0,
  people: [alice],
  batches: [{ batchName: 'RPT-1', totalEvents: 5, people: [alice] }],
}

describe('reopen count statistics', () => {
  it('shows only the owner and problem-count columns in the personnel table', () => {
    const wrapper = mount(Statistics, { props: { data } })

    expect(wrapper.findAll('table')[0].findAll('th').map(cell => cell.text()))
      .toEqual(['负责人', '问题数'])
    expect(wrapper.findAll('table')[0].findAll('tbody td')).toHaveLength(2)
    expect(wrapper.findAll('table')[0].findAll('tbody td')[1].text()).toBe('5')
    expect(wrapper.text()).toContain('RPT-1')
  })

  it('keeps counts read-only without count-transfer permission', () => {
    const wrapper = mount(Statistics, { props: { data, canTransferCounts: false } })

    expect(wrapper.find('[data-testid="transfer-count-alice"]').exists()).toBe(false)
    expect(wrapper.emitted('transfer')).toBeUndefined()
  })

  it('opens a transfer for the selected owner when count-transfer permission is granted', async () => {
    const wrapper = mount(Statistics, { props: { data, canTransferCounts: true } })

    await wrapper.get('[data-testid="transfer-count-alice"]').trigger('click')

    expect(wrapper.get('[data-testid="transfer-count-alice"]').text()).toBe('5')
    expect(wrapper.emitted('transfer')).toEqual([[alice]])
  })

  it('keeps zero counts read-only and permits transferring unassigned counts', async () => {
    const unassigned = { ...alice, username: null, realName: null, currentCount: 2 }
    const wrapper = mount(Statistics, { props: { data: { ...data, people: [{ ...alice, currentCount: 0 }, unassigned] }, canTransferCounts: true } })

    expect(wrapper.find('[data-testid="transfer-count-alice"]').exists()).toBe(false)
    await wrapper.get('[data-testid="transfer-count-unassigned"]').trigger('click')
    expect(wrapper.emitted('transfer')).toEqual([[unassigned]])
  })
})
