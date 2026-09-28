import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ReplayDatabaseComparisonAuditDialog from './ReplayDatabaseComparisonAuditDialog.vue'

const events = [
  {
    id: 101,
    tableName: 'kdpa_cb_acct_fzn_cntl_inf',
    operation: 'CREATE',
    operatorEmpNo: '001',
    operatorUsername: 'c-liming',
    operatorName: '李明',
    operatedAt: '2026-09-11 09:18:01',
    changeCount: 1,
    details: [{ id: 1, changeType: 'ADD', fieldLabel: '领域', beforeValue: '', afterValue: '存款组' }],
  },
  {
    id: 103,
    tableName: 'kdpa_cb_acct_fzn_cntl_inf',
    operation: 'DELETE',
    operatorEmpNo: '002',
    operatorUsername: 'c-zhouhao',
    operatorName: '周皓',
    operatedAt: '2026-09-12 14:36:08',
    changeCount: 2,
    details: [
      { id: 1, changeType: 'MODIFY', fieldLabel: '领域', beforeValue: '存款组', afterValue: '公共组' },
      { id: 2, changeType: 'DELETE', fieldLabel: '比对字段 acct_no', beforeValue: 'acct_no(账号)', afterValue: '' },
    ],
  },
]

const groups = [{
  schemaName: 'CCBS_BASE',
  tableName: 'kdpa_cb_acct_fzn_cntl_inf',
  tableComment: '账户冻结控制信息表',
  matchedEventCount: 2,
  latestOperatorEmpNo: '002',
  latestOperatorUsername: 'c-zhouhao',
  latestOperatorName: '周皓',
  latestOperatedAt: '2026-09-12 14:36:08',
  events: [events[1], events[0]],
}]

