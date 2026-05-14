/**
 * 影响分析：从已加载的交易链路（getFlowtranChain）聚合表/构件/服务影响图。
 * 逻辑对齐 Figma Make 中 impactUtils，数据源改为真实 relations。
 */

/** @typedef {'table'|'component'|'service'} AnalysisMode */

/** 与 TransactionCard 一致：公共/技术 vs 业务/产品 */
const TECH_PREFIXES = new Set(['pbcc', 'pbct'])
const BIZ_PREFIXES = new Set(['pbcb', 'pbcp'])

/**
 * @param {string|undefined} prefix
 * @returns {'technical'|'business'}
 */
function componentTier(prefix) {
  if (TECH_PREFIXES.has(prefix)) return 'technical'
  return 'business'
}

/**
 * 在单笔交易内，沿 componentToComponent 双向扩展，得到与「直接访问该表」的构件弱连通的所有构件（用于展示 pbcb/pbcp ↔ pbcc/pbct 调用）。
 * @param {string[]} seedCodes
 * @param {Record<string, string[]>} componentToComponent caller → callees
 * @param {Set<string>} validCodes
 */
function expandComponentClosure(seedCodes, componentToComponent, validCodes) {
  const active = new Set()
  for (const c of seedCodes) {
    if (validCodes.has(c)) active.add(c)
  }
  let changed = true
  while (changed) {
    changed = false
    for (const c of [...active]) {
      for (const t of componentToComponent[c] || []) {
        if (validCodes.has(t) && !active.has(t)) {
          active.add(t)
          changed = true
        }
      }
      for (const [caller, callees] of Object.entries(componentToComponent)) {
        if (!validCodes.has(caller)) continue
        if ((callees || []).includes(c) && !active.has(caller)) {
          active.add(caller)
          changed = true
        }
      }
    }
  }
  return active
}

/**
 * @param {object} tx
 * @param {object[]|null} domains
 * @returns {string}
 */
function txDomainKey(tx, domains) {
  if (tx.domainKey) return tx.domainKey
  if (tx.domain && domains?.length) {
    const d = domains.find((x) => x.name === tx.domain)
    if (d) return d.id
  }
  return 'public'
}

/**
 * @param {object[]} transactions
 * @param {object[]|null} domains
 */
function buildModels(transactions, domains) {
  return transactions
    .map((tx) => {
      const chain = tx.chain
      if (!chain) return null
      const rel = chain.relations || {}
      const nodeToTable = rel.nodeToTable || rel.nodeToData || rel.componentToData || {}
      const serviceToComponent = rel.serviceToComponent || {}
      const serviceToService = rel.serviceToService || {}
      const componentToComponent = rel.componentToComponent || {}
      const components = chain.component || []
      const services = chain.service || []
      const tables = Array.isArray(chain.data) ? chain.data : (chain.data?.table || [])
      const dk = txDomainKey(tx, domains)

      const componentTableMap = {}
      for (const comp of components) {
        const tabs = nodeToTable[comp.code] || []
        if (tabs.length) componentTableMap[comp.code] = tabs
      }

      return {
        txId: tx.id,
        txName: tx.name,
        txCode: tx.code || tx.id,
        domainKey: dk,
        nodeToTable,
        serviceToComponent,
        serviceToService,
        componentToComponent,
        components,
        services,
        tables,
        componentTableMap,
      }
    })
    .filter(Boolean)
}

/**
 * @param {object[]} transactions
 * @param {object[]|null} domains
 */
