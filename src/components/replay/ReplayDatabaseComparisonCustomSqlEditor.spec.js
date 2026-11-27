import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CustomSqlEditor from './ReplayDatabaseComparisonCustomSqlEditor.vue'

enableAutoUnmount(afterEach)
const sql = 'select currency, sum(amount) as total_amt from acct group by currency'
const columns = [
  { columnName: 'currency', columnLabel: 'currency', dataType: 'VARCHAR', ordinalPosition: 1 },
  { columnName: 'total_amt', columnLabel: 'TOTAL_AMT', dataType: 'DECIMAL', ordinalPosition: 2 },
]
const primary = { indexType: 'PRIMARY_KEY', indexName: 'acct_pk', columnNames: ['currency'] }
const alternate = { indexType: 'UNIQUE_INDEX', indexName: 'acct_uq', columnNames: ['total_amt', 'currency'] }
const analysis = { sql, sourceTableName: 'acct', sourceTableComment: '账户表', resultColumns: columns, candidateKeyColumns: ['currency'], keyOptions: [primary], domainName: '存款组', reviserName: '张三', groupOwnerName: '李经理' }
const analyze = vi.fn()
const parse = async wrapper => {
  await wrapper.get('[data-testid="custom-sql-text"]').setValue(sql)
  await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
  await flushPromises()
}

