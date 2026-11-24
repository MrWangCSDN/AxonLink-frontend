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
  await wrapper.get('[data-testid="custom-sql-text"]').setValue(sql)
  await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
  await flushPromises()
}

describe('custom SQL registration editor', () => {
  beforeEach(() => { analyze.mockReset(); analyze.mockResolvedValue(analysis) })

  it('analyzes SQL, shows read-only source metadata and saves ordered fields with selected result keys', async () => {
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    expect(wrapper.find('[data-testid="custom-sql-name"]').exists()).toBe(false)
    await parse(wrapper)
    expect(wrapper.get('[data-testid="custom-sql-table-name"]').text()).toBe('acct')
    expect(wrapper.get('[data-testid="custom-sql-table-comment"]').text()).toBe('账户表')
    expect(wrapper.text()).toContain('存款组')
    expect(wrapper.text()).toContain('张三')
    expect(wrapper.text()).toContain('DECIMAL')
    expect(wrapper.get('[data-testid="sql-select-currency"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="sql-move-up-total_amt"]').trigger('click')
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    expect(wrapper.emitted('save')[0][0]).toEqual({ sourceTableName: 'acct', sql, fieldNames: ['total_amt', 'currency'], resultKeyColumns: ['currency'], compareLimit: null, maxPartitionNum: 64 })
  })

  it('invalidates parsed fields when SQL changes and ignores stale analysis responses', async () => {
    let finishAnalysis
    analyze.mockImplementationOnce(() => new Promise(resolve => { finishAnalysis = resolve }))
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
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

  it('retains invalid SQL on analysis failure and obtains table metadata after retry', async () => {
    analyze.mockRejectedValueOnce(new Error('不支持 LIMIT，请使用比对条数'))
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    await parse(wrapper)
    expect(wrapper.get('[data-testid="custom-sql-error"]').text()).toContain('不支持 LIMIT')
    expect(wrapper.get('[data-testid="custom-sql-text"]').element.value).toBe(sql)
    await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="custom-sql-table-comment"]').text()).toBe('账户表')
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
    expect(wrapper.get('[data-testid="custom-sql-error"]').text()).toContain('登记表')
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
  })

  it('allows tables without a database comment and keeps the comment read-only', async () => {
    analyze.mockResolvedValue({ ...analysis, sourceTableComment: '' })
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    await parse(wrapper)
    expect(wrapper.get('[data-testid="custom-sql-table-comment"]').text()).toBe('-')
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(false)
  })

  it('clears the old registration comment when analysis returns a null database comment', async () => {
    analyze.mockResolvedValue({ ...analysis, sourceTableComment: null })
    const initial = { id: 18, version: 6, tableName: 'acct', tableComment: '旧账户表',
      fields: [{ columnName: 'currency' }], comparisonKey: { indexType: 'PRIMARY_KEY', columnNames: ['currency'] } }
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze, initialRegistration: initial } })
    expect(wrapper.get('[data-testid="custom-sql-table-comment"]').text()).toBe('旧账户表')
    await parse(wrapper)
    expect(wrapper.get('[data-testid="custom-sql-table-comment"]').text()).toBe('-')
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(false)
  })

  it('locks an existing ordinary registration to its table when configuring custom SQL', async () => {
    const initial = { id: 18, version: 6, tableName: 'acct', tableComment: '账户表',
      fields: [{ columnName: 'currency' }], comparisonKey: { indexType: 'PRIMARY_KEY', columnNames: ['currency'] } }
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze, initialRegistration: initial } })
    expect(wrapper.get('[data-testid="custom-sql-table-name"]').text()).toBe('acct')
    await parse(wrapper)
    await wrapper.get('[data-testid="sql-select-total_amt"]').setValue(true)
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    expect(wrapper.emitted('save')[0][0]).toEqual({ id: 18, version: 6, sourceTableName: 'acct', sql,
      fieldNames: ['currency', 'total_amt'], resultKeyColumns: ['currency'], compareLimit: null, maxPartitionNum: 64 })
    analyze.mockResolvedValue({ ...analysis, sourceTableName: 'another_table' })
    await wrapper.get('[data-testid="custom-sql-text"]').setValue('select currency from another_table')
    await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="custom-sql-error"]').text()).toContain('acct')
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
    expect(wrapper.get('[data-testid="custom-sql-max-partition"]').element.disabled).toBe(true)
  })

  it.each([false, true])('allows maximum partitions without elevated sample permission (%s)', async allowed => {
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze, canConfigurePartitions: allowed } })
    await parse(wrapper)
    const input = wrapper.get('[data-testid="custom-sql-max-partition"]')
    expect(input.element.value).toBe('64')
    expect(input.element.disabled).toBe(false)
    for (const value of ['100', '1', '256']) {
      await input.setValue(value)
      await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
      expect(wrapper.emitted('save').at(-1)[0].maxPartitionNum).toBe(Number(value))
    }
    if (!allowed) expect(wrapper.emitted('save')[0][0]).not.toHaveProperty('partitionNum')
    for (const value of ['', '0', '257', '1.5']) {
      await input.setValue(value)
      expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
      expect(wrapper.get('.validation-message').text()).toContain('最大hash分区数')
    }
  })

  it.each([100, undefined, null])('restores maximum partitions while editing (%s)', value => {
    const wrapper = mount(CustomSqlEditor, { props: { initialRegistration: { maxPartitionNum: value } } })
    expect(wrapper.get('[data-testid="custom-sql-max-partition"]').element.value).toBe(value === 100 ? '100' : '64')
  })
})
