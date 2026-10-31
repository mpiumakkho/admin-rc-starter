import { create } from 'zustand';

import { clinicStore, useClinicStore } from '../clinic/clinic.store';
import { NOW, TODAY } from '../clinic/data/model';
import { session } from '../user-management/access/session';
import { fullName } from '../user-management/data/models';
import { approvalAging, severityCounts, worklist } from './data/home';
import { createBackofficeSeed } from './data/seed';
import type { ActivityEntry, Approval, BackofficeData, BoException, Module } from './data/types';

/** Who works in the back office when nobody is signed in, as in tests: the finance manager the sample is drawn for */
const SAMPLE_USER = 'วรรณา (ผู้จัดการการเงิน)';

/** Goes up on every change, so the components that follow the back office draw again */
const useBackofficeVersion = create<{ version: number }>(() => ({ version: 0 }));

/**
 * The back office's sample data and what its pages do with it. The clinic's records (bills, stock) are read from the
 * clinic's own store, so what is done there shows here at once; the back office's own records (approvals, exceptions,
 * its audit) change in place, and every change tells the components that use the store (useBackofficeStore).
 */
export class BackofficeStore {
  data: BackofficeData = createBackofficeSeed();
  readonly clinic = clinicStore;

  get userName(): string {
    const me = session.view.user;
    return me ? fullName(me) : SAMPLE_USER;
  }

  /** Everything that waits, across the modules */
  get worklist() {
    return worklist(this.data, this.clinic.data);
  }

  get pendingApprovals(): Approval[] {
    return this.data.approvals.filter(a => a.status === 'pending');
  }

  get openExceptions(): BoException[] {
    return this.data.exceptions.filter(x => !x.acknowledgedAt);
  }

  /** Counts for the menu and the bell */
  get counts() {
    return {
      overview: this.worklist.length,
      approvals: approvalAging(this.data.approvals).pending,
      alerts: this.openExceptions.length,
      critical: severityCounts(this.data.exceptions).critical,
    };
  }

  private changed() {
    useBackofficeVersion.setState(state => ({ version: state.version + 1 }));
  }

  mutate(change: (data: BackofficeData) => void) {
    change(this.data);
    this.changed();
  }

  reset() {
    this.data = createBackofficeSeed();
    this.changed();
  }

  /** A decision on a request, with why; it goes into the back office's audit */
  decide(a: Approval, status: 'approved' | 'rejected', decision: string) {
    this.mutate(d => {
      a.status = status;
      a.decidedBy = this.userName;
      a.decidedAt = `${TODAY} ${NOW}`;
      a.decision = decision;
      this.log(d, a.module, status === 'approved' ? 'อนุมัติคำขอ' : 'ปฏิเสธคำขอ', a.ref, a.title, decision, 'รออนุมัติ', status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ');
    });
  }

  /** Seen, and what was done about it or where it went; the exception is settled in its own workflow */
  acknowledge(x: BoException, note: string) {
    this.mutate(d => {
      x.acknowledgedBy = this.userName;
      x.acknowledgedAt = `${TODAY} ${NOW}`;
      x.note = note || undefined;
      this.log(d, x.module, 'รับทราบข้อยกเว้น', x.ref, x.title, note);
    });
  }

  private log(d: BackofficeData, module: Module, action: string, target: string, ref: string, detail?: string, before?: string, after?: string) {
    const entry: ActivityEntry = {
      id: 'A' + (d.activity.length + 1), at: `${TODAY} ${NOW}`, by: this.userName, module, action, target, ref, detail: detail || undefined, before, after,
    };
    d.activity.unshift(entry);
  }
}

export const backofficeStore = new BackofficeStore();

/** The back office's store in a component, which draws again whenever its records or the clinic's change */
export function useBackofficeStore(): BackofficeStore {
  useBackofficeVersion(state => state.version);
  useClinicStore();
  return backofficeStore;
}
