import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  batchReviewMessageSequenceIgnores,
  batchDeleteReplayConfigs,
  createMessageSequenceIgnores,
  deleteMessageSequenceIgnore,
  createReplayConfig,
  deleteReplayConfig,
  listReplayConfigOperations,
  listReplayConfigs,
  updateReplayConfig,
  updateMessageSequenceIgnore,
  exportReviewedOneSideErrorCodeIgnores,
} from './replayConfigs.js'

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const nativeFetch = global.fetch

afterEach(() => {
  global.fetch = nativeFetch
})

describe('replayConfigs API', () => {
  it('list builds query string and skips empty values', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0, items: [] } }))

    await listReplayConfigs('conditional-ignores', {
      limit: 30,
      offset: 0,
      internalTransactionCode: 'Y444',
      origTrcd: 'Corp',
      fieldRmoveName: '',
      fieldFileFlag: 2,
    })

    expect(fetch.mock.calls[0][0]).toBe(
      '/api/ai/parallel-replay/config/conditional-ignores?limit=30&offset=0&internalTransactionCode=Y444&origTrcd=Corp&fieldFileFlag=2',
    )
    expect(fetch.mock.calls[0][1].method).toBeUndefined()
  })

  it('create posts JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { id: 1 } }))

    await createReplayConfig('unconditional-ignores', { tranCode: 'S1&sop', fieldName: 'accountNo' })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/config/unconditional-ignores')
    const options = fetch.mock.calls[0][1]
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ tranCode: 'S1&sop', fieldName: 'accountNo' })
  })

  it('update patches with encoded id and version body', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { id: 7 } }))

    await updateReplayConfig('sort-fields', 7, { origTrcd: 'S1&bzjson', version: 3 })

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/config/sort-fields/7')
    expect(fetch.mock.calls[0][1].method).toBe('PATCH')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ origTrcd: 'S1&bzjson', version: 3 })
  })

  it('delete passes version as query parameter', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: null }))

    await deleteReplayConfig('error-code-ignores', 9, 2)

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/config/error-code-ignores/9?version=2')
    expect(fetch.mock.calls[0][1].method).toBe('DELETE')
  })

  it('batch delete posts items', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { deletedCount: 2 } }))

    await batchDeleteReplayConfigs('unconditional-ignores', [{ id: 1, version: 0 }, { id: 2, version: 1 }])

    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/config/unconditional-ignores/batch-delete')
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ items: [{ id: 1, version: 0 }, { id: 2, version: 1 }] })
  })

  it('operations query string omits empty params', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: { total: 0, items: [] } }))

    await listReplayConfigOperations('conditional-ignores', 5, { limit: 100, offset: 0 })

    expect(fetch.mock.calls[0][0]).toBe(
      '/api/ai/parallel-replay/config/conditional-ignores/5/operations?limit=100&offset=0',
    )
  })

  it('creates message sequence ignores with the dedicated payload', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ code: 200, data: [] }))
    const body = { serviceCode: 'S1&sop', category: 'QUERY', messageSequences: 'a,b', ignoreReason: '原因' }
    await createMessageSequenceIgnores(body)
    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/config/message-sequence-ignores')
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body)
  })

  it('uses id-only message sequence update review and delete requests', async () => {
    global.fetch = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ code: 200, data: {} })))
    await updateMessageSequenceIgnore(7, { serviceCode: 'S1&sop', category: 'QUERY', messageSequence: 'a', ignoreReason: '原因' })
    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/config/message-sequence-ignores/7')
    expect(fetch.mock.calls[0][1].body).not.toContain('version')

    await batchReviewMessageSequenceIgnores([1, 2])
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ ids: [1, 2] })

    await deleteMessageSequenceIgnore(7)
    expect(fetch.mock.calls[2][0]).toBe('/api/ai/parallel-replay/config/message-sequence-ignores/7')
    expect(fetch.mock.calls[2][1].method).toBe('DELETE')
  })

  it('exports reviewed one-side error codes through the dedicated path', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(new Blob(['内容']), { status: 200 }))
    await exportReviewedOneSideErrorCodeIgnores()
    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/config/one-side-error-code-ignores/export')
  })
})