export function getAllTables(transactions, domains) {
  const map = new Map()
  for (const m of buildModels(transactions, domains)) {
    for (const t of m.tables) {
      const id = t.code || t.id
      if (!id || map.has(id)) continue
      map.set(id, {
        id,
        name: t.name || id,
        desc: t.desc,
        domainId: m.domainKey,
        nodeType: 'table',
      })
    }
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function getAllComponents(transactions, domains) {
  const map = new Map()
  for (const m of buildModels(transactions, domains)) {
    for (const c of m.components) {
      if (!c.code || map.has(c.code)) continue
      map.set(c.code, {
        id: c.code,
        name: c.name || c.code,
        desc: c.desc,
        domainId: m.domainKey,
        type: c.prefix,
        nodeType: 'component',
      })
    }
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function getAllServices(transactions, domains) {
  const map = new Map()
  for (const m of buildModels(transactions, domains)) {
    for (const s of m.services) {
      if (!s.code || map.has(s.code)) continue
      map.set(s.code, {
        id: s.code,
        name: s.name || s.code,
        desc: s.desc,
        domainId: m.domainKey,
        type: s.prefix,
        nodeType: 'service',
      })
    }
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function addEdge(edges, edgeSet, from, to, intra = false) {
  const key = `${from}\u2192${to}`
  if (edgeSet.has(key)) return
  edgeSet.add(key)
  const e = { from, to }
  if (intra) e.isIntraLayer = true
  edges.push(e)
}

/**
 * @param {object[]} transactions
 * @param {object[]|null} domains
 * @param {AnalysisMode} mode
 * @param {string} targetId
 */
export function analyzeImpact(transactions, domains, mode, targetId) {
  const models = buildModels(transactions, domains)
  if (mode === 'table') return analyzeTableImpact(models, targetId)
  if (mode === 'component') return analyzeComponentImpact(models, targetId)
  return analyzeServiceImpact(models, targetId)
}

function analyzeTableImpact(models, tableId) {
  let rootNode = null
  const compMap = new Map()
  const svcMap = new Map()
  const txMap = new Map()
  const edges = []
  const edgeSet = new Set()

  function putComp(comp, domainKey) {
    if (compMap.has(comp.code)) return
    compMap.set(comp.code, {
      id: comp.code,
      name: comp.name || comp.code,
      desc: comp.desc,
      domainId: domainKey,
      type: comp.prefix,
      nodeType: 'component',
      componentTier: componentTier(comp.prefix),
    })
  }

  function putSvc(svcId, m) {
    if (svcMap.has(svcId)) return
    const svc = m.services.find((s) => s.code === svcId)
    if (!svc) return
    svcMap.set(svcId, {
      id: svc.code,
      name: svc.name || svcId,
      desc: svc.desc,
      domainId: m.domainKey,
      type: svc.prefix,
      nodeType: 'service',
    })
  }

  for (const m of models) {
    const tbl = m.tables.find((t) => (t.code || t.id) === tableId)
    if (!tbl) continue

    if (!rootNode) {
      rootNode = {
        id: tableId,
        name: tbl.name || tableId,
        desc: tbl.desc,
        domainId: m.domainKey,
        nodeType: 'table',
      }
    }

    const directCompCodes = []
    for (const comp of m.components) {
      const tabs = m.componentTableMap[comp.code] || []
      if (!tabs.includes(tableId)) continue
      directCompCodes.push(comp.code)
      putComp(comp, m.domainKey)
      addEdge(edges, edgeSet, tableId, comp.code)
    }

    const validCompCodes = new Set(m.components.map((c) => c.code))
    const closure = expandComponentClosure(directCompCodes, m.componentToComponent, validCompCodes)

    for (const code of closure) {
      const comp = m.components.find((c) => c.code === code)
      if (comp) putComp(comp, m.domainKey)
    }

    /** 构件层内调用（与 Figma Make 流程图一致，层内弧线绘制） */
    for (const [caller, callees] of Object.entries(m.componentToComponent)) {
      if (!closure.has(caller)) continue
      for (const callee of callees || []) {
        if (!closure.has(callee)) continue
        addEdge(edges, edgeSet, caller, callee, true)
      }
    }

    const matchingSvcs = new Set()
    for (const svc of m.services) {
      const tabs = m.nodeToTable[svc.code] || []
      if (tabs.includes(tableId)) {
        matchingSvcs.add(svc.code)
        putSvc(svc.code, m)
        addEdge(edges, edgeSet, tableId, svc.code)
      }
    }

    for (const [svcId, compIds] of Object.entries(m.serviceToComponent)) {
      const hit = compIds.filter((c) => closure.has(c))
      if (!hit.length) continue
      matchingSvcs.add(svcId)
      putSvc(svcId, m)
      hit.forEach((compId) => addEdge(edges, edgeSet, compId, svcId))
    }

    /** 沿 serviceToService 向上补齐调用方（PCS→PBS 等），与 PermissionRole 层级一致 */
    let svcExpanded = true
    while (svcExpanded) {
      svcExpanded = false
      for (const sid of [...matchingSvcs]) {
        for (const [caller, callees] of Object.entries(m.serviceToService || {})) {
          if (matchingSvcs.has(caller)) continue
          if (!(callees || []).includes(sid)) continue
          matchingSvcs.add(caller)
          putSvc(caller, m)
          svcExpanded = true
        }
      }
    }

    /** 服务层内调用：caller → callee（与 Figma 子列层内箭头一致） */
    for (const [caller, callees] of Object.entries(m.serviceToService || {})) {
      if (!matchingSvcs.has(caller)) continue
      for (const callee of callees || []) {
        if (!matchingSvcs.has(callee)) continue
        addEdge(edges, edgeSet, caller, callee, true)
      }
    }

    if (matchingSvcs.size > 0) {
      if (!txMap.has(m.txId)) {
        txMap.set(m.txId, {
          id: m.txId,
          name: m.txName,
          code: m.txCode,
          domainId: m.domainKey,
          nodeType: 'transaction',
        })
      }
      const calleeInImpact = new Set()
      for (const [caller, list] of Object.entries(m.serviceToService || {})) {
        if (!matchingSvcs.has(caller)) continue
        for (const c of list || []) {
          if (matchingSvcs.has(c)) calleeInImpact.add(c)
        }
      }
      const roots = [...matchingSvcs].filter((s) => !calleeInImpact.has(s))
      const toTx = roots.length ? roots : [...matchingSvcs]
      toTx.forEach((svcId) => addEdge(edges, edgeSet, svcId, m.txId))
    }
  }

  if (!rootNode) return null

  /** 整列构件 / 整列服务，由 ImpactFlowDiagram 按类型拆子列（对齐 Figma Make） */
  const allComponents = [...compMap.values()].sort((a, b) => a.id.localeCompare(b.id))
  const allServices = [...svcMap.values()].sort((a, b) => a.id.localeCompare(b.id))
  const txs = [...txMap.values()]

  return {
    mode: 'table',
    root: rootNode,
    levels: [allComponents, allServices, txs],
    edges,
    stats: {
      components: allComponents.length,
      services: allServices.length,
      transactions: txs.length,
    },
  }
}

function analyzeComponentImpact(models, componentId) {
  let rootNode = null
  const svcMap = new Map()
  const txMap = new Map()
  const edges = []
  const edgeSet = new Set()

  function putSvc(svcId, m) {
    if (svcMap.has(svcId)) return
    const svc = m.services.find((s) => s.code === svcId)
    if (!svc) return
    svcMap.set(svcId, {
      id: svc.code,
      name: svc.name || svcId,
      desc: svc.desc,
      domainId: m.domainKey,
      type: svc.prefix,
      nodeType: 'service',
    })
  }

  for (const m of models) {
    const comp = m.components.find((c) => c.code === componentId)
    if (comp && !rootNode) {
      rootNode = {
        id: comp.code,
        name: comp.name || comp.code,
        desc: comp.desc,
        domainId: m.domainKey,
        type: comp.prefix,
        nodeType: 'component',
      }
    }

    const matchingSvcs = new Set()
    for (const [svcId, compIds] of Object.entries(m.serviceToComponent)) {
      if (!compIds.includes(componentId)) continue
      matchingSvcs.add(svcId)
      putSvc(svcId, m)
      addEdge(edges, edgeSet, componentId, svcId)
    }

    let exp = true
    while (exp) {
      exp = false
      for (const sid of [...matchingSvcs]) {
        for (const [caller, callees] of Object.entries(m.serviceToService || {})) {
          if (matchingSvcs.has(caller)) continue
          if (!(callees || []).includes(sid)) continue
          matchingSvcs.add(caller)
          putSvc(caller, m)
          exp = true
        }
      }
    }

    for (const [caller, callees] of Object.entries(m.serviceToService || {})) {
      if (!matchingSvcs.has(caller)) continue
      for (const callee of callees || []) {
        if (!matchingSvcs.has(callee)) continue
        addEdge(edges, edgeSet, caller, callee, true)
      }
    }

    if (matchingSvcs.size > 0) {
      if (!txMap.has(m.txId)) {
        txMap.set(m.txId, {
          id: m.txId,
          name: m.txName,
          code: m.txCode,
          domainId: m.domainKey,
          nodeType: 'transaction',
        })
      }
      const calleeInImpact = new Set()
      for (const [caller, list] of Object.entries(m.serviceToService || {})) {
        if (!matchingSvcs.has(caller)) continue
        for (const c of list || []) {
          if (matchingSvcs.has(c)) calleeInImpact.add(c)
        }
      }
      const roots = [...matchingSvcs].filter((s) => !calleeInImpact.has(s))
      const toTx = roots.length ? roots : [...matchingSvcs]
      toTx.forEach((svcId) => addEdge(edges, edgeSet, svcId, m.txId))
    }
  }

  if (!rootNode) return null
  const services = [...svcMap.values()].sort((a, b) => a.id.localeCompare(b.id))
  const txs = [...txMap.values()]
  return {
    mode: 'component',
    root: rootNode,
    levels: [services, txs],
    edges,
    stats: { services: services.length, transactions: txs.length },
  }
}

function analyzeServiceImpact(models, serviceId) {
  let rootNode = null
  const txMap = new Map()
  const edges = []
  const edgeSet = new Set()

  for (const m of models) {
    const svc = m.services.find((s) => s.code === serviceId)
    if (!svc) continue
    if (!rootNode) {
      rootNode = {
        id: svc.code,
        name: svc.name || svc.code,
        desc: svc.desc,
        domainId: m.domainKey,
        type: svc.prefix,
        nodeType: 'service',
      }
    }
    if (!txMap.has(m.txId)) {
      txMap.set(m.txId, {
        id: m.txId,
        name: m.txName,
        code: m.txCode,
        domainId: m.domainKey,
        nodeType: 'transaction',
      })
    }
    addEdge(edges, edgeSet, serviceId, m.txId)
  }

  if (!rootNode) return null
  const txs = [...txMap.values()]
  return {
    mode: 'service',
    root: rootNode,
    levels: [txs],
    edges,
    stats: { transactions: txs.length },
  }
}