describe('custom SQL registration editor', () => {
  it('copies a SQL configuration into a new named registration without its original identity', async () => {
    const initial = { id: 11, version: 4, tableName: 'acct_1', sourceTableName: 'acct', configurationName: '汇总一',
      sampleLimit: -1, partitionNum: 8, maxPartitionNum: 128, compareLimit: 22,
      customSql: { sql, sourceTableName: 'acct', resultColumns: columns },
      fields: [{ columnName: 'currency' }, { columnName: 'total_amt' }], comparisonKey: { columnNames: ['currency'] } }
    const wrapper = mount(CustomSqlEditor, { props: { initialRegistration: initial,
      analyzeSql: analyze, createAdditionalConfiguration: true, canConfigurePartitions: true } })
    await parse(wrapper)
    expect(wrapper.get('[data-testid="custom-sql-name"]').attributes('maxlength')).toBe('200')
    await wrapper.get('[data-testid="custom-sql-name"]').setValue('汇总二')
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    const payload = wrapper.emitted('save').at(-1)[0]
    expect(payload).toMatchObject({ sourceTableName: 'acct', displayName: '汇总二', createAdditionalConfiguration: true, sql,
      fieldNames: ['currency', 'total_amt'], resultKeyColumns: ['currency'], sampleLimit: -1, partitionNum: 8, maxPartitionNum: 128, compareLimit: 22 })
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('version')
  })

  it('requires a choice among indexes and selects every column of a composite key', async () => {
    analyze.mockResolvedValue({ ...analysis, keyOptions: [primary, alternate] })
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    await parse(wrapper)
    const picker = wrapper.get('[data-testid="sql-source-index"]')
    expect(picker.text()).toContain('acct_pk')
    expect(picker.text()).toContain('acct_uq')
    expect(picker.text()).toContain('total_amt, currency')
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="sql-select-total_amt"]').setValue(false)
    await picker.setValue(alternate.indexName)
    expect(wrapper.get('[data-testid="sql-select-total_amt"]').element.checked).toBe(true)
    expect(wrapper.get('[data-testid="sql-key-total_amt"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    expect(wrapper.emitted('save').at(-1)[0].resultKeyColumns).toEqual(alternate.columnNames)
    await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="sql-source-index"]').element.value).toBe('')
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
  })

  it.each([[[], '完整'], [undefined, '服务版本']])('keeps analyzed fields but blocks save without current index options', async (keyOptions, message) => {
    analyze.mockResolvedValue({ ...analysis, keyOptions })
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    await parse(wrapper)
    expect(wrapper.get('[data-testid="sql-select-currency"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    expect(wrapper.get('.validation-message').text()).toContain(message)
  })

  it('resolves saved keys only after fresh analysis and requires a choice for duplicate indexes', async () => {
    const initial = { customSql: analysis, fields: [{ columnName: 'currency' }], comparisonKey: { columnNames: ['currency'] } }
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze, initialRegistration: initial } })
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    analyze.mockResolvedValueOnce({ ...analysis, keyOptions: [alternate, primary] })
    await parse(wrapper)
    expect(wrapper.get('[data-testid="sql-source-index"]').element.value).toBe(primary.indexName)
    const duplicate = { ...primary, indexName: 'also_currency', indexType: 'UNIQUE_INDEX' }
    analyze.mockResolvedValueOnce({ ...analysis, keyOptions: [primary, duplicate] })
    await parse(wrapper)
    const picker = wrapper.get('[data-testid="sql-source-index"]')
    expect(picker.element.value).toBe('')
    expect(picker.text()).toContain('also_currency')
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    await picker.setValue(duplicate.indexName)
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(false)
    analyze.mockResolvedValueOnce({ ...analysis, keyOptions: [] })
    await parse(wrapper)
    expect(wrapper.get('[data-testid="sql-key-currency"]').element.checked).toBe(false)
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
  })

  it('lets a new SQL registration explicitly request an additional configuration', async () => {
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    await parse(wrapper)
    await wrapper.get('[data-testid="custom-sql-additional"]').setValue(true)
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    expect(wrapper.emitted('save').at(-1)[0]).toMatchObject({ displayName: '默认配置', createAdditionalConfiguration: true })
  })
  beforeEach(() => { analyze.mockReset(); analyze.mockResolvedValue(analysis) })

  it('analyzes SQL, shows read-only source metadata and saves ordered fields with selected result keys', async () => {
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    expect(wrapper.get('[data-testid="custom-sql-name"]').element.value).toBe('默认配置')
    await parse(wrapper)
    expect(wrapper.get('[data-testid="custom-sql-table-name"]').text()).toBe('acct')
    expect(wrapper.get('[data-testid="custom-sql-table-comment"]').text()).toBe('账户表')
    expect(wrapper.text()).toContain('存款组')
    expect(wrapper.text()).toContain('张三')
    expect(wrapper.text()).toContain('DECIMAL')
    expect(wrapper.get('[data-testid="sql-select-currency"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="sql-move-up-total_amt"]').trigger('click')
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    expect(wrapper.emitted('save')[0][0]).toEqual({ displayName: '默认配置', sourceTableName: 'acct', sql, fieldNames: ['total_amt', 'currency'], resultKeyColumns: ['currency'], compareLimit: null, maxPartitionNum: 64 })
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
    expect(wrapper.find('[data-testid="sql-source-index"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
    await wrapper.get('[data-testid="custom-sql-text"]').setValue(sql)
    await wrapper.get('[data-testid="analyze-custom-sql"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="custom-sql-text"]').setValue(`${sql} having sum(amount) > 0`)
    expect(wrapper.find('[data-testid="sql-select-currency"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sql-source-index"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="save-custom-sql"]').element.disabled).toBe(true)
  })

  it('retains invalid SQL on analysis failure and obtains table metadata after retry', async () => {
    analyze.mockRejectedValueOnce(new Error('结果字段未覆盖来源表的完整主键或唯一索引，请修改 SQL'))
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze } })
    await parse(wrapper)
    expect(wrapper.get('[data-testid="custom-sql-error"]').text()).toContain('请修改 SQL')
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
    expect(wrapper.emitted('save')[0][0]).toEqual({ displayName: '默认配置', id: 18, version: 6, sourceTableName: 'acct', sql,
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
    expect(wrapper.get('[data-testid="sql-source-index"]').element.value).toBe(primary.indexName)
    expect(wrapper.get('[data-testid="sql-key-currency"]').element.disabled).toBe(true)
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

  it('saves all custom SQL differences while preserving the source result limit and quantity draft', async () => {
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze, canConfigurePartitions: true } })
    await parse(wrapper)
    await wrapper.get('[data-testid="custom-sql-limit"]').setValue('25')
    await wrapper.get('[data-testid="custom-sql-sample"]').setValue('900')
    await wrapper.get('[data-testid="custom-sql-sample-mode"]').setValue('ALL')
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    expect(wrapper.emitted('save').at(-1)[0]).toMatchObject({ sampleLimit: -1, compareLimit: 25 })
    await wrapper.get('[data-testid="custom-sql-sample-mode"]').setValue('LIMITED')
    expect(wrapper.get('[data-testid="custom-sql-sample"]').element.value).toBe('900')
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    expect(wrapper.emitted('save').at(-1)[0].sampleLimit).toBe(900)
  })

  it.each([false, true])('loads full custom SQL settings and enforces permission (%s)', async allowed => {
    const initial = { id: 11, version: 4, tableName: 'acct', sampleLimit: -1,
      customSql: { sql, sourceTableName: 'acct', resultColumns: columns },
      fields: [{ columnName: 'currency' }], comparisonKey: { columnNames: ['currency'] } }
    const wrapper = mount(CustomSqlEditor, { props: { analyzeSql: analyze, initialRegistration: initial, canConfigurePartitions: allowed } })
    await parse(wrapper)
    expect(wrapper.get('[data-testid="custom-sql-sample-mode"]').element.value).toBe('ALL')
    expect(wrapper.get('[data-testid="custom-sql-sample-mode"]').element.disabled).toBe(!allowed)
    await wrapper.get('[data-testid="save-custom-sql"]').trigger('click')
    if (allowed) expect(wrapper.emitted('save').at(-1)[0].sampleLimit).toBe(-1)
    else expect(wrapper.emitted('save').at(-1)[0]).not.toHaveProperty('sampleLimit')
    await wrapper.setProps({ saving: true })
    expect(wrapper.get('[data-testid="custom-sql-sample-mode"]').element.disabled).toBe(true)
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
