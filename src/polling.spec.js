import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routerKey } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import DaoIndexPage from './components/daoindex/DaoIndexPage.vue'
import DaoTaskList from './components/daoindex/DaoTaskList.vue'
import TransactionAnalysis from './views/TransactionAnalysis.vue'

const TASKS = '/api/ai/dao-index/batch-tasks'
const TODO = '/api/ai/dao-index/whitelist-applications/todo-count'
const USER = '/api/auth/me'
const DOMAINS = '/api/flowtran/domains'
const STATS = '/api/system/stats'
const BUILD = '/api/system/build-sync-status'

enableAutoUnmount(afterEach)

let hidden
let requests
let handlers

beforeEach(() => {
  vi.useFakeTimers()
  hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  requests = []
  handlers = {
    [TASKS]: () => tasks('task-current'),
    [TODO]: () => response({ currentUser: 'tester', count: 2, slowSqlCount: 1, sqlInspectCount: 1 }),
    [USER]: () => response({ username: 'tester', realName: '测试用户' }),
    [DOMAINS]: () => response([]),
    [STATS]: () => response({ totalDomains: 0, totalTransactions: 0, status: 'normal', statusText: '系统运行正常' }),
    [BUILD]: () => buildStatus('current'),
    '/api/neo4j/tables/catalog': () => response({ items: [] }),
    '/api/flowtran/impact/stats': () => response({ tableCount: 0, componentCount: 0, serviceCount: 0, componentBreakdown: {}, serviceBreakdown: {} }),
  }
  vi.stubGlobal('fetch', async (path, { signal } = {}) => {
    const url = new URL(path, window.location.origin)
    requests.push({ url, signal })
    return handlers[url.pathname](url)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function response(data) {
  return new Response(JSON.stringify({ code: 200, data }))
}

function tasks(taskNo, status = 'RUNNING') {
  return response({
    total: 1,
    items: [{
      id: 1, task_no: taskNo, env: 'uat', status, created_at: '',
      trigger_type: 'MANUAL', owner: 'tester', total_sqls: 2, pool_count: 3,
      explain_err: 0, llm_done: 0, llm_failed: 0,
    }],
  })
}

function buildStatus(versionNo) {
  return response({
    project: 'axon-link-server', branch: 'main', versionNo,
    statusText: '完成', statusType: 'success', message: '', refreshedAt: '',
  })
}

function deferred() {
  let resolve
  const promise = new Promise(settle => { resolve = settle })
  return { promise, resolve }
}

function calls(path) {
  return requests.filter(({ url }) => url.pathname === path)
}

function setHidden(value) {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
}

function mountHeader() {
  return mount(AppHeader, { global: { provide: { [routerKey]: {} } } })
}

function mountAnalysis() {
  return mount(TransactionAnalysis, { shallow: true })
}

describe('inspection task polling', () => {
  it('waits five seconds after a slow request settles before polling again', async () => {
    const slow = deferred()
    const defaultTasks = handlers[TASKS]
    handlers[TASKS] = () => calls(TASKS).length === 2 ? slow.promise : defaultTasks()
    mount(DaoTaskList)
    await flushPromises()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(calls(TASKS)).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(calls(TASKS)).toHaveLength(2)

    slow.resolve(tasks('task-slow'))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(4_999)
    expect(calls(TASKS)).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls(TASKS)).toHaveLength(3)
  })

  it('backs off after failures and restores the base delay after a successful retry', async () => {
    const defaultTasks = handlers[TASKS]
    handlers[TASKS] = () => {
      if ([2, 3].includes(calls(TASKS).length)) throw new Error('server unavailable')
      return defaultTasks()
    }
    const page = mount(DaoTaskList)
    await flushPromises()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(page.get('.dii-error').text()).toContain('server unavailable')
    await vi.advanceTimersByTimeAsync(9_999)
    expect(calls(TASKS)).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls(TASKS)).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(19_999)
    expect(calls(TASKS)).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(page.get('tbody').text()).toContain('task-current')
    await vi.advanceTimersByTimeAsync(5_000)
    expect(calls(TASKS)).toHaveLength(5)
  })

  it('requests tasks only while the task menu and the document are visible', async () => {
    const page = mount(DaoIndexPage, {
      global: { stubs: { DaoDashboard: true, DaoSqlList: true, DaoErDiagram: true, DaoSlowSqlList: true } },
    })
    await flushPromises()
    expect(calls(TASKS)).toHaveLength(0)

    setHidden(true)
    await page.setProps({ currentPage: 'dii-tasks' })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls(TASKS)).toHaveLength(0)

    setHidden(false)
    await flushPromises()
    expect(calls(TASKS)).toHaveLength(1)
    await page.setProps({ currentPage: 'dii-dashboard' })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls(TASKS)).toHaveLength(1)
  })

  it('coalesces filter, environment and manual refresh changes while an aborted request settles', async () => {
    const stale = deferred()
    const latest = deferred()
    handlers[TASKS] = () => calls(TASKS).length === 1 ? stale.promise : latest.promise
    const page = mount(DaoTaskList, { global: { stubs: { DiiTaskTriggerModal: true } } })
    await flushPromises()

    await page.get('.dii-filter-select').setValue('FAILED')
    await page.setProps({ env: 'prod' })
    await page.get('.dii-filter-select').setValue('DONE')
    page.getComponent({ name: 'DiiTaskTriggerModal' }).vm.$emit('triggered')
    await flushPromises()
    expect(calls(TASKS)).toHaveLength(1)
    expect(calls(TASKS)[0].signal.aborted).toBe(true)

    stale.resolve(tasks('stale-task'))
    await flushPromises()
    expect(page.text()).not.toContain('stale-task')
    expect(calls(TASKS)).toHaveLength(2)
    expect(Object.fromEntries(calls(TASKS)[1].url.searchParams)).toEqual({
      env: 'prod', status: 'DONE', limit: '20', offset: '0',
    })

    latest.resolve(tasks('fresh-task', 'DONE'))
    await flushPromises()
    expect(page.get('tbody').text()).toContain('fresh-task')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls(TASKS)).toHaveLength(2)
  })

  it('reloads the first page when its page size changes', async () => {
    const page = mount(DaoTaskList)
    await flushPromises()

    await page.get('.dii-pager-size').setValue('50')
    await flushPromises()
    expect(calls(TASKS)).toHaveLength(2)
    expect(calls(TASKS)[1].url.searchParams.get('limit')).toBe('50')
    expect(calls(TASKS)[1].url.searchParams.get('offset')).toBe('0')
  })

  it('aborts on unmount and never schedules polling from a late response', async () => {
    const slow = deferred()
    handlers[TASKS] = () => slow.promise
    const page = mount(DaoTaskList)
    await flushPromises()

    page.unmount()
    slow.resolve(tasks('late-task'))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls(TASKS)).toHaveLength(1)
    expect(calls(TASKS)[0].signal.aborted).toBe(true)
  })
})

