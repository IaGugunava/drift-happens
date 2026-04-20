export const logicalRuleTypes = ['AND', 'OR', 'NOT'] as const;
export const leafRuleTypes = [
  'FIELD',
  'DATE_WITHIN',
  'DATE_OLDER',
  'IN_SEGMENT',
] as const;
export const fieldOperators = [
  'eq',
  'gt',
  'lt',
  'gte',
  'lte',
  'contains',
] as const;

export type LogicalRuleType = (typeof logicalRuleTypes)[number];
export type LeafRuleType = (typeof leafRuleTypes)[number];
export type FieldOperator = (typeof fieldOperators)[number];

export type RuleNode = CompoundRuleNode | LeafRule;

export type CompoundRuleNode = AndRuleNode | OrRuleNode | NotRuleNode;

export interface AndRuleNode {
  type: 'AND';
  children: RuleNode[];
}

export interface OrRuleNode {
  type: 'OR';
  children: RuleNode[];
}

export interface NotRuleNode {
  type: 'NOT';
  child: RuleNode;
}

export type LeafRule =
  | FieldRuleNode
  | DateWithinRuleNode
  | DateOlderRuleNode
  | InSegmentRuleNode;

export interface FieldRuleNode {
  type: 'FIELD';
  field: string;
  op: FieldOperator;
  value: unknown;
}

export interface DateWithinRuleNode {
  type: 'DATE_WITHIN';
  field: string;
  days: number;
}

export interface DateOlderRuleNode {
  type: 'DATE_OLDER';
  field: string;
  days: number;
}

export interface InSegmentRuleNode {
  type: 'IN_SEGMENT';
  segmentId: string;
}
