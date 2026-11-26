import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Manager from './ReplayDatabaseComparisonScriptManager.vue'
import * as api from '../../api/replayDatabaseComparison.js'

vi.mock('../../api/replayDatabaseComparison.js', () => ({
  listScriptConfigurations: vi.fn(), getScriptConfiguration: vi.fn(), createScriptConfiguration: vi.fn(),
  updateScriptConfiguration: vi.fn(), importScriptConfigurationTables: vi.fn(), previewScriptConfigurationMetadata: vi.fn(),
}))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const table = (name = 'acct', extra = 'amount') => ({
  tableName: name, tableComment: '账户主表', domainName: '存款组', ownerName: '负责人文字', maxPartitionNum: 64, ignoredFields: [],
  fields: [
    { columnName: 'id', columnComment: '主键', dataType: 'bigint', ordinalPosition: 1, primaryKey: true, primaryKeyOrder: 1 },
    { columnName: 'updated_at', columnComment: '更新时间', dataType: 'timestamp', ordinalPosition: 2, primaryKey: false, primaryKeyOrder: null },
    { columnName: extra, columnComment: '金额', dataType: 'numeric', ordinalPosition: 3, primaryKey: false, primaryKeyOrder: null },
  ],
})
const detail = (id = 1) => ({ id, name: `方案${id}`, revision: 3, globalIgnoredFields: [], tables: [table()], tableCount: 1, fieldCount: 3, updatedAt: '2026-11-24T10:00:00', updatedBy: 'editor' })
const customSource = {
  mode: 'CUSTOM', host: 'migration.example.test', port: 5432,
  database: 'migration', schema: 'public', username: 'compare_reader',
}
const connectionInput = (wrapper, field) => wrapper.get(`[data-testid="script-connection-${field}"]`)
async function setConnection(wrapper, values) {
  for (const [field, value] of Object.entries(values)) await connectionInput(wrapper, field).setValue(String(value))
}
const selectProfile = (wrapper, id) => wrapper.get(`[data-testid="script-profile-${id}"]`).trigger('click')
const saveConfig = wrapper => wrapper.get('[data-testid="save-script-config"]').trigger('click')
const refreshMetadata = wrapper => wrapper.get('[data-testid="refresh-script-fields"]').trigger('click')

