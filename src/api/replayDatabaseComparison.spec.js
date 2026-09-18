import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./index.js', () => ({ request: vi.fn(), download: vi.fn() }))

import { download, request } from './index.js'
import {
  createRegistration,
  deleteRegistration,
  generateVersion,
  generateVersionConfigScript,
  importInitialExcel,
  loadAuditDetails,
  loadBaseColumns,
  loadHeaderFilterOptions,
  loadRegistration,
  loadRegistrationAudits,
  loadOptions,
  loadLatestVersion,
  loadVersions,
  loadVersionHeaderFilterOptions,
  loadVersionConfigScriptStatus,
  reregisterRegistration,
  searchAudits,
  searchGroupedAudits,
  searchBaseTables,
  searchRegistrations,
  searchVersionSnapshot,
  downloadVersionConfigScript,
  synchronizePrimaryKeys,
  updateRegistration,
} from './replayDatabaseComparison.js'

describe('replayDatabaseComparison api', () => {
  beforeEach(() => {
    request.mockReset()
    download.mockReset()
    global.fetch = vi.fn()
  })

  it('uses exact JSON API paths and bodies', async () => {
    await searchRegistrations({ page: 0, size: 50, tableKeyword: '', metadataStatuses: ['MISSING_FIELDS'] })
    await loadRegistration(7)
    await loadHeaderFilterOptions({ targetColumn: 'domainName', keyword: '存' })
    await searchBaseTables('账户', 20)
    await loadBaseColumns('KDPA ACCT', 'acct')
    await createRegistration({ tableName: 'acct' })
    await updateRegistration(7, { version: 1 })
    await deleteRegistration(7, { version: 2, reason: '删除' })
    await reregisterRegistration(7, { version: 3, fieldNames: ['acct_no'] })
    await searchAudits({ page: 0, size: 50, tableKeyword: 'kdpa' })
    await searchGroupedAudits({ page: 0, size: 20, tableKeyword: '账户' })
    await loadAuditDetails(99)
    await loadRegistrationAudits(7, 1, 20)
    await loadOptions()
    await synchronizePrimaryKeys()
    await loadLatestVersion()
    await loadVersions(1, 20)
    await searchVersionSnapshot('20260914-142530', { page: 0, size: 50 })
    await loadVersionHeaderFilterOptions('20260914-142530', { targetColumn: 'domainName' })
    await loadVersionConfigScriptStatus('20260914-142530')

    expect(request.mock.calls).toEqual([
      ['/ai/parallel-replay/database-comparison-fields/search', { method: 'POST', body: JSON.stringify({ page: 0, size: 50, tableKeyword: '', metadataStatuses: ['MISSING_FIELDS'] }) }],
      ['/ai/parallel-replay/database-comparison-fields/7'],
      ['/ai/parallel-replay/database-comparison-fields/header-filter-options', { method: 'POST', body: JSON.stringify({ targetColumn: 'domainName', keyword: '存' }) }],
      ['/ai/parallel-replay/database-comparison-fields/metadata/tables?keyword=%E8%B4%A6%E6%88%B7&limit=20'],
      ['/ai/parallel-replay/database-comparison-fields/metadata/tables/KDPA%20ACCT/columns?keyword=acct'],
      ['/ai/parallel-replay/database-comparison-fields', { method: 'POST', body: JSON.stringify({ tableName: 'acct' }) }],
      ['/ai/parallel-replay/database-comparison-fields/7', { method: 'PUT', body: JSON.stringify({ version: 1 }) }],
      ['/ai/parallel-replay/database-comparison-fields/7', { method: 'DELETE', body: JSON.stringify({ version: 2, reason: '删除' }) }],
      ['/ai/parallel-replay/database-comparison-fields/7/reregister', { method: 'POST', body: JSON.stringify({ version: 3, fieldNames: ['acct_no'] }) }],
      ['/ai/parallel-replay/database-comparison-fields/audits/search', { method: 'POST', body: JSON.stringify({ page: 0, size: 50, tableKeyword: 'kdpa' }) }],
      ['/ai/parallel-replay/database-comparison-fields/audits/grouped-search', { method: 'POST', body: JSON.stringify({ page: 0, size: 20, tableKeyword: '账户' }) }],
      ['/ai/parallel-replay/database-comparison-fields/audits/99/details'],
      ['/ai/parallel-replay/database-comparison-fields/7/audits?page=1&size=20'],
      ['/ai/parallel-replay/database-comparison-fields/options'],
      ['/ai/parallel-replay/database-comparison-fields/metadata/primary-keys/sync', { method: 'POST', body: '{}' }],
      ['/ai/parallel-replay/database-comparison-fields/versions/latest'],
      ['/ai/parallel-replay/database-comparison-fields/versions?page=1&size=20'],
      ['/ai/parallel-replay/database-comparison-fields/versions/20260914-142530/search', { method: 'POST', body: JSON.stringify({ page: 0, size: 50 }) }],
      ['/ai/parallel-replay/database-comparison-fields/versions/20260914-142530/header-filter-options', { method: 'POST', body: JSON.stringify({ targetColumn: 'domainName' }) }],
      ['/ai/parallel-replay/database-comparison-fields/versions/20260914-142530/config-script'],
    ])
  })

  it('generates or downloads the selected immutable version script without a token', async () => {
    download.mockResolvedValue({ fileName: 'replay-db-compare-config-20260914-172637.sql' })

    await generateVersionConfigScript('20260914-172637')
    await downloadVersionConfigScript('20260914-172637')

    expect(download.mock.calls).toEqual([
      [
        '/ai/parallel-replay/database-comparison-fields/versions/20260914-172637/config-script',
        'replay-db-compare-config-20260914-172637.sql',
        { method: 'POST' },
      ],
      [
        '/ai/parallel-replay/database-comparison-fields/versions/20260914-172637/config-script/download',
        'replay-db-compare-config-20260914-172637.sql',
      ],
    ])
  })

  it('generates a version with the trigger token and preserves gate details', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, data: { versionNo: '20260914-142530' } }),
    })

    await expect(generateVersion('secret')).resolves.toEqual({ versionNo: '20260914-142530' })
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/ai/parallel-replay/database-comparison-fields/versions/generate',
      { method: 'POST', credentials: 'same-origin', headers: { 'X-DII-Trigger-Token': 'secret' } },
    )

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        code: 422,
        message: '1 张表未通过版本生成门禁',
        data: {
          errorCode: 'VERSION_GATE_BLOCKED',
          errors: [{ tableName: 'acct_master', missingFieldNames: ['legacy_id'] }],
        },
      }),
    })

    const error = await generateVersion('secret').catch(cause => cause)
    expect(error.code).toBe('VERSION_GATE_BLOCKED')
    expect(error.data.errors[0].missingFieldNames).toEqual(['legacy_id'])
  })

  it('uploads Excel with browser boundary and trigger token', async () => {
    const file = new File(['test'], 'fields.xlsx')
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, data: { success: true } }),
    })

    await importInitialExcel(file, 'secret')

    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/ai/parallel-replay/database-comparison-fields/import')
    expect(options.method).toBe('POST')
    expect(options.credentials).toBe('same-origin')
    expect(options.headers).toEqual({ 'X-DII-Trigger-Token': 'secret' })
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('file')).toBe(file)
  })

  it('preserves complete import validation data on failure', async () => {
    const file = new File(['test'], 'fields.xlsx')
    fetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        code: 422,
        message: '初始化导入校验失败，未写入任何数据',
        data: { errors: [{ sheetName: '存款', rowNumber: 2, tableName: 'acct', fieldName: 'bad', reviserInput: '张三', reason: '字段不存在' }] },
      }),
    })

    const error = await importInitialExcel(file, 'secret').catch(cause => cause)

    expect(error.message).toBe('初始化导入校验失败，未写入任何数据')
    expect(error.code).toBe(422)
    expect(error.data.errors[0]).toEqual(expect.objectContaining({
      sheetName: '存款', rowNumber: 2, reviserInput: '张三', reason: '字段不存在',
    }))
  })
})
