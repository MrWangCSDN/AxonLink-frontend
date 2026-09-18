const commonColumns = [
  ['lglpern_cd', '法人代码', 'VARCHAR(20)'],
  ['customer_no', '客户号', 'VARCHAR(32)'],
  ['acct_no', '账号', 'VARCHAR(40)'],
  ['currency_cd', '币种', 'CHAR(3)'],
  ['status_cd', '状态', 'VARCHAR(8)'],
  ['balance_amt', '余额', 'DECIMAL(20,2)'],
  ['branch_no', '机构号', 'VARCHAR(12)'],
  ['product_cd', '产品代码', 'VARCHAR(16)'],
  ['effective_dt', '生效日期', 'DATE'],
  ['expiry_dt', '失效日期', 'DATE'],
  ['created_by', '创建人', 'VARCHAR(32)'],
  ['created_at', '创建时间', 'TIMESTAMP'],
  ['updated_by', '更新人', 'VARCHAR(32)'],
  ['updated_at', '更新时间', 'TIMESTAMP'],
  ['remark', '备注', 'VARCHAR(500)'],
]

const statusCondition = columnName => ({
  connector: 'AND',
  groups: [{ connector: 'AND', conditions: [
    { columnName, operator: 'EQ', values: ['1'] },
  ] }],
})

export const mockScopeExamples = {
  fullTable: { whereCondition: null, whereConditionConfigured: false, compareLimit: null },
  conditionOnly: { whereCondition: statusCondition('status_cd'), whereConditionConfigured: true, compareLimit: null },
  limitOnly: { whereCondition: null, whereConditionConfigured: false, compareLimit: 1000 },
  conditionAndLimit: { whereCondition: statusCondition('status_cd'), whereConditionConfigured: true, compareLimit: 1000 },
  missingConditionField: {
    whereCondition: statusCondition('legacy_status'),
    whereConditionConfigured: true,
    compareLimit: null,
    metadataValidation: {
      status: 'MISSING_FIELDS',
      missingFieldNames: [],
      missingConditionFieldNames: ['legacy_status'],
    },
  },
}

const columns = (primaryName, primaryComment, extras = []) => {
  let primaryKeyOrder = 0
  return [
    [primaryName, primaryComment, 'VARCHAR(40)', true],
    ...extras,
    ...commonColumns,
  ].filter(([columnName], index, source) => source.findIndex(([candidate]) => candidate === columnName) === index)
    .map(([columnName, columnComment, dataType, primaryKey = false], index) => ({
      columnName,
      columnComment,
      dataType,
      primaryKey,
      primaryKeyOrder: primaryKey ? ++primaryKeyOrder : null,
      ordinalPosition: index + 1,
    }))
}

const columnsWithoutPrimaryKey = (extras = []) => (
  [...extras, ...commonColumns]
    .filter(([columnName], index, source) => source.findIndex(([candidate]) => candidate === columnName) === index)
    .map(([columnName, columnComment, dataType], index) => ({
      columnName,
      columnComment,
      dataType,
      primaryKey: false,
      primaryKeyOrder: null,
      ordinalPosition: index + 1,
    }))
)

export const mockTableCatalog = [
  {
    schemaName: 'CCBS_BASE',
    tableName: 'kdpa_cb_acct_fzn_cntl_inf',
    tableComment: '对公存款账户冻结控制信息',
    columns: columns('fzn_cntl_id', '冻结控制编号', [
      ['fzn_new_pk', '新增联合主键', 'VARCHAR(40)', true],
      ['fzn_cntl_amt', '冻结金额', 'DECIMAL(20,2)'],
      ['fzn_reason_cd', '冻结原因代码', 'VARCHAR(8)'],
      ['fzn_status', '冻结状态', 'VARCHAR(8)'],
      ['acct_status', '账户状态', 'VARCHAR(8)'],
    ]),
  },
  {
    schemaName: 'CCBS_BASE',
    tableName: 'kdpa_cb_customer_ext_info',
    tableComment: '对公客户扩展信息',
    columns: columns('customer_no', '客户号', [
      ['customer_type', '客户类型', 'VARCHAR(8)'],
      ['credit_level', '信用等级', 'VARCHAR(8)'],
    ]),
  },
  {
    schemaName: 'CCBS_BASE',
    tableName: 'klna_ln_acct_base_info',
    tableComment: '贷款账户基础信息',
    columns: columns('loan_acct_no', '贷款账号', [
      ['loan_contract_no', '贷款合同号', 'VARCHAR(40)'],
      ['loan_amt', '贷款金额', 'DECIMAL(20,2)'],
    ]),
  },
  {
    schemaName: 'CCBS_BASE',
    tableName: 'ksta_stl_txn_detail',
    tableComment: '结算交易明细',
    columns: columns('txn_sn', '交易流水号', [
      ['global_txn_sn', '全局流水号', 'VARCHAR(64)'],
      ['txn_amt', '交易金额', 'DECIMAL(20,2)'],
    ]),
  },
  {
    schemaName: 'CCBS_BASE',
    tableName: 'kpba_pb_product_parameter',
    tableComment: '公共产品参数',
    columns: columns('parameter_id', '参数编号', [
      ['parameter_name', '参数名称', 'VARCHAR(128)'],
      ['parameter_value', '参数值', 'VARCHAR(1000)'],
    ]),
  },
  {
    schemaName: 'CCBS_BASE',
    tableName: 'kdpl_cb_acct_fzn_cntl_oprn_detl',
    tableComment: '对公存款账户冻结控制操作明细',
    columns: columns('fzn_cntl_oprn_sn', '冻结操作序号', [
      ['fzn_cntl_id', '冻结控制编号', 'VARCHAR(40)'],
      ['txn_dt', '交易日期', 'DATE'],
      ['cncl_fzn_dectrl_amt', '取消冻结金额', 'DECIMAL(20,2)'],
      ['operator_id', '操作员编号', 'VARCHAR(32)'],
    ]),
  },
  {
    schemaName: 'CCBS_BASE',
    tableName: 'no_primary_key_new',
    tableComment: '无主键新增登记测试表',
    columns: columnsWithoutPrimaryKey([
      ['business_id', '业务编号', 'VARCHAR(40)'],
      ['business_status', '业务状态', 'VARCHAR(8)'],
    ]),
  },
  {
    schemaName: 'CCBS_BASE',
    tableName: 'no_primary_key_registered',
    tableComment: '主键已被删除的登记测试表',
    columns: columnsWithoutPrimaryKey([
      ['historical_key', '历史主键字段', 'VARCHAR(40)'],
      ['compare_status', '比对状态', 'VARCHAR(8)'],
    ]),
  },
]

export const searchMockTables = (keyword, registrations = []) => {
  const normalizedKeyword = keyword?.trim().toLocaleLowerCase()
  if (!normalizedKeyword) return []

  return mockTableCatalog
    .filter(table => `${table.tableName} ${table.tableComment}`.toLocaleLowerCase().includes(normalizedKeyword))
    .map(({ columns: ignoredColumns, ...table }) => {
      const registration = registrations.find(item => item.tableName === table.tableName)
      return {
        ...table,
        registrationStatus: registration ? 'ACTIVE' : 'UNREGISTERED',
        registrationId: registration?.id ?? null,
        registrationVersion: registration?.version ?? null,
      }
    })
}

export const getMockColumns = tableName => (
  mockTableCatalog.find(table => table.tableName === tableName)?.columns.map(column => ({ ...column })) || []
)
