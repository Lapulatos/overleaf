// The database is authoritative; Redis is only an admission mirror. A failed
// mirror update leaves a durable advanced epoch and must keep the transaction
// in recovery. It must never roll the database epoch backwards.
export function createWorkspaceEpoch({ readRecord, compareAndSwap, publish, fence }) {
  async function read() {
    const record = await readRecord()
    if (!record?.enabled || !Number.isSafeInteger(record.epoch) || record.epoch < 1) {
      throw Object.assign(new Error('Workspace epoch fencing is not enabled'), { status: 409 })
    }
    return record.epoch
  }
  return {
    read,
    async hydrate() { const epoch = await read(); await publish(epoch); return epoch },
    async advance(expected) {
      if (!Number.isSafeInteger(expected) || expected < 1 || expected === Number.MAX_SAFE_INTEGER) throw new Error('Invalid workspace epoch')
      await fence(expected)
      const changed = await compareAndSwap(expected, expected + 1)
      if (!changed) throw Object.assign(new Error('Workspace epoch changed; reconcile the pending operation'), { status: 409 })
      await publish(expected + 1)
      return expected + 1
    },
  }
}
