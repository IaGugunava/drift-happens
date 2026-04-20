export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CustomerTransaction {
  amount: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  totalSpent: number;
  lastTransactionAt: string | null;
  tags: string[];
  createdAt: string;
  transactions?: CustomerTransaction[];
}

export interface Segment {
  id: string;
  name: string;
  type: 'dynamic' | 'static';
  rules: RuleNode;
  memberIds: string[];
  memberCount: number;
  frozenAt: string | null;
  lastEvaluatedAt: string | null;
  dependsOnSegments: string[];
}

export interface SegmentEventRecord {
  id: string;
  segmentId: string;
  evaluatedAt: string;
  addedIds: string[];
  removedIds: string[];
  addedCount: number;
  removedCount: number;
  totalCount: number;
  triggeredBy: 'data_change' | 'cascade' | 'manual';
}

export interface SegmentDeltaEvent {
  segmentId: string;
  segmentName: string;
  evaluatedAt: string;
  added: string[];
  removed: string[];
  addedCount: number;
  removedCount: number;
  totalCount: number;
  triggeredBy: 'data_change' | 'cascade' | 'manual';
}

export interface CampaignLogEntry {
  id: string;
  segmentId: string;
  segmentName: string;
  evaluatedAt: string;
  added: string[];
  removed: string[];
  addedCount: number;
  removedCount: number;
  totalCount: number;
  message: string;
}

export type RuleNode =
  | { type: 'AND'; children: RuleNode[] }
  | { type: 'OR'; children: RuleNode[] }
  | { type: 'NOT'; child: RuleNode }
  | {
      type: 'FIELD';
      field: string;
      op: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
      value: unknown;
    }
  | { type: 'DATE_WITHIN'; field: string; days: number }
  | { type: 'DATE_OLDER'; field: string; days: number }
  | { type: 'IN_SEGMENT'; segmentId: string };
