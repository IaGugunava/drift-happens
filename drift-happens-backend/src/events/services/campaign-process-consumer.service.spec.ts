import type { ConsumeMessage } from 'amqplib';
import { CampaignProcessConsumerService } from './campaign-process-consumer.service';

describe('CampaignProcessConsumerService', () => {
  it('stores a campaign log record for each segment delta event', async () => {
    const campaignLogModel = {
      create: jest.fn().mockResolvedValue({
        id: 'log-1',
        segmentId: 'segment-1',
        segmentName: 'VIP Clients',
        evaluatedAt: new Date('2026-04-17T10:00:00.000Z'),
        added: ['customer-1'],
        removed: ['customer-2'],
        addedCount: 1,
        removedCount: 1,
        totalCount: 4,
        message: 'Enrolled 1 and removed 1 customers for VIP Clients.',
      }),
    };
    const segmentGateway = {
      broadcastCampaignUpdate: jest.fn(),
    };
    const service = new CampaignProcessConsumerService(
      { consume: jest.fn() } as never,
      campaignLogModel as never,
      segmentGateway as never,
    );

    await service.handleMessage(
      createMessage({
        segmentId: 'segment-1',
        segmentName: 'VIP Clients',
        evaluatedAt: '2026-04-17T10:00:00.000Z',
        added: ['customer-1'],
        removed: ['customer-2'],
        addedCount: 1,
        removedCount: 1,
        totalCount: 4,
        triggeredBy: 'data_change',
      }),
    );

    expect(campaignLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: 'segment-1',
        segmentName: 'VIP Clients',
        addedCount: 1,
        removedCount: 1,
        totalCount: 4,
        message: 'Enrolled 1 and removed 1 customers for VIP Clients.',
      }),
    );
    expect(segmentGateway.broadcastCampaignUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'log-1',
        segmentId: 'segment-1',
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
