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
  it('shows the personnel table without the batch-by-owner matrix', () => {
    const wrapper = mount(Statistics, { props: { data } })

    expect(wrapper.findAll('table')[0].findAll('th').map(cell => cell.text()))
      .toEqual(['负责人', '问题数'])
    expect(wrapper.findAll('table')[0].findAll('tbody td')).toHaveLength(2)
    expect(wrapper.findAll('table')[0].findAll('tbody td')[1].text()).toBe('5')
    expect(wrapper.findAll('table')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('RPT-1')
  })

  it('orders owners by numeric problem count, keeps ties stable, and does not mutate source data', () => {
    const people = Object.freeze([
      Object.freeze({ ...alice, currentCount: 2 }),
      Object.freeze({ ...alice, username: 'bob', realName: '开发乙', currentCount: '100' }),
      Object.freeze({ ...alice, username: 'carol', realName: '开发丙', currentCount: 9 }),
      Object.freeze({ ...alice, username: 'dave', realName: '开发丁', currentCount: 9 }),
      Object.freeze({ ...alice, username: null, realName: null, currentCount: 0 }),
    ])
    const wrapper = mount(Statistics, { props: { data: { ...data, people } } })

    const rows = wrapper.findAll('table')[0].findAll('tbody tr')
    expect(rows.map(row => row.findAll('td')[1].text())).toEqual(['100', '9', '9', '2', '0'])
    expect(rows.map(row => row.find('small').exists() ? row.get('small').text() : row.findAll('td')[0].text()))
      .toEqual(['bob', 'carol', 'dave', 'alice', '待归属'])
    expect(people.map(person => person.username)).toEqual(['alice', 'bob', 'carol', 'dave', null])
  })

  it('reorders refreshed counts and transfers the owner shown in the selected row', async () => {
    const bob = { ...alice, username: 'bob', realName: '开发乙', currentCount: 1 }
    const wrapper = mount(Statistics, { props: { data: { ...data, people: [alice, bob] }, canTransferCounts: true } })
    const refreshedBob = { ...bob, currentCount: 20 }

    await wrapper.setProps({ data: { ...data, people: [alice, refreshedBob] } })

    const firstRow = wrapper.findAll('table')[0].findAll('tbody tr')[0]
    expect(firstRow.get('small').text()).toBe('bob')
    await firstRow.get('button').trigger('click')
    expect(wrapper.emitted('transfer')).toEqual([[refreshedBob]])
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
