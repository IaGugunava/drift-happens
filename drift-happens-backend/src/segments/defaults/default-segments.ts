import type { RuleNode } from '../types/rule-node.type';

export interface DefaultSegmentDefinition {
  name: string;
  type: 'dynamic' | 'static';
  rules: RuleNode;
}

export const defaultSegmentNames = {
  activeBuyers: 'Active Buyers',
  vipClients: 'VIP Clients',
  riskGroup: 'Risk Group',
  vipAtRisk: 'VIP at Risk',
  marchCampaign: 'March Campaign',
} as const;

export const defaultSegments: DefaultSegmentDefinition[] = [
  {
    name: defaultSegmentNames.activeBuyers,
    type: 'dynamic',
    rules: {
      type: 'DATE_WITHIN',
      field: 'lastTransactionAt',
      days: 30,
    },
  },
  {
    name: defaultSegmentNames.vipClients,
    type: 'dynamic',
    rules: {
      type: 'FIELD',
      field: 'totalSpent',
      op: 'gte',
      value: 5000,
    },
  },
  {
    name: defaultSegmentNames.riskGroup,
    type: 'dynamic',
    rules: {
      type: 'AND',
      children: [
        {
          type: 'DATE_OLDER',
          field: 'lastTransactionAt',
          days: 90,
        },
        {
          type: 'FIELD',
          field: 'totalSpent',
          op: 'gt',
          value: 0,
        },
      ],
    },
  },
  {
    name: defaultSegmentNames.vipAtRisk,
    type: 'dynamic',
    rules: {
      type: 'AND',
      children: [
        {
          type: 'IN_SEGMENT',
          segmentId: defaultSegmentNames.vipClients,
        },
        {
          type: 'IN_SEGMENT',
          segmentId: defaultSegmentNames.riskGroup,
        },
      ],
    },
  },
  {
    name: defaultSegmentNames.marchCampaign,
    type: 'static',
    rules: {
      type: 'DATE_WITHIN',
      field: 'createdAt',
      days: 31,
    },
  },
];
