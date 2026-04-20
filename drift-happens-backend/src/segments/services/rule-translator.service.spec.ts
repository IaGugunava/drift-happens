import { RuleTranslatorService } from './rule-translator.service';
import type { Segment } from '../schemas/segment.schema';

describe('RuleTranslatorService', () => {
  it('translates nested boolean and field rules into bool queries', async () => {
    const service = new RuleTranslatorService(createSegmentModelMock());

    await expect(
      service.translate({
        type: 'AND',
        children: [
          {
            type: 'DATE_WITHIN',
            field: 'lastTransactionAt',
            days: 30,
          },
          {
            type: 'FIELD',
            field: 'totalSpent',
            op: 'gte',
            value: 5000,
          },
          {
            type: 'NOT',
            child: {
              type: 'FIELD',
              field: 'email',
              op: 'contains',
              value: 'test',
            },
          },
        ],
      }),
    ).resolves.toEqual({
      bool: {
        must: [
          {
            range: {
              lastTransactionAt: {
                gte: 'now-30d/d',
              },
            },
          },
          {
            range: {
              totalSpent: {
                gte: 5000,
              },
            },
          },
          {
            bool: {
              must_not: [
                {
                  wildcard: {
                    email: {
                      value: '*test*',
                      case_insensitive: true,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });
  });

  it('resolves IN_SEGMENT rules by current memberIds', async () => {
    const service = new RuleTranslatorService(
      createSegmentModelMock({
        'VIP Clients': {
          memberIds: ['cust-1', 'cust-2'],
        },
      }),
    );

    await expect(
      service.translate({
        type: 'IN_SEGMENT',
        segmentId: 'VIP Clients',
      }),
    ).resolves.toEqual({
      terms: {
        _id: ['cust-1', 'cust-2'],
      },
    });
  });

  it('returns match_none when a referenced segment has no members', async () => {
    const service = new RuleTranslatorService(createSegmentModelMock());

    await expect(
      service.translate({
        type: 'IN_SEGMENT',
        segmentId: 'unknown-segment',
      }),
    ).resolves.toEqual({
      match_none: {},
    });
  });
});

function createSegmentModelMock(
  segmentsById: Record<string, { memberIds: string[] }> = {},
) {
  return {
    findOne: jest.fn((query: { $or?: Array<{ _id?: string | null; name?: string }> }) => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(async () => {
        const requestedName = query.$or?.find((entry) => entry.name)?.name;
        if (!requestedName) {
          return null;
        }

        const segment = segmentsById[requestedName];
        if (!segment) {
          return null;
        }

        return {
          memberIds: segment.memberIds,
        } satisfies Partial<Segment>;
      }),
    })),
  } as unknown as { findOne: RuleTranslatorService['constructor']['arguments'][0]['findOne'] };
}