describe('ReplayDatabaseComparisonAuditDialog', () => {
  it('searches globally and renders newest audit events first', async () => {
    const wrapper = mount(ReplayDatabaseComparisonAuditDialog, {
      props: { groups, page: 0, size: 20, total: 1, totalPages: 1, loading: false },
    })

    expect(wrapper.text()).toContain('全局审计日志查询')
    await wrapper.get('[data-testid="audit-table-filter"]').setValue('kdpa')
    await wrapper.get('[data-testid="audit-operator-filter"]').setValue('周皓')
    await wrapper.get('[data-testid="audit-search"]').trigger('click')

    expect(wrapper.emitted('search')?.[0]?.[0]).toMatchObject({ tableKeyword: 'kdpa', operatorKeyword: '周皓' })
    expect(wrapper.text()).toContain('kdpa_cb_acct_fzn_cntl_inf / 账户冻结控制信息表')
    expect(wrapper.text()).toContain('2 次操作')
    expect(wrapper.text()).toContain('最近操作人：周皓(c-zhouhao)')
    expect(wrapper.find('[data-testid="audit-event"]').exists()).toBe(false)
    await wrapper.get('[data-testid="toggle-audit-group-kdpa_cb_acct_fzn_cntl_inf"]').trigger('click')
    const renderedEvents = wrapper.findAll('[data-testid="audit-event"]')
    expect(renderedEvents[0].attributes('data-event-id')).toBe('103')
    expect(renderedEvents[0].text()).toContain('周皓(c-zhouhao)')
    expect(renderedEvents[0].text()).toContain('2026-09-12 14:36:08')
    expect(renderedEvents[0].classes()).toContain('is-delete')
  })

  it('emits table page and page-size changes', async () => {
    const wrapper = mount(ReplayDatabaseComparisonAuditDialog, {
      props: { groups, page: 0, size: 20, total: 40, totalPages: 2, loading: false },
    })

    await wrapper.get('[data-testid="audit-next-page"]').trigger('click')
    expect(wrapper.emitted('pageChange')?.[0]?.[0]).toBe(1)
    await wrapper.get('[data-testid="audit-page-size"]').setValue('50')
    expect(wrapper.emitted('pageSizeChange')?.[0]?.[0]).toBe(50)
  })

  it('shows errors instead of stale grouped results', () => {
    const wrapper = mount(ReplayDatabaseComparisonAuditDialog, {
      props: { groups, error: '审计日志加载失败，请重试', loading: false },
    })

    expect(wrapper.text()).toContain('审计日志加载失败，请重试')
    expect(wrapper.find('[data-testid="audit-group"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="audit-retry"]').exists()).toBe(true)
  })

  it('expands exact field changes and copies all details', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const wrapper = mount(ReplayDatabaseComparisonAuditDialog, {
      props: { tableName: 'kdpa_cb_acct_fzn_cntl_inf', events, loading: false },
    })

    expect(wrapper.find('.audit-dialog > header p').exists()).toBe(false)
    expect(wrapper.get('[data-testid="toggle-audit-event-103"]').find('strong').exists()).toBe(false)
    expect(wrapper.find('[data-testid="audit-detail-103-1"]').exists()).toBe(false)
    await wrapper.get('[data-testid="toggle-audit-event-103"]').trigger('click')

    const scopeAttribute = Object.keys(wrapper.get('.audit-dialog').attributes()).find(name => name.startsWith('data-v-'))
    expect(scopeAttribute).toBeTruthy()
    expect(wrapper.get('.audit-detail-header').attributes()).toHaveProperty(scopeAttribute)
    expect(wrapper.get('.audit-detail-header').text()).toContain('操作人')
    expect(wrapper.get('.audit-detail-header').text()).not.toContain('谁')
    expect(wrapper.get('[data-testid="audit-detail-103-1"]').findAll('span').map(cell => cell.text()))
      .toEqual(['周皓(c-zhouhao)', '修改', '领域', '存款组', '公共组', '2026-09-12 14:36:08'])
    await wrapper.get('[data-testid="copy-audit-event-103"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('周皓(c-zhouhao)｜修改｜领域｜存款组｜公共组｜2026-09-12 14:36:08'))
  })

  it('falls back to the stored employee number for historical audit rows', async () => {
    const historicalEvent = { ...events[0], operatorUsername: null }
    const wrapper = mount(ReplayDatabaseComparisonAuditDialog, {
      props: { tableName: historicalEvent.tableName, events: [historicalEvent], loading: false },
    })

    expect(wrapper.get('[data-testid="toggle-audit-event-101"]').text()).toContain('李明(001)')
  })

  it.each(['table', 'global'])('omits retired partition changes from %s audit display and copied details', async scope => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const historicalEvent = {
      ...events[0],
      changeCount: 3,
      details: [
        { id: 1, changeType: 'MODIFY', fieldCode: 'partitionNum', fieldLabel: '分区数', beforeValue: '1', afterValue: '8' },
        { id: 2, changeType: 'MODIFY', fieldLabel: '读取分区数', beforeValue: '8', afterValue: '16' },
        { id: 3, changeType: 'MODIFY', fieldCode: 'sampleLimit', fieldLabel: '样本数', beforeValue: '1000', afterValue: '100' },
      ],
    }
    const wrapper = mount(ReplayDatabaseComparisonAuditDialog, {
      props: scope === 'table'
        ? { tableName: historicalEvent.tableName, events: [historicalEvent] }
        : { groups: [{ ...groups[0], events: [historicalEvent] }] },
    })
    if (scope === 'global') await wrapper.get(`[data-testid="toggle-audit-group-${historicalEvent.tableName}"]`).trigger('click')
    await wrapper.get('[data-testid="toggle-audit-event-101"]').trigger('click')

    expect(wrapper.text()).not.toContain('分区数')
    expect(wrapper.text()).toContain('本次变更 1 项')
    expect(wrapper.findAll('.audit-detail-row')).toHaveLength(1)
    await wrapper.get('[data-testid="copy-audit-event-101"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith('李明(c-liming)｜修改｜样本数｜1000｜100｜2026-09-11 09:18:01')
    expect(historicalEvent.details).toHaveLength(3)
  })

  it('finishes loading an audit event containing only retired partition changes', async () => {
    const historicalEvent = { ...events[0], details: undefined }
    const wrapper = mount(ReplayDatabaseComparisonAuditDialog, {
      props: { tableName: historicalEvent.tableName, events: [historicalEvent] },
    })
    expect(wrapper.text()).toContain('查看变更明细')
    await wrapper.get('[data-testid="toggle-audit-event-101"]').trigger('click')
    expect(wrapper.emitted('loadDetails')).toHaveLength(1)
    expect(wrapper.text()).toContain('正在读取本次变更明细')
    await wrapper.setProps({ events: [{ ...historicalEvent, details: [
      { id: 1, fieldCode: 'partitionNum', fieldLabel: '分区数', beforeValue: '1', afterValue: '8' },
    ] }] })

    expect(wrapper.text()).toContain('本次变更 0 项')
    expect(wrapper.text()).toContain('本次操作无可展示的变更明细')
    expect(wrapper.text()).not.toContain('正在读取')
    expect(wrapper.text()).not.toContain('分区数')
    expect(wrapper.find('[data-testid="copy-audit-event-101"]').exists()).toBe(false)
  })

  it('preserves complete query-condition lines in before and after cells', async () => {
    const queryConditionEvent = {
      ...events[0],
      id: 105,
      details: [{
        id: 9,
        changeType: 'MODIFY',
        fieldLabel: '查询条件',
        beforeValue: '全表',
        afterValue: "where cst_id = '22'\norder by acct_no,cust_no\nlimit 1000",
      }],
    }
    const wrapper = mount(ReplayDatabaseComparisonAuditDialog, {
      props: { tableName: queryConditionEvent.tableName, events: [queryConditionEvent], loading: false },
    })

    await wrapper.get('[data-testid="toggle-audit-event-105"]').trigger('click')

    const cells = wrapper.get('[data-testid="audit-detail-105-9"]').findAll('span')
    expect(cells[3].classes()).toContain('audit-detail-value')
    expect(cells[4].classes()).toContain('audit-detail-value')
    expect(cells[4].text()).toBe("where cst_id = '22'\norder by acct_no,cust_no\nlimit 1000")
  })

  it('only closes through an explicit control', async () => {
    const wrapper = mount(ReplayDatabaseComparisonAuditDialog, { props: { events, loading: false } })

    await wrapper.get('[data-testid="audit-dialog-backdrop"]').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.get('[data-testid="close-audit-dialog"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
