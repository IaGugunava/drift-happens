export type SegmentDeltaEventTrigger = 'data_change' | 'cascade' | 'manual';

export interface SegmentDeltaEvent {
  segmentId: string;
  segmentName: string;
  evaluatedAt: string;
  added: string[];
  removed: string[];
  addedCount: number;
  removedCount: number;
  totalCount: number;
  triggeredBy: SegmentDeltaEventTrigger;
}
