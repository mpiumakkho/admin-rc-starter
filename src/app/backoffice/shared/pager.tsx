/* A table's pages, as the admin's tables have them: so many rows a page, the range shown and the way to the others */
import { UiPagination } from '../../user-management/ui';
import { useBoI18n } from '../i18n/bo-i18n';
import { PAGE_SIZES, type Pager } from './use-pager';

/** The foot of a table: the rows shown of how many, rows a page, and the pages */
export function PagerFoot<T>({ pager }: { pager: Pager<T> }) {
  const { tx } = useBoI18n();
  if (!pager.total) {
    return null;
  }
  return (
    <div className="table-footer">
      <span className="pager-range">{tx('แสดง {from}–{to} จาก {n} รายการ', { from: pager.from, to: pager.to, n: pager.total })}</span>
      <label className="pager-size">
        <span>{tx('แถวต่อหน้า')}</span>
        <select className="ui-input" value={pager.size} onChange={event => pager.resize(+event.target.value)}>
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <UiPagination page={pager.current} onPageChange={pager.setPage} pageCount={pager.pageCount} ariaLabel={tx('หน้าของตาราง')}
        firstLabel={tx('หน้าแรก')} previousLabel={tx('หน้าก่อน')} nextLabel={tx('หน้าถัดไป')} lastLabel={tx('หน้าสุดท้าย')} />
    </div>
  );
}
