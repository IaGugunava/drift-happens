import type { ConsumeMessage } from 'amqplib';
import { UiNotificationConsumerService } from './ui-notification-consumer.service';

describe('UiNotificationConsumerService', () => {
  it('forwards segment delta events to the gateway', async () => {
    const segmentGateway = {
      broadcastSegmentUpdate: jest.fn(),
    };
    const service = new UiNotificationConsumerService(
      { consume: jest.fn() } as never,
      segmentGateway as never,
    );

    await service.handleMessage(
      createMessage({
        segmentId: 'segment-1',
        segmentName: 'VIP Clients',
        evaluatedAt: '2026-04-17T10:00:00.000Z',
        added: ['customer-1'],
        removed: [],
        addedCount: 1,
        removedCount: 0,
        totalCount: 1,
        triggeredBy: 'data_change',
      }),
    );

    expect(segmentGateway.broadcastSegmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: 'segment-1',
        segmentName: 'VIP Clients',
        totalCount: 1,
      }),
    );
  });
});

function createMessage(payload: object): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(payload)),
    fields: {} as ConsumeMessage['fields'],
    properties: {
      headers: {},
    } as ConsumeMessage['properties'],
  };
}
