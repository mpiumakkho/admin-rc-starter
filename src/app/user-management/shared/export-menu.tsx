import { lucideChevronDown, lucideCopy, lucideDownload, lucideFileSpreadsheet, lucideFileText, lucidePrinter } from '../../icons';
import { NgIcon, uiToast, UiButton, UiMenu, UiMenuItem, UiMenuTrigger } from '../ui';
import { downloadBlob, downloadText, toCsv } from './csv';
import './export-menu.scss';
import { intlLocale, useFormat } from './formatting';
import { copyText, fontFiles, forFormat, printHtml, printPage, type TableExport } from './table-export';
import { toXlsx } from './xlsx';

/**
 * Export as DataTables offers it: copy to the clipboard, an Excel file, a CSV file or a printout. Every format holds
 * the rows the page shows, filtered and sorted, from all its pages.
 *
 *   <ExportMenu source={exportTable} />
 */
export function ExportMenu({ source }: { source: () => TableExport }) {
  const f = useFormat();
  const language = f.language || 'en';

  const copy = async () => {
    const table = forFormat(source(), 'copy');
    try {
      await navigator.clipboard.writeText(copyText(table, intlLocale(language)));
      uiToast.show(f.t('toast.copied', { count: table.rows.length }));
    } catch {
      uiToast.show(f.t('Could not copy to the clipboard.'), 'error');
    }
  };

  const excel = () => {
    const table = forFormat(source(), 'excel');
    const bytes = toXlsx({
      name: table.title,
      title: table.title,
      header: table.columns.map(column => column.header),
      rows: table.rows,
      dayColumns: table.columns.flatMap((column, index) => column.date === 'day' ? [index] : []),
    });
    downloadBlob(`${table.fileName}.xlsx`, new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    uiToast.show(f.t('toast.exported', { count: table.rows.length }));
  };

  const csv = () => {
    const table = source();
    downloadText(`${table.fileName}.csv`, toCsv(table.csv));
    uiToast.show(f.t('toast.exported', { count: table.rows.length }));
  };

  const print = () => {
    const table = forFormat(source(), 'print');
    const locale = intlLocale(language);
    const printed = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    printPage(document, printHtml(table, {
      locale,
      language,
      summary: f.t('printSummary', { count: table.rows.length, date: printed }),
      fonts: fontFiles(document),
    }));
  };

  // The button lines up with the others in the page header as if it stood there itself
  return (
    <app-export-menu>
      <UiMenuTrigger menu={
        <UiMenu aria-label={f.t('Export')}>
          <UiMenuItem icon={lucideCopy} onTriggered={copy}>{f.t('Copy')}</UiMenuItem>
          <UiMenuItem icon={lucideFileSpreadsheet} onTriggered={excel}>Excel</UiMenuItem>
          {/* What CSV stands for, as a tooltip and the item's description for screen readers (WCAG 3.1.4) */}
          <UiMenuItem icon={lucideFileText} title={f.t('abbr.csv')} onTriggered={csv}>CSV</UiMenuItem>
          <UiMenuItem icon={lucidePrinter} onTriggered={print}>{f.t('Print')}</UiMenuItem>
        </UiMenu>
      }>
        <UiButton variant="secondary" type="button">
          <NgIcon svg={lucideDownload} />{` ${f.t('Export')} `}<NgIcon className="export-caret" svg={lucideChevronDown} />
        </UiButton>
      </UiMenuTrigger>
    </app-export-menu>
  );
}
