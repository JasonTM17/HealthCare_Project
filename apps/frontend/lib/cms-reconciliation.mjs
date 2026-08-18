/**
 * Keeps the public CMS cursor at the highest contiguous event that has either
 * been observed and resolved or been covered by an authoritative snapshot.
 *
 * This is deliberately framework-free so ordering and overlapping-request
 * invariants can be exercised without mounting React or opening a browser.
 */
export class CmsReconciliationLedger {
  constructor(initialEventId = 0) {
    this.latestEventId = initialEventId;
    this.reconciliationCursor = 0;
    this._seenEventIds = new Set();
    this._pendingEventIds = new Set();
    this._pendingEventVersions = new Map();
  }

  get pendingEventIds() {
    return this._pendingEventIds;
  }

  get pendingEventVersions() {
    return this._pendingEventVersions;
  }

  get hasPendingWork() {
    return this._pendingEventIds.size > 0 || this.reconciliationCursor > 0;
  }

  observe(eventId) {
    if (eventId <= this.latestEventId || this._seenEventIds.has(eventId)) return false;
    this._seenEventIds.add(eventId);
    return eventId > this.latestEventId + 1;
  }

  markPending(eventId, version) {
    this._pendingEventIds.add(eventId);
    this._pendingEventVersions.set(eventId, version);
  }

  resolvePending(eventId) {
    this._pendingEventIds.delete(eventId);
    this._pendingEventVersions.delete(eventId);
    this.advanceCursor();
  }

  beginReconciliation(eventId) {
    this.reconciliationCursor = Math.max(this.reconciliationCursor, eventId);
  }

  pendingVersionFloor() {
    return Math.max(0, ...this._pendingEventVersions.values());
  }

  pendingEventCursor() {
    const pendingCursor = this._pendingEventIds.size === 0
      ? 0
      : Math.max(...this._pendingEventIds);
    return Math.max(this.latestEventId, this.reconciliationCursor, pendingCursor);
  }

  /**
   * A snapshot requested for eventId is authoritative only when no newer
   * reconciliation target exists. Older overlapping requests must not clear
   * newer pending work or stop its polling loop.
   */
  acknowledgeThrough(eventId) {
    if (this.reconciliationCursor > eventId) return false;

    this.latestEventId = Math.max(this.latestEventId, eventId);
    this.reconciliationCursor = 0;
    for (const seenEventId of this._seenEventIds) {
      if (seenEventId <= eventId) this._seenEventIds.delete(seenEventId);
    }
    for (const pendingEventId of this._pendingEventIds) {
      if (pendingEventId <= eventId) {
        this._pendingEventIds.delete(pendingEventId);
        this._pendingEventVersions.delete(pendingEventId);
      }
    }
    this.advanceCursor();
    return true;
  }

  advanceCursor() {
    if (this.reconciliationCursor > 0) return;
    while (
      this._seenEventIds.has(this.latestEventId + 1)
      && !this._pendingEventIds.has(this.latestEventId + 1)
    ) {
      this._seenEventIds.delete(this.latestEventId + 1);
      this.latestEventId += 1;
    }
  }
}
