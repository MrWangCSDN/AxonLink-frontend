import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CustomSqlEditor from './ReplayDatabaseComparisonCustomSqlEditor.vue'

enableAutoUnmount(afterEach)
const sql = 'select currency, sum(amount) as total_amt from acct group by currency'
const columns = [
  { columnName: 'currency', columnLabel: 'currency', dataType: 'VARCHAR', ordinalPosition: 1 },
  { columnName: 'total_amt', columnLabel: 'TOTAL_AMT', dataType: 'DECIMAL', ordinalPosition: 2 },
]
const analysis = { sql, sourceTableName: 'acct', sourceTableComment: '账户表', resultColumns: columns, candidateKeyColumns: ['currency'], domainName: '存款组', reviserName: '张三', groupOwnerName: '李经理' }
const analyze = vi.fn()
const parse = async wrapper => {
  await wrapper.get('[data-testid="custom-sql-name"]').setValue('币种金额汇总')
  await wrapper.get('[data-testid="custom-sql-text"]').setValue(sql)
  await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
  await flushPromises()
}

describe('custom SQL registration editor', () => {
  beforeEach(() => { analyze.mockReset(); analyze.mockResolvedValue(analysis) })

  it('analyzes SQL, shows read-only source metadata and saves ordered fields with selected result keys', async () => {
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    await parse(wrapper)
    expect(wrapper.text()).toContain('acct')
    expect(wrapper.text()).toContain('存款组')
    expect(wrapper.text()).toContain('张三')
    expect(wrapper.text()).toContain('DECIMAL')
    expect(wrapper.get('[data-testid="sql-select-currency"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="sql-move-up-total_amt"]').trigger('click')
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    expect(wrapper.emitted('save')[0][0]).toEqual({ displayName: '币种金额汇总', sourceTableName: 'acct', sql, fieldNames: ['total_amt', 'currency'], resultKeyColumns: ['currency'], compareLimit: null })
  })

  it('invalidates parsed fields when SQL changes and ignores stale analysis responses', async () => {
    let finishAnalysis
    analyze.mockImplementationOnce(() => new Promise(resolve => { finishAnalysis = resolve }))
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    await wrapper.get('[data-testid="custom-sql-name"]').setValue('汇总')
    await wrapper.get('[data-testid="custom-sql-text"]').setValue(sql)
    await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
    await wrapper.get('[data-testid="custom-sql-text"]').setValue('select id from acct')
    finishAnalysis(analysis)
    await flushPromises()
    expect(wrapper.find('[data-testid="sql-select-currency"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="custom-sql-text"]').setValue(sql)
    await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="custom-sql-text"]').setValue(`${sql} having sum(amount) > 0`)
    expect(wrapper.find('[data-testid="sql-select-currency"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
  })

  it('retains invalid SQL on analysis failure and retries without losing the name', async () => {
    analyze.mockRejectedValueOnce(new Error('不支持 LIMIT，请使用比对条数'))
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    await parse(wrapper)
    expect(wrapper.get('[data-testid="custom-sql-error"]').text()).toContain('不支持 LIMIT')
    expect(wrapper.get('[data-testid="custom-sql-text"]').element.value).toBe(sql)
    expect(wrapper.get('[data-testid="custom-sql-name"]').element.value).toBe('币种金额汇总')
    await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(false)
  })

  it('locks the saved source and keeps the optimistic version when editing', async () => {
    const initial = { id: 11, version: 4, tableName: 'sql_one', tableComment: '汇总', customSql: { sql, sourceTableName: 'acct', resultColumns: columns },
      fields: [{ columnName: 'currency' }, { columnName: 'total_amt' }], comparisonKey: { indexType: 'RESULT_KEY', columnNames: ['currency'] } }
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze, initialRegistration: initial } })
    await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    expect(wrapper.emitted('save')[0][0]).toMatchObject({ id: 11, version: 4, sourceTableName: 'acct' })
    analyze.mockResolvedValueOnce({ ...analysis, sourceTableName: 'other_table' })
    await wrapper.get('[data-testid="custom-sql-text"]').setValue('select currency from other_table')
    await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="custom-sql-error"]').text()).toContain('关联基础表')
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
  })

  it('requires a selected key and validates compare limits and permission-controlled settings', async () => {
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze, canConfigurePartitions: true } })
    await parse(wrapper)
    await wrapper.get('[data-testid="sql-key-currency"]').setValue(false)
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="sql-key-currency"]').setValue(true)
    await wrapper.get('[data-testid="custom-sql-limit"]').setValue('0')
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="custom-sql-limit"]').setValue('25')
    await wrapper.get('[data-testid="custom-sql-sample"]').setValue('0')
    await wrapper.get('[data-testid="custom-sql-partition"]').setValue('2')
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    expect(wrapper.emitted('save')[0][0]).toMatchObject({ compareLimit: 25, sampleLimit: 0, partitionNum: 2 })
  })

  it('blocks edits and duplicate saves while persistence is pending', async () => {
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    await parse(wrapper)
    await wrapper.setProps({ saving: true })
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    expect(wrapper.get('[data-testid="custom-sql-text"]').element.disabled).toBe(true)
    expect(wrapper.get('[data-testid="close-custom-sql"]').element.disabled).toBe(true)
  })
})