async function upload(wrapper) {
  const file = new File(['tables'], 'tables.xlsx')
  Object.defineProperty(wrapper.get('[data-testid="script-tables-file"]').element, 'files', { value: [file], configurable: true })
  await wrapper.get('[data-testid="script-tables-file"]').trigger('change')
  await wrapper.get('[data-testid="preview-script-tables"]').trigger('click')
  await flushPromises()
  return file
}
async function mountBaseManager() {
  const wrapper = mount(Manager, { props: { open: true } })
  await flushPromises()
  await setConnection(wrapper, { mode: 'BASE' })
  return wrapper
}
beforeEach(() => {
  vi.resetAllMocks()
  api.listScriptConfigurations.mockResolvedValue({ items: [detail(1), detail(2)] })
  api.getScriptConfiguration.mockImplementation(async id => detail(id))
  api.importScriptConfigurationTables.mockResolvedValue({ tables: [table('ACCT')] })
  api.createScriptConfiguration.mockResolvedValue({ ...detail(7), revision: 1 })
  api.updateScriptConfiguration.mockResolvedValue({ ...detail(1), revision: 4 })
  api.previewScriptConfigurationMetadata.mockResolvedValue({ tables: [table()] })
})
describe('named database comparison script manager', () => {
  it.each(['new', 'switch', 'reopen'])('clears the native file selection before importing the same file after %s', async action => {
    const wrapper = await mountBaseManager()
    const file = new File(['tables'], 'A.xlsx')
    const chooseFile = async () => {
      const data = new DataTransfer()
      data.items.add(file)
      const input = wrapper.get('[data-testid="script-tables-file"]')
      input.element.files = data.files
      await input.trigger('change')
    }
    await chooseFile()
    await wrapper.get('[data-testid="preview-script-tables"]').trigger('click'); await flushPromises()
    expect(wrapper.get('[data-testid="script-tables-file"]').element.value).toContain('A.xlsx')
    if (action === 'new') await wrapper.get('[data-testid="new-script-config"]').trigger('click')
    else if (action === 'switch') await wrapper.get('[data-testid="script-profile-1"]').trigger('click')
    else {
      await wrapper.get('[data-testid="close-script-manager"]').trigger('click')
      expect(wrapper.emitted('close')).toHaveLength(1)
      await wrapper.setProps({ open: false }); await wrapper.setProps({ open: true })
    }
    await flushPromises()
    expect(wrapper.get('[data-testid="script-tables-file"]').element.value).toBe('')
    expect(wrapper.get('[data-testid="script-tables-file"]').element.files).toHaveLength(0)
    expect(wrapper.get('[data-testid="preview-script-tables"]').attributes('disabled')).toBeDefined()
    await setConnection(wrapper, { mode: 'BASE' })
    await chooseFile()
    expect(wrapper.get('[data-testid="preview-script-tables"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="preview-script-tables"]').trigger('click'); await flushPromises()
    expect(api.importScriptConfigurationTables).toHaveBeenCalledTimes(2)
    expect(api.importScriptConfigurationTables).toHaveBeenLastCalledWith(
      file, action === 'switch' ? { connection: { mode: 'BASE' }, configurationId: 1, revision: 3 } : { connection: { mode: 'BASE' } },
    )
    wrapper.unmount()
  })

  it('previews Excel without saving and creates canonical rules while always retaining primary keys', async () => {
    const wrapper = await mountBaseManager()
    await wrapper.get('[data-testid="script-config-name"]').setValue('  平台全量  ')
    const file = await upload(wrapper)
    expect(api.importScriptConfigurationTables).toHaveBeenCalledWith(file, { connection: { mode: 'BASE' } })
    expect(api.createScriptConfiguration).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="script-global-ignored-fields"]').setValue("('ID'), ('UPDATED_AT'),\n'updated_at'")
    const pk = wrapper.get('[data-testid="ignore-script-field-id"]')
    expect(pk.attributes('disabled')).toBeDefined()
    expect(pk.element.checked).toBe(false)
    expect(wrapper.get('[data-testid="ignore-script-field-updated_at"]').element.checked).toBe(true)
    expect(wrapper.text()).toContain('主键始终保留')
    await wrapper.get('[data-testid="ignore-script-field-amount"]').setValue(true)
    await wrapper.get('[data-testid="script-table-max-partitions-acct"]').setValue('100')
    await wrapper.get('[data-testid="save-script-config"]').trigger('click')
    await flushPromises()
    expect(api.createScriptConfiguration).toHaveBeenCalledExactlyOnceWith({
      name: '平台全量', revision: 0, connection: { mode: 'BASE' }, globalIgnoredFields: ['id', 'updated_at'], tables: [
        { tableName: 'acct', tableComment: '账户主表', domainName: '存款组', ownerName: '负责人文字', maxPartitionNum: 100, ignoredFields: ['amount'] },
      ],
    })
    expect(wrapper.emitted('saved')[0][0]).toEqual(expect.objectContaining({ id: 7, revision: 1 }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('renders fields for only the selected table and saves renames and draft table removals with the original revision', async () => {
    api.getScriptConfiguration.mockResolvedValue({ ...detail(), tables: [table(), table('loan', 'loan_only')] })
    const wrapper = await mountBaseManager()
    await wrapper.get('[data-testid="script-profile-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('input[data-testid^="ignore-script-field-"]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="ignore-script-field-loan_only"]').exists()).toBe(false)
    await wrapper.get('[data-testid="select-script-table-loan"]').trigger('click')
    expect(wrapper.find('[data-testid="ignore-script-field-loan_only"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ignore-script-field-amount"]').exists()).toBe(false)
    await wrapper.get('[data-testid="remove-script-table-loan"]').trigger('click')
    await wrapper.get('[data-testid="script-config-name"]').setValue('改名方案')
    await wrapper.get('[data-testid="save-script-config"]').trigger('click')
    await flushPromises()
    expect(api.updateScriptConfiguration).toHaveBeenCalledWith(1, expect.objectContaining({ name: '改名方案', revision: 3, tables: [expect.objectContaining({ tableName: 'acct' })] }))
    expect(api.updateScriptConfiguration.mock.calls[0][1].tables[0]).not.toHaveProperty('fields')
    wrapper.unmount()
  })

  it('ignores a late detail response after switching to another named configuration', async () => {
    const old = deferred()
    api.getScriptConfiguration.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ...detail(2), tables: [table('loan', 'loan_only')] })
    const wrapper = await mountBaseManager()
    await wrapper.get('[data-testid="script-profile-1"]').trigger('click')
    await wrapper.get('[data-testid="script-profile-2"]').trigger('click')
    await flushPromises()
    old.resolve(detail(1)); await flushPromises()
    expect(wrapper.get('[data-testid="script-config-name"]').element.value).toBe('方案2')
    expect(wrapper.find('[data-testid="select-script-table-loan"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="select-script-table-acct"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each([0, 257, 1.5])('rejects maximum hash partition value %s without saving the preview', async max => {
    const wrapper = await mountBaseManager(); await upload(wrapper)
    await wrapper.get('[data-testid="script-config-name"]').setValue('方案')
    await wrapper.get('[data-testid="script-table-max-partitions-acct"]').setValue(String(max))
    await wrapper.get('[data-testid="save-script-config"]').trigger('click')
    await flushPromises()
    expect(api.createScriptConfiguration).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="script-manager-errors"]').text()).toContain('1 到 256 的整数')
    wrapper.unmount()
  })

  it.each([[undefined, 64], [1, 1], [256, 256]])('uses imported hash maximum %s as %s when saving', async (input, expected) => {
    api.importScriptConfigurationTables.mockResolvedValue({ tables: [{ ...table(), maxPartitionNum: input }] })
    const wrapper = await mountBaseManager(); await upload(wrapper)
    expect(wrapper.get('[data-testid="script-table-max-partitions-acct"]').element.value).toBe(String(expected))
    await wrapper.get('[data-testid="script-config-name"]').setValue('边界方案')
    await wrapper.get('[data-testid="save-script-config"]').trigger('click'); await flushPromises()
    expect(api.createScriptConfiguration).toHaveBeenCalledWith(expect.objectContaining({ tables: [expect.objectContaining({ maxPartitionNum: expected })] }))
    wrapper.unmount()
  })

  it.each(['SELECT id FROM acct', "LOWER('ID')", "('id'); DROP TABLE acct"])( 'does not parse arbitrary SQL %s as a global ignored-field list', async value => {
    const wrapper = await mountBaseManager(); await upload(wrapper)
    await wrapper.get('[data-testid="script-config-name"]').setValue('方案')
    await wrapper.get('[data-testid="script-global-ignored-fields"]').setValue(value)
    await wrapper.get('[data-testid="save-script-config"]').trigger('click')
    await flushPromises()
    expect(api.createScriptConfiguration).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="script-manager-errors"]').text()).toContain('字段名')
    wrapper.unmount()
  })

  it('does not allow a failed detail load to save the previous configuration into another id', async () => {
    api.getScriptConfiguration.mockResolvedValueOnce(detail(1)).mockRejectedValueOnce(new Error('明细读取失败'))
    const wrapper = await mountBaseManager()
    await wrapper.get('[data-testid="script-profile-1"]').trigger('click'); await flushPromises()
    await wrapper.get('[data-testid="script-profile-2"]').trigger('click'); await flushPromises()
    expect(wrapper.get('[data-testid="script-manager-errors"]').text()).toContain('明细读取失败')
    await wrapper.get('[data-testid="save-script-config"]').trigger('click'); await flushPromises()
    expect(api.updateScriptConfiguration).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="select-script-table-acct"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('locks imports and closing, and ignores a preview that finishes after a new dialog session', async () => {
    const pending = deferred()
    api.importScriptConfigurationTables.mockReturnValueOnce(pending.promise)
    const wrapper = await mountBaseManager()
    const file = new File(['tables'], 'tables.xlsx')
    Object.defineProperty(wrapper.get('[data-testid="script-tables-file"]').element, 'files', { value: [file] })
    await wrapper.get('[data-testid="script-tables-file"]').trigger('change')
    await wrapper.get('[data-testid="preview-script-tables"]').trigger('click')
    expect(wrapper.get('[data-testid="close-script-manager"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="new-script-config"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="script-profile-1"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="close-script-manager"]').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.setProps({ open: false }); await wrapper.setProps({ open: true }); await flushPromises()
    pending.resolve({ tables: [table('stale_table')] }); await flushPromises()
    expect(wrapper.find('[data-testid="select-script-table-stale_table"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="script-config-name"]').element.value).toBe('')
    wrapper.unmount()
  })

  it('prevents duplicate saves, keeps validation details visible, and lets the user retry the same draft', async () => {
    let failSave
    api.createScriptConfiguration.mockReturnValueOnce(new Promise((_, reject) => { failSave = reject }))
    const wrapper = await mountBaseManager(); await upload(wrapper)
    await wrapper.get('[data-testid="script-config-name"]').setValue('保留草稿')
    await wrapper.get('[data-testid="save-script-config"]').trigger('click')
    await wrapper.get('[data-testid="save-script-config"]').trigger('click')
    expect(api.createScriptConfiguration).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="script-config-name"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="close-script-manager"]').attributes('disabled')).toBeDefined()
    const error = new Error('配置校验失败')
    error.data = { errors: [{ row: 8, tableName: 'acct', fieldName: 'bad_field', reason: '字段不存在' }] }
    failSave(error); await flushPromises()
    expect(wrapper.get('[data-testid="script-manager-errors"]').text()).toContain('8')
    expect(wrapper.get('[data-testid="script-manager-errors"]').text()).toContain('bad_field')
    expect(wrapper.get('[data-testid="script-manager-errors"]').text()).toContain('字段不存在')
    expect(wrapper.get('[data-testid="script-config-name"]').element.value).toBe('保留草稿')
    await wrapper.get('[data-testid="save-script-config"]').trigger('click'); await flushPromises()
    expect(api.createScriptConfiguration).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('saved')).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('script source database', () => {
  it('previews and saves a new Gauss source with the same password bytes', async () => {
    const wrapper = mount(Manager, { props: { open: true } })
    await flushPromises()
    expect(connectionInput(wrapper, 'mode').element.value).toBe('CUSTOM')
    expect(connectionInput(wrapper, 'port').element.value).toBe('5432')
    expect(connectionInput(wrapper, 'schema').element.value).toBe('public')
    expect(connectionInput(wrapper, 'password').attributes('type')).toBe('password')

    api.createScriptConfiguration.mockResolvedValueOnce({
      ...detail(7), revision: 1, connection: { ...customSource, passwordConfigured: true },
    })
    const password = '  password with spaces  '
    await setConnection(wrapper, { host: 'migration.example.test', database: 'migration', username: 'compare_reader', password })
    const file = await upload(wrapper)
    expect(api.importScriptConfigurationTables).toHaveBeenCalledExactlyOnceWith(file, { connection: { ...customSource, password } })
    await wrapper.get('[data-testid="script-config-name"]').setValue('迁移比对')
    await saveConfig(wrapper)
    await flushPromises()
    expect(api.createScriptConfiguration).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      connection: { ...customSource, password },
    }))
    expect(connectionInput(wrapper, 'password').element.value).toBe('')
    expect(JSON.stringify(wrapper.emitted('saved'))).not.toContain(password)
    wrapper.unmount()
  })

  it('uses the saved revision to retain a password when the schema alone changes', async () => {
    api.getScriptConfiguration.mockResolvedValueOnce({ ...detail(), connection: { ...customSource, passwordConfigured: true } })
    const wrapper = mount(Manager, { props: { open: true } })
    await flushPromises()
    await selectProfile(wrapper, 1)
    await flushPromises()
    expect(connectionInput(wrapper, 'host').element.value).toBe(customSource.host)
    expect(connectionInput(wrapper, 'password').element.value).toBe('')
    expect(wrapper.text()).toContain('已设置密码')

    const connection = { ...customSource, schema: 'staging' }
    await setConnection(wrapper, { host: 'Migration.Example.Test', schema: 'staging' })
    const file = await upload(wrapper)
    expect(api.importScriptConfigurationTables).toHaveBeenCalledExactlyOnceWith(file, { connection, configurationId: 1, revision: 3 })
    await saveConfig(wrapper)
    await flushPromises()
    expect(api.updateScriptConfiguration).toHaveBeenCalledExactlyOnceWith(1, expect.objectContaining({ connection, revision: 3 }))
    wrapper.unmount()
  })

  it.each([
    ['host', 'other.example.test'],
    ['port', '5544'],
    ['database', 'Migration'],
    ['username', 'COMPARE_READER'],
  ])('clears typed passwords and requires replacement when changing %s', async (field, value) => {
    api.getScriptConfiguration.mockResolvedValueOnce({ ...detail(), connection: { ...customSource, passwordConfigured: true } })
    const wrapper = mount(Manager, { props: { open: true } })
    await flushPromises()
    await selectProfile(wrapper, 1)
    await flushPromises()

    await setConnection(wrapper, { password: 'old typed password' })
    await setConnection(wrapper, { [field]: value })
    expect(connectionInput(wrapper, 'password').element.value).toBe('')
    await saveConfig(wrapper)
    expect(api.updateScriptConfiguration).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="script-manager-errors"]').text()).toContain('密码')

    await setConnection(wrapper, { password: '  ' })
    await saveConfig(wrapper)
    await flushPromises()
    expect(api.updateScriptConfiguration).toHaveBeenCalledExactlyOnceWith(1, expect.objectContaining({
      connection: { ...customSource, [field]: field === 'port' ? Number(value) : value, password: '  ' },
    }))
    wrapper.unmount()
  })

  it.each(['0', '65536', '5432.5'])('rejects invalid source port %s before preview', async port => {
    const wrapper = mount(Manager, { props: { open: true } })
    await flushPromises()
    await setConnection(wrapper, { host: customSource.host, port, database: customSource.database, username: customSource.username, password: 'test password' })
    await upload(wrapper)
    expect(api.importScriptConfigurationTables).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="script-manager-errors"]').text()).toContain('1 到 65535')
    wrapper.unmount()
  })

  it('clears the typed secret on profile changes and saves BASE explicitly', async () => {
    api.getScriptConfiguration.mockResolvedValueOnce({ ...detail(), connection: { ...customSource, passwordConfigured: true } })
    const wrapper = mount(Manager, { props: { open: true } })
    await flushPromises()
    await setConnection(wrapper, { password: 'draft-only password' })
    await selectProfile(wrapper, 1)
    await flushPromises()
    expect(connectionInput(wrapper, 'password').element.value).toBe('')

    await setConnection(wrapper, { password: 'unsaved replacement', mode: 'BASE' })
    expect(wrapper.find('[data-testid="script-connection-password"]').exists()).toBe(false)
    await setConnection(wrapper, { mode: 'CUSTOM' })
    expect(connectionInput(wrapper, 'password').element.value).toBe('')
    await setConnection(wrapper, { mode: 'BASE' })
    await saveConfig(wrapper)
    await flushPromises()
    expect(api.updateScriptConfiguration).toHaveBeenCalledExactlyOnceWith(1, expect.objectContaining({ connection: { mode: 'BASE' } }))
    wrapper.unmount()
  })

  it('refreshes selected tables while preserving settings and making invalid ignores removable', async () => {
    const savedTable = { ...table(), ignoredFields: ['amount', 'updated_at'] }
    api.getScriptConfiguration.mockResolvedValueOnce({ ...detail(), connection: null, tables: [savedTable] })
    const fields = table('acct', 'new_amount').fields.map(field => field.columnName === 'updated_at' ? { ...field, primaryKey: true } : field)
    api.previewScriptConfigurationMetadata.mockResolvedValueOnce({
      tables: [{ ...table('ACCT'), tableComment: '源库注释', ownerName: '源库负责人', fields }],
    })
    const wrapper = mount(Manager, { props: { open: true } })
    await flushPromises()
    await selectProfile(wrapper, 1)
    await flushPromises()
    expect(connectionInput(wrapper, 'mode').element.value).toBe('BASE')
    expect(wrapper.find('[data-testid="ignore-script-field-amount"]').exists()).toBe(true)

    await setConnection(wrapper, { mode: 'CUSTOM', host: customSource.host, database: customSource.database, username: customSource.username, password: 'fresh password' })
    expect(wrapper.find('[data-testid="ignore-script-field-amount"]').exists()).toBe(false)
    await wrapper.get('input[aria-label="表中文名"]').setValue('草稿注释')
    await wrapper.get('select[aria-label="acct 分组"]').setValue('平台组')
    await wrapper.get('input[aria-label="acct 负责人"]').setValue('草稿负责人')
    await wrapper.get('[data-testid="script-table-max-partitions-acct"]').setValue('100')
    await refreshMetadata(wrapper)
    await flushPromises()
    const tableSettings = { tableName: 'acct', tableComment: '草稿注释', domainName: '平台组', ownerName: '草稿负责人', maxPartitionNum: 100 }
    expect(api.previewScriptConfigurationMetadata).toHaveBeenCalledExactlyOnceWith({
      configurationId: 1, revision: 3, connection: { ...customSource, password: 'fresh password' },
      tables: [{ ...tableSettings, ignoredFields: [] }],
    })
    expect(wrapper.get('[data-testid="ignore-script-field-updated_at"]').element.disabled).toBe(true)
    expect(wrapper.get('[data-testid="ignore-script-field-new_amount"]').element.checked).toBe(false)
    for (const name of ['amount', 'updated_at']) {
      await wrapper.get(`[data-testid="remove-invalid-script-ignore-${name}"]`).trigger('click')
    }
    await wrapper.get('[data-testid="ignore-script-field-new_amount"]').setValue(true)
    await saveConfig(wrapper)
    await flushPromises()
    expect(api.updateScriptConfiguration).toHaveBeenCalledExactlyOnceWith(1, expect.objectContaining({
      tables: [{ ...tableSettings, ignoredFields: ['new_amount'] }],
    }))
    wrapper.unmount()
  })

  it('discards pending fields when switching profiles and loads the next profile', async () => {
    const pending = deferred()
    api.previewScriptConfigurationMetadata.mockReturnValueOnce(pending.promise)
    api.getScriptConfiguration.mockResolvedValueOnce(detail(1)).mockResolvedValueOnce({
      ...detail(2), tables: [table('loan', 'loan_only')],
    })
    const wrapper = mount(Manager, { props: { open: true } })
    await flushPromises()
    await selectProfile(wrapper, 1)
    await flushPromises()
    await refreshMetadata(wrapper)
    await selectProfile(wrapper, 2)
    pending.resolve({ tables: [table('acct', 'obsolete')] })
    await flushPromises()
    expect(wrapper.get('[data-testid="script-config-name"]').element.value).toBe('方案2')
    expect(wrapper.find('[data-testid="ignore-script-field-loan_only"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ignore-script-field-obsolete"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('discards metadata from an earlier source or table selection', async () => {
    const first = deferred(), second = deferred()
    api.getScriptConfiguration.mockResolvedValueOnce({ ...detail(), connection: { ...customSource, passwordConfigured: true }, tables: [table(), table('loan')] })
    api.previewScriptConfigurationMetadata.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = mount(Manager, { props: { open: true } })
    await flushPromises()
    await selectProfile(wrapper, 1)
    await flushPromises()
    await refreshMetadata(wrapper)
    await setConnection(wrapper, { schema: 'latest' })
    await refreshMetadata(wrapper)
    await wrapper.get('[data-testid="remove-script-table-loan"]').trigger('click')
    second.resolve({ tables: [table('acct', 'removed_selection'), table('loan')] })
    first.resolve({ tables: [table('acct', 'stale_schema'), table('loan')] })
    await flushPromises()
    expect(wrapper.find('[data-testid="select-script-table-loan"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ignore-script-field-stale_schema"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ignore-script-field-removed_selection"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="refresh-script-fields"]').element.disabled).toBe(false)
    wrapper.unmount()
  })
})
