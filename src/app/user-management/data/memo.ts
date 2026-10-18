/**
 * A value worked out from a store's state that is worked out again only when what it reads changes, as Angular's
 * computed(): `inputs` picks what it reads (compared by identity), `compute` works it out from them.
 *
 *   const selectUsersById = memoSelector((state: AdminState) => [state.users], users => new Map(users.map(user => [user.id, user])));
 *   selectUsersById(store.getState());          // anywhere
 *   useAdminStore(selectUsersById);              // in a component
 */
export function memoSelector<S, const I extends readonly unknown[], R>(inputs: (state: S) => I, compute: (...values: I) => R): (state: S) => R {
  let last: I | undefined;
  let result: R;
  return state => {
    const values = inputs(state);
    if (!last || values.length !== last.length || values.some((value, index) => !Object.is(value, last![index]))) {
      last = values;
      result = compute(...values);
    }
    return result;
  };
}
