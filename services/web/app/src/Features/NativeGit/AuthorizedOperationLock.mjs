// The HTTP admission check may precede a long lock wait. Revalidate access at
// lock acquisition before invoking any repository or document operation.
export function authorizedOperationLock(withLock, authorize) {
  return async action => {
    await authorize()
    return withLock(async () => {
      await authorize()
      return action()
    })
  }
}

// Reused at each document transaction checkpoint. Recheck lease after the
// database authorization lookup, which itself can outlast a lease renewal.
export function authorizedWriteLease(assertLease, authorize) {
  return async () => {
    await assertLease()
    await authorize()
    await assertLease()
  }
}
