import {
  assertRuleNode,
  collectSegmentDependencies,
  isRuleNode,
  RuleNodeValidationError,
  validateRuleNode,
} from './rule-node.utils';
import { defaultSegmentNames, defaultSegments } from '../defaults/default-segments';

describe('rule-node.utils', () => {
  it('accepts nested valid rules', () => {
    const rule = {
      type: 'AND',
      children: [
        {
          type: 'FIELD',
          field: 'totalSpent',
          op: 'gte',
          value: 5000,
        },
        {
          type: 'NOT',
          child: {
            type: 'DATE_OLDER',
            field: 'lastTransactionAt',
            days: 120,
          },
        },
      ],
    };

    expect(isRuleNode(rule)).toBe(true);
    expect(() => assertRuleNode(rule)).not.toThrow();
  });

  it('rejects malformed rules with a path-aware error', () => {
    const result = validateRuleNode({
      type: 'AND',
      children: [
        {
          type: 'FIELD',
          field: 'totalSpent',
          op: 'between',
          value: 100,
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error).toBeInstanceOf(RuleNodeValidationError);
    expect(result.error.message).toContain('rule.children[0].op');
  });

  it('collects unique segment dependencies from nested rules', () => {
    const dependencies = collectSegmentDependencies({
      type: 'OR',
      children: [
        {
          type: 'IN_SEGMENT',
          segmentId: 'vip-clients-id',
        },
        {
          type: 'NOT',
          child: {
            type: 'AND',
            children: [
              {
                type: 'IN_SEGMENT',
                segmentId: 'risk-group-id',
              },
              {
                type: 'IN_SEGMENT',
                segmentId: 'vip-clients-id',
              },
            ],
          },
        },
      ],
    });

    expect(dependencies).toEqual(['vip-clients-id', 'risk-group-id']);
  });

  it('defines the required default segments with valid rules', () => {
    expect(defaultSegments).toHaveLength(5);
    expect(defaultSegments.map((segment) => segment.name)).toEqual([
      defaultSegmentNames.activeBuyers,
      defaultSegmentNames.vipClients,
      defaultSegmentNames.riskGroup,
      defaultSegmentNames.vipAtRisk,
      defaultSegmentNames.marchCampaign,
    ]);

    for (const segment of defaultSegments) {
      expect(isRuleNode(segment.rules)).toBe(true);
    }
  });
});
