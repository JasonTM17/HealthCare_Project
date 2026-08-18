export declare class CmsReconciliationLedger {
  constructor(initialEventId?: number);
  latestEventId: number;
  reconciliationCursor: number;
  readonly pendingEventIds: Set<number>;
  readonly pendingEventVersions: Map<number, number>;
  readonly hasPendingWork: boolean;
  observe(eventId: number): boolean;
  markPending(eventId: number, version: number): void;
  resolvePending(eventId: number): void;
  beginReconciliation(eventId: number): void;
  pendingVersionFloor(): number;
  pendingEventCursor(): number;
  acknowledgeThrough(eventId: number): boolean;
  advanceCursor(): void;
}
