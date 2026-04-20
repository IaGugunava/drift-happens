import { EventPublisherService } from './event-publisher.service';

describe('EventPublisherService', () => {
  it('publishes segment delta events to the shared topic exchange', async () => {
    const rabbitMqService = {
      publish: jest.fn().mockResolvedValue(true),
    };
    const service = new EventPublisherService(rabbitMqService as never);

    await service.publishSegmentDelta({
      segmentId: 'segment-1',
      segmentName: 'VIP Clients',
      evaluatedAt: '2026-04-17T10:00:00.000Z',
      added: ['customer-1'],
      removed: ['customer-2'],
      addedCount: 1,
      removedCount: 1,
      totalCount: 10,
      triggeredBy: 'data_change',
    });

    expect(rabbitMqService.publish).toHaveBeenCalledWith(
      'segment.events',
      'segment.segment-1.updated',
      {
        segmentId: 'segment-1',
        segmentName: 'VIP Clients',
        evaluatedAt: '2026-04-17T10:00:00.000Z',
        added: ['customer-1'],
        removed: ['customer-2'],
        addedCount: 1,
        removedCount: 1,
        totalCount: 10,
        triggeredBy: 'data_change',
      },
      undefined,
    );
  });
});