describe('header todo polling', () => {
  it('does not start polling when user initialization completes after unmount', async () => {
    const user = deferred()
    handlers[USER] = () => user.promise
    const header = mountHeader()
    header.unmount()
    user.resolve(response({ username: 'tester', realName: '测试用户' }))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(calls(TODO)).toHaveLength(0)
    expect(calls(USER)[0].signal.aborted).toBe(true)
    expect(localStorage.getItem('dii-user')).toBeNull()
  })

  it('keeps the badge count when a refresh fails and backs off', async () => {
    const defaultTodo = handlers[TODO]
    handlers[TODO] = () => {
      if (calls(TODO).length === 2) throw new Error('server unavailable')
      return defaultTodo()
    }
    const header = mountHeader()
    await flushPromises()
    expect(header.get('.todo-bell-badge').text()).toBe('2')

    await vi.advanceTimersByTimeAsync(30_000)
    expect(header.get('.todo-bell-badge').text()).toBe('2')
    await vi.advanceTimersByTimeAsync(59_999)
    expect(calls(TODO)).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls(TODO)).toHaveLength(3)
  })

  it('cancels the hidden request and waits for it to settle before refreshing on show', async () => {
    const slow = deferred()
    const latest = deferred()
    const defaultTodo = handlers[TODO]
    handlers[TODO] = () => calls(TODO).length === 1 ? slow.promise : latest.promise
    setHidden(true)
    const header = mountHeader()
    await flushPromises()
    expect(calls(TODO)).toHaveLength(0)

    setHidden(false)
    await flushPromises()
    setHidden(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls(TODO)[0].signal.aborted).toBe(true)
    setHidden(false)
    await flushPromises()
    expect(calls(TODO)).toHaveLength(1)

    slow.resolve(response({ currentUser: 'tester', count: 99, slowSqlCount: 99, sqlInspectCount: 0 }))
    await flushPromises()
    expect(calls(TODO)).toHaveLength(2)
    expect(calls(TODO)[1].url.searchParams.get('currentUser')).toBe('tester')
    expect(header.find('.todo-bell-badge').exists()).toBe(false)

    latest.resolve(defaultTodo())
    await flushPromises()
    expect(header.get('.todo-bell-badge').text()).toBe('2')
  })
})

