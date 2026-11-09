import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from './replayReopens.js'
const originalFetch = global.fetch
const response = data => new Response(JSON.stringify({ code: 200, message: 'success', data }), { headers: { 'Content-Type': 'application/json' } })
afterEach(() => { global.fetch = originalFetch })
describe('reopen API contract', () => {
  it('unwraps R and encodes all-filtered scopes without pagination for statistics', async () => {
    global.fetch = vi.fn().mockResolvedValue(response({ totalEvents: 6 }))
    expect(await api.getReopenStatistics({ issueKey: 'A|B', replayType: 'QUERY', onlyMine: false })).toEqual({ totalEvents: 6 })
    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/reopens/statistics?issueKey=A%7CB&replayType=QUERY&onlyMine=false')
  })
  it.each([
    ['getReopenPermissions', [], '/permissions', undefined],
    ['getReopenFilters', [{ replayType: 'DZ' }], '/filters?replayType=DZ', undefined],
    ['searchReopenDevelopers', ['张 三', 20], '/developers?keyword=%E5%BC%A0%20%E4%B8%89&limit=20', undefined],
    ['listReopenEvents', [{ page: 2, pageSize: 20 }], '/events?page=2&pageSize=20', undefined],
    ['getReopenEvent', [7], '/events/7', undefined],
    ['getReopenHistory', [7, { page: 3, pageSize: 20 }], '/events/7/history?page=3&pageSize=20', undefined],
    ['getReopenIssueCounts', [['A', 'B']], '/issue-counts', { issueKeys: ['A', 'B'] }],
    ['listReopenAppeals', [{ assignedToMe: true }], '/appeals?assignedToMe=true', undefined],
    ['getReopenAppeal', [3], '/appeals/3', undefined],
    ['createReopenAppeal', [{ requestId: 'uuid', eventIds: [7], expectedVersions: { 7: 2 }, kind: 'RECHECK', suggestedOwnerUsername: 'liu', reason: '原因', evidence: '日志' }], '/appeals', { requestId: 'uuid', eventIds: [7], expectedVersions: { 7: 2 }, kind: 'RECHECK', suggestedOwnerUsername: 'liu', reason: '原因', evidence: '日志' }],
    ['decideReopenAppeal', [3, { expectedVersion: 1, decision: 'APPROVE', finalOwnerUsername: 'chen', reason: '核查' }], '/appeals/3/decisions', { expectedVersion: 1, decision: 'APPROVE', finalOwnerUsername: 'chen', reason: '核查' }],
    ['withdrawReopenAppeal', [3, { expectedVersion: 1, reason: '补充' }], '/appeals/3/withdraw', { expectedVersion: 1, reason: '补充' }],
    ['reassignReopenAppeal', [3, { expectedVersion: 1, leaderUsername: 'lin', reason: '离岗' }], '/appeals/3/reassign', { expectedVersion: 1, leaderUsername: 'lin', reason: '离岗' }],
    ['assignReopenEvent', [7, { expectedVersion: 2, targetOwnerUsername: 'chen', reason: '核实' }], '/events/7/assign', { expectedVersion: 2, targetOwnerUsername: 'chen', reason: '核实' }],
    ['getReopenPolicies', [], '/policies', undefined],
    ['saveReopenPolicy', ['结算组', { expectedVersion: 0, leaderUsernames: ['lin'], primaryLeaderUsername: 'lin', reason: '授权' }], '/policies/%E7%BB%93%E7%AE%97%E7%BB%84', { expectedVersion: 0, leaderUsernames: ['lin'], primaryLeaderUsername: 'lin', reason: '授权' }],
  ])('%s uses the documented endpoint and payload', async (name, args, suffix, body) => {
    global.fetch = vi.fn().mockResolvedValue(response({ ok: true }))
    expect(await api[name](...args)).toEqual({ ok: true })
    expect(fetch.mock.calls[0][0]).toBe('/api/ai/parallel-replay/issues/reopens' + suffix)
    if (body) expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body)
    if (name === 'saveReopenPolicy') expect(fetch.mock.calls[0][1].method).toBe('PUT')
  })
  it('preserves server conflict details', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 409, message: '版本已变化', data: { errorCode: 'CONFLICT' } }), { status: 409 }))
    await expect(api.createReopenAppeal({})).rejects.toMatchObject({ message: '版本已变化', status: 409, data: { errorCode: 'CONFLICT' } })
  })
})
