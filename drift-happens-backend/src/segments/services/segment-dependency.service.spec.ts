import { Types } from 'mongoose';
import { SegmentDependencyService } from './segment-dependency.service';

describe('SegmentDependencyService', () => {
  it('rebuilds reverse dependency sets and syncs dependsOnSegments', async () => {
    const vipClientsId = new Types.ObjectId();
    const riskGroupId = new Types.ObjectId();
    const vipAtRiskId = new Types.ObjectId();
    const segmentModel = createSegmentModelMock([
      {
        _id: vipClientsId,
        name: 'VIP Clients',
        rules: {
          type: 'FIELD',
          field: 'totalSpent',
          op: 'gte',
          value: 5000,
        },
        dependsOnSegments: [],
      },
      {
        _id: riskGroupId,
        name: 'Risk Group',
        rules: {
          type: 'FIELD',
          field: 'totalSpent',
          op: 'gt',
          value: 0,
        },
        dependsOnSegments: [],
      },
      {
        _id: vipAtRiskId,
        name: 'VIP at Risk',
        rules: {
          type: 'AND',
          children: [
            {
              type: 'IN_SEGMENT',
              segmentId: 'VIP Clients',
            },
            {
              type: 'IN_SEGMENT',
              segmentId: riskGroupId.toString(),
            },
          ],
        },
        dependsOnSegments: [],
      },
    ]);
    const redisService = createRedisServiceMock();
    const service = new SegmentDependencyService(segmentModel as never, redisService as never);

    await service.rebuildDependencyGraph();

    expect(segmentModel.updateOne).toHaveBeenCalledTimes(1);
    expect(segmentModel.updateOne).toHaveBeenCalledWith(
      { _id: vipAtRiskId },
      {
        $set: {
          dependsOnSegments: [
            expect.any(Types.ObjectId),
            expect.any(Types.ObjectId),
          ],
        },
      },
    );
    expect(redisService.deleteKeysByPattern).toHaveBeenCalledWith('segment:dependents:*');
    expect(redisService.replaceSetMembers).toHaveBeenCalledWith(
      `segment:dependents:${vipClientsId.toString()}`,
      [vipAtRiskId.toString()],
    );
    expect(redisService.replaceSetMembers).toHaveBeenCalledWith(
      `segment:dependents:${riskGroupId.toString()}`,
      [vipAtRiskId.toString()],
    );
  });

  it('reads dependents from Redis by segment id', async () => {
    const redisService = createRedisServiceMock({
      setMembersByKey: {
        'segment:dependents:segment-1': ['segment-2', 'segment-3'],
      },
    });
    const service = new SegmentDependencyService(
      createSegmentModelMock([]) as never,
      redisService as never,
    );

    await expect(service.getDependentSegmentIds('segment-1')).resolves.toEqual([
      'segment-2',
      'segment-3',
    ]);
  });
});

function createSegmentModelMock(segments: unknown[]) {
  return {
    find: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(segments),
    })),
    updateOne: jest.fn(() => ({
      exec: jest.fn().mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1,
      }),
    })),
  };
}

function createRedisServiceMock(options?: {
  setMembersByKey?: Record<string, string[]>;
}) {
  const setMembersByKey = options?.setMembersByKey ?? {};

  return {
    deleteKeysByPattern: jest.fn(async () => undefined),
    replaceSetMembers: jest.fn(async () => undefined),
    getSetMembers: jest.fn(async (key: string) => setMembersByKey[key] ?? []),
  };
}
