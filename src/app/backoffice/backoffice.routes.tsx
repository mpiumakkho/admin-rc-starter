import { redirect, type RouteObject } from 'react-router';

/** Back to the work overview, the back office's first page */
const toOverview = { loader: () => redirect('/backoffice/home/overview'), Component: () => null };

/** The back office's pages, under /backoffice, by the spec's menu groups (shell/nav.ts); its code loads when first opened */
export const BACKOFFICE_ROUTES: RouteObject[] = [
  {
    lazy: async () => ({ Component: (await import('./shell/backoffice-shell')).BackofficeShellComponent }),
    children: [
      { index: true as const, ...toOverview },
      { path: 'home', ...toOverview },
      { path: 'home/overview', lazy: async () => ({ Component: (await import('./pages/home/overview')).OverviewComponent }) },
      { path: 'home/approvals', lazy: async () => ({ Component: (await import('./pages/home/approvals')).ApprovalsComponent }) },
      { path: 'home/alerts', lazy: async () => ({ Component: (await import('./pages/home/alerts')).AlertsComponent }) },
      { path: 'home/activity', lazy: async () => ({ Component: (await import('./pages/home/activity')).ActivityComponent }) },
      { path: 'finance', loader: () => redirect('/backoffice/finance/overview'), Component: () => null },
      { path: 'finance/overview', lazy: async () => ({ Component: (await import('./pages/finance/finance-overview')).FinanceOverviewComponent }) },
      { path: 'finance/invoices', lazy: async () => ({ Component: (await import('./pages/finance/invoices')).InvoicesComponent }) },
      { path: 'finance/invoices/:id', lazy: async () => ({ Component: (await import('./pages/finance/invoice-detail')).InvoiceDetailComponent }) },
      { path: 'finance/payments', lazy: async () => ({ Component: (await import('./pages/finance/payments')).PaymentsComponent }) },
      { path: 'finance/adjustments', lazy: async () => ({ Component: (await import('./pages/finance/adjustments')).AdjustmentsComponent }) },
      { path: 'finance/receivables', lazy: async () => ({ Component: (await import('./pages/finance/receivables')).ReceivablesComponent }) },
      { path: 'finance/reconciliation', lazy: async () => ({ Component: (await import('./pages/finance/reconciliation')).ReconciliationComponent }) },
      { path: 'finance/exports', lazy: async () => ({ Component: (await import('./pages/finance/exports')).ExportsComponent }) },
      { path: 'inventory', loader: () => redirect('/backoffice/inventory/overview'), Component: () => null },
      { path: 'inventory/overview', lazy: async () => ({ Component: (await import('./pages/inventory/inventory-overview')).InventoryOverviewComponent }) },
      { path: 'inventory/stock', lazy: async () => ({ Component: (await import('./pages/inventory/stock')).StockComponent }) },
      { path: 'inventory/items/:id', lazy: async () => ({ Component: (await import('./pages/inventory/item-detail')).ItemDetailComponent }) },
      { path: 'inventory/lots', lazy: async () => ({ Component: (await import('./pages/inventory/lots')).LotsComponent }) },
      { path: 'inventory/receipts', lazy: async () => ({ Component: (await import('./pages/inventory/receipts')).ReceiptsComponent }) },
      { path: 'inventory/dispenses', lazy: async () => ({ Component: (await import('./pages/inventory/dispenses')).DispensesComponent }) },
      { path: 'inventory/reorder', lazy: async () => ({ Component: (await import('./pages/inventory/reorder')).ReorderComponent }) },
      { path: 'inventory/controlled', lazy: async () => ({ Component: (await import('./pages/inventory/controlled')).ControlledComponent }) },
      { path: 'inventory/recall', lazy: async () => ({ Component: (await import('./pages/inventory/recall')).RecallComponent }) },
      { path: 'sales', loader: () => redirect('/backoffice/sales/overview'), Component: () => null },
      { path: 'sales/overview', lazy: async () => ({ Component: (await import('./pages/sales/revenue-overview')).RevenueOverviewComponent }) },
      { path: 'sales/line', lazy: async () => ({ Component: (await import('./pages/sales/line-crm')).LineCrmComponent }) },
      { path: 'sales/claims', lazy: async () => ({ Component: (await import('./pages/sales/claims')).ClaimsComponent }) },
      { path: '*', ...toOverview },
    ],
  },
];
