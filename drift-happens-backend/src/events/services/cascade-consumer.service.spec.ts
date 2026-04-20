import type { ConsumeMessage } from 'amqplib';
import { CascadeConsumerService } from './cascade-consumer.service';

describe('CascadeConsumerService', () => {
  it('re-evaluates dependent segments as cascade updates', async () => {
    const segmentDependencyService = {
      getDependentSegmentIds: jest.fn().mockResolvedValue(['segment-2', 'segment-3']),
    };
    const segmentEvaluatorService = {
      evaluateSegment: jest.fn().mockResolvedValue(null),
    };
    const service = new CascadeConsumerService(
      { consume: jest.fn() } as never,
      segmentDependencyService as never,
      segmentEvaluatorService as never,
    );

    await service.handleMessage(
      createMessage(
        {
          segmentId: 'segment-1',
          segmentName: 'VIP Clients',
          evaluatedAt: '2026-04-17T10:00:00.000Z',
          added: ['customer-1'],
          removed: [],
          addedCount: 1,
          removedCount: 0,
          totalCount: 1,
          triggeredBy: 'data_change',
        },
        {
          'x-cascade-depth': 1,
          'x-visited-segment-ids': JSON.stringify(['segment-1']),
        },
      ),
    );

    expect(segmentDependencyService.getDependentSegmentIds).toHaveBeenCalledWith('segment-1');
    expect(segmentEvaluatorService.evaluateSegment).toHaveBeenNthCalledWith(1, 'segment-2', {
      triggeredBy: 'cascade',
      cascadeDepth: 2,
      visitedSegmentIds: ['segment-1', 'segment-2'],
    });
    expect(segmentEvaluatorService.evaluateSegment).toHaveBeenNthCalledWith(2, 'segment-3', {
      triggeredBy: 'cascade',
      cascadeDepth: 2,
      visitedSegmentIds: ['segment-1', 'segment-3'],
    });
  });

  it('skips reevaluation when the depth limit is reached', async () => {
    const segmentEvaluatorService = {
      evaluateSegment: jest.fn(),
    };
    const service = new CascadeConsumerService(
      { consume: jest.fn() } as never,
      { getDependentSegmentIds: jest.fn() } as never,
      segmentEvaluatorService as never,
    );

    await service.handleMessage(
      createMessage(
        {
          segmentId: 'segment-1',
          segmentName: 'VIP Clients',
          evaluatedAt: '2026-04-17T10:00:00.000Z',
          added: ['customer-1'],
          removed: [],
          addedCount: 1,
          removedCount: 0,
          totalCount: 1,
          triggeredBy: 'data_change',
        },
        {
          'x-cascade-depth': 5,
        },
      ),
    );

    expect(segmentEvaluatorService.evaluateSegment).not.toHaveBeenCalled();
  });
});

function createMessage(
  payload: object,
  headers: Record<string, unknown>,
): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(payload)),
    fields: {} as ConsumeMessage['fields'],
    properties: {
      headers,
    } as ConsumeMessage['properties'],
  };
}
