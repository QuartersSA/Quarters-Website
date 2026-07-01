const createKey = (...prefix) => (...parts) => [...prefix, ...parts];

export const queryKeys = Object.freeze({
  accountingBeneficiaries: createKey("accounting_beneficiaries"),
  accountingContacts: createKey("accounting_contacts"),
  accountingDashboardPayrollRuns: createKey(
    "accountingDashboard",
    "payrollRuns",
  ),
  accountingDashboardShiftClosings: createKey(
    "accountingDashboard",
    "shiftClosings",
  ),
  accountingExpenses: createKey("accounting_expenses"),
  accountingExpenseTrend: createKey("accounting-expenses-trend"),
  accountingExpenseTypes: createKey("accounting_expense_types"),
  accountingExpenseTypesFull: createKey("accounting_expense_types_full"),
  accountingFixedExpenses: createKey("accounting_fixed_expenses"),
  accountingGreenBeanOrders: createKey("accounting", "greenBeanOrders"),
  accountingGreenBeans: createKey("accounting", "greenBeans"),
  accountingBankAccounts: createKey("accounting_bank_accounts"),
  accountingPurchaseInvoices: createKey("accounting_purchase_invoices"),
  accountingLoanEmployees: createKey("accounting_loan_employees"),
  accountingPayroll: createKey("accounting_payroll"),
  accountingPayrollBonusEmployees: createKey(
    "accounting_payroll_bonus_employees",
  ),
  accountingPayrollBonuses: createKey("accounting_payroll_bonuses"),
  accountingVariableTemplates: createKey("accounting_variable_templates"),
  accountingWaste: createKey("accounting-waste"),
  accountingWasteBranches: createKey("accounting-waste-branches"),
  branchStockAt: createKey("branch-stock-at"),
  branches: createKey("branches"),
  branchesForDeposit: createKey("branches-for-deposit"),
  cashCalculatorBranches: createKey("cashCalcBranches"),
  cashCount: createKey("cashCount"),
  dashboardAnalytics: createKey("dashboard-analytics"),
  employeeLoans: createKey("accounting_employee_loans"),
  employees: createKey("employees"),
  greenBeans: createKey("green-beans"),
  hrBonusEmployees: createKey("hr-bonuses-employees"),
  hrBonuses: createKey("hr-bonuses"),
  hrDeductionEmployees: createKey("hr-deductions-employees"),
  hrDeductions: createKey("hr-deductions"),
  hrEmployeeLogs: createKey("hr-employee-logs"),
  hrEmployees: createKey("hr-employees"),
  hrEmployeeSuspensions: createKey("hr_employee_suspensions"),
  hrOvertime: createKey("hr_overtime"),
  inventoryOperations: createKey("inventory-operations"),
  itemAnalysis: createKey("item-analysis"),
  itemCategories: createKey("item-categories"),
  itemHistory: createKey("item-history"),
  itemTimeline: createKey("item-timeline"),
  items: createKey("items"),
  itemsSummary: createKey("items-summary"),
  lowStock: createKey("low-stock-items"),
  marketingBlogger: createKey("marketing-blogger"),
  marketingBloggers: createKey("marketing-bloggers"),
  marketingMenu: createKey("marketing-menu"),
  marketingSettings: createKey("marketing-settings"),
  measurementUnits: createKey("measurement-units"),
  openingSessions: createKey("opening-sessions"),
  operationDetails: createKey("operation-details"),
  overStock: createKey("over-stock"),
  publicWelcome: createKey("public-welcome"),
  publicWelcomePreview: createKey("public-welcome-preview"),
  purchaseItemCategories: createKey("purchases_item_categories"),
  purchaseItems: createKey("purchases_items"),
  purchaseReceipts: createKey("purchase-receipts"),
  shiftCloseBranches: createKey("allBranchesForShiftClose"),
  shiftClosings: createKey("shiftClosings_admin"),
  stockValue: createKey("stock-value"),
  variance: createKey("variance"),
  wasteItems: createKey("waste-items"),
  workspaceMessages: createKey("workspaceMessages"),
  workspaceOverdueTasks: createKey("workspaceOverdueTasks"),
  workspaceSpaces: createKey("workspaceSpaces"),
  workspaceSubtasks: createKey("workspaceSubtasks"),
  workspaceSummary: createKey("workspaceSummary"),
  workspaceTaskAttachments: createKey("workspaceTaskAttachments"),
  workspaceTaskChecklist: createKey("workspaceTaskChecklist"),
  workspaceTaskHistory: createKey("workspaceTaskHistory"),
  workspaceTaskUpdates: createKey("workspaceTaskUpdates"),
  workspaceTasks: createKey("workspaceTasks"),
  workspaceTemplates: createKey("workspaceTemplates"),
  workspaceThreads: createKey("workspaceThreads"),
  workspaceUsers: createKey("workspaceUsers"),
});

function invalidateGroup(queryClient, keys) {
  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

const inventoryInvalidationKeys = [
  queryKeys.inventoryOperations(),
  queryKeys.items(),
  queryKeys.itemsSummary(),
  queryKeys.lowStock(),
  ["low-stock"], // Compatibility with the legacy dashboard cache prefix.
  queryKeys.overStock(),
  queryKeys.stockValue(),
  queryKeys.variance(),
  queryKeys.dashboardAnalytics(),
  queryKeys.operationDetails(),
  queryKeys.itemTimeline(),
  queryKeys.purchaseReceipts(),
  queryKeys.openingSessions(),
];

export function invalidateInventoryQueries(queryClient) {
  return invalidateGroup(queryClient, inventoryInvalidationKeys);
}

export function invalidateEmployeeDirectoryQueries(queryClient) {
  return invalidateGroup(queryClient, [
    queryKeys.employees(),
    queryKeys.hrEmployees(),
    queryKeys.hrEmployeeLogs(),
    queryKeys.accountingPayroll(),
    queryKeys.accountingPayrollBonusEmployees(),
    queryKeys.accountingLoanEmployees(),
    queryKeys.hrBonusEmployees(),
    queryKeys.hrDeductionEmployees(),
  ]);
}

export function invalidatePayrollQueries(queryClient) {
  return invalidateGroup(queryClient, [
    queryKeys.accountingPayroll(),
    queryKeys.employeeLoans(),
    queryKeys.accountingPayrollBonuses(),
    queryKeys.hrOvertime(),
    queryKeys.hrEmployeeSuspensions(),
  ]);
}

export function invalidateExpenseQueries(queryClient) {
  return invalidateGroup(queryClient, [
    queryKeys.accountingExpenses(),
    queryKeys.accountingExpenseTrend(),
    queryKeys.accountingFixedExpenses(),
  ]);
}

export function invalidateWorkspaceTaskQueries(queryClient) {
  return invalidateGroup(queryClient, [
    queryKeys.workspaceTasks(),
    queryKeys.workspaceSummary(),
    queryKeys.workspaceOverdueTasks(),
    queryKeys.workspaceTaskUpdates(),
    queryKeys.workspaceTaskHistory(),
    queryKeys.workspaceTaskAttachments(),
    queryKeys.workspaceTaskChecklist(),
    queryKeys.workspaceSubtasks(),
  ]);
}