describe('system health and build polling', () => {
  it('does not start polling when domain initialization completes after unmount', async () => {
    const domains = deferred()
    handlers[DOMAINS] = () => domains.promise
    const analysis = mountAnalysis()
    analysis.unmount()
    domains.resolve(response([]))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(calls(STATS)).toHaveLength(0)
    expect(calls(BUILD)).toHaveLength(0)
    expect(calls(DOMAINS)[0].signal.aborted).toBe(true)
  })

  it('backs off when build status fails even if system statistics succeed', async () => {
    const defaultBuild = handlers[BUILD]
    handlers[BUILD] = () => {
      if (calls(BUILD).length === 1) throw new Error('server unavailable')
      return defaultBuild()
    }
    const analysis = mountAnalysis()
    await flushPromises()
    expect(analysis.get('.build-sync-version').text()).toBe('--')

    await vi.advanceTimersByTimeAsync(59_999)
    expect(calls(STATS)).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls(STATS)).toHaveLength(2)
    expect(analysis.get('.build-sync-version').text()).toBe('current')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(calls(BUILD)).toHaveLength(3)
  })

  it('waits for both health requests to settle before restarting a canceled cycle', async () => {
    const stats = deferred()
    const build = deferred()
    const latestBuild = deferred()
    const defaultStats = handlers[STATS]
    const defaultBuild = handlers[BUILD]
    handlers[STATS] = () => calls(STATS).length === 1 ? stats.promise : defaultStats()
    handlers[BUILD] = () => calls(BUILD).length === 1 ? build.promise : latestBuild.promise
    setHidden(true)
    const analysis = mountAnalysis()
    await flushPromises()
    expect(calls(STATS)).toHaveLength(0)
    expect(calls(BUILD)).toHaveLength(0)

    setHidden(false)
    await flushPromises()
    setHidden(true)
    setHidden(false)
    stats.resolve(defaultStats())
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls(STATS)).toHaveLength(1)
    expect(calls(BUILD)).toHaveLength(1)
    expect(calls(STATS)[0].signal.aborted).toBe(true)
    expect(calls(BUILD)[0].signal.aborted).toBe(true)

    build.resolve(buildStatus('stale'))
    await flushPromises()
    expect(calls(STATS)).toHaveLength(2)
    expect(calls(BUILD)).toHaveLength(2)
    expect(analysis.get('.build-sync-version').text()).toBe('--')

    latestBuild.resolve(defaultBuild())
    await flushPromises()
    expect(analysis.get('.build-sync-version').text()).toBe('current')
  })
})
