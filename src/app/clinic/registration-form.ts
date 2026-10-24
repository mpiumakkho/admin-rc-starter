import { create } from 'zustand';

import {
  type Address, type AddressKind, type Duplicate, emptyDraft, type PetRecord, type RegistrationDraft, ROUTES,
} from './data/registration';

interface RegistrationFormState {
  draft: RegistrationDraft;
  /** The pet on file the form shows, read-only; null while a new one is being registered */
  record: PetRecord | null;
  route: string;
  /** The same animal is on file already: no new record, only the way to the one there is */
  block: (Duplicate & { field: string }) | null;
}

/**
 * What the registration tab holds. It stays while the person looks
 * at another tab, as a half-filled form at the front desk would.
 */
export const useRegistrationForm = create<RegistrationFormState>(() => ({ draft: emptyDraft(), record: null, route: ROUTES[0], block: null }));

export const registrationForm = {
  get draft(): RegistrationDraft {
    return useRegistrationForm.getState().draft;
  },

  setDraft(draft: RegistrationDraft) {
    useRegistrationForm.setState({ draft });
  },

  set<K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) {
    useRegistrationForm.setState(state => ({ draft: { ...state.draft, [key]: value } }));
  },

  setAddress(kind: AddressKind, field: keyof Address, value: string) {
    useRegistrationForm.setState(({ draft: d }) => ({ draft: { ...d, addresses: { ...d.addresses, [kind]: { ...d.addresses[kind], [field]: value } } } }));
  },

  /** The registered address as the current one */
  copyCurrent(kind: AddressKind) {
    useRegistrationForm.setState(({ draft: d }) => ({ draft: { ...d, addresses: { ...d.addresses, [kind]: { ...d.addresses.current } } } }));
  },

  setRoute(route: string) {
    useRegistrationForm.setState({ route });
  },

  setBlock(block: RegistrationFormState['block']) {
    useRegistrationForm.setState({ block });
  },

  load(record: PetRecord, draft: RegistrationDraft) {
    useRegistrationForm.setState({ record, draft, block: null });
  },

  reset() {
    useRegistrationForm.setState({ draft: emptyDraft(), record: null, block: null });
  },
};
