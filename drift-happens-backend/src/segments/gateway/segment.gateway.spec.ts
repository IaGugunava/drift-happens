import { WsException } from '@nestjs/websockets';
import {
  campaignUpdatedEvent,
  SegmentGateway,
  segmentUpdatedEvent,
} from './segment.gateway';
import type { CampaignLogEntry } from '../../events/types/campaign-log-entry.type';
import type { SegmentDeltaEvent } from '../../events/types/segment-delta-event.type';

describe('SegmentGateway', () => {
  it('joins the correct segment room and returns the subscription metadata', async () => {
    const gateway = new SegmentGateway();
    const client = {
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn(),
    };

    await expect(gateway.handleJoinSegment('  segment-1  ', client)).resolves.toEqual({
      room: 'segment:segment-1',
      segmentId: 'segment-1',
    });

    expect(client.join).toHaveBeenCalledWith('segment:segment-1');
  });

  it('leaves the correct segment room and returns the unsubscription metadata', async () => {
    const gateway = new SegmentGateway();
    const client = {
      join: jest.fn(),
      leave: jest.fn().mockResolvedValue(undefined),
    };

    await expect(gateway.handleLeaveSegment('segment-1', client)).resolves.toEqual({
      room: 'segment:segment-1',
      segmentId: 'segment-1',
    });

    expect(client.leave).toHaveBeenCalledWith('segment:segment-1');
  });

  it('broadcasts updates only to the matching segment room', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const gateway = new SegmentGateway();
    gateway.server = { to };
    const event: SegmentDeltaEvent = {
      segmentId: 'segment-1',
      segmentName: 'VIP Clients',
      evaluatedAt: '2026-04-17T10:00:00.000Z',
      added: ['customer-1'],
      removed: [],
      addedCount: 1,
      removedCount: 0,
      totalCount: 10,
      triggeredBy: 'data_change',
    };

    gateway.broadcastSegmentUpdate(event);

    expect(to).toHaveBeenCalledWith('segment:segment-1');
    expect(emit).toHaveBeenCalledWith(segmentUpdatedEvent, event);
  });

  it('broadcasts campaign updates to the campaigns room', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const gateway = new SegmentGateway();
    gateway.server = { to };
    const entry: CampaignLogEntry = {
      id: 'log-1',
      segmentId: 'segment-1',
      segmentName: 'VIP Clients',
      evaluatedAt: '2026-04-17T10:00:00.000Z',
      added: ['customer-1'],
      removed: [],
      addedCount: 1,
      removedCount: 0,
      totalCount: 10,
      message: 'Enrolled 1 customers for VIP Clients.',
    };

    gateway.broadcastCampaignUpdate(entry);

    expect(to).toHaveBeenCalledWith('campaigns');
    expect(emit).toHaveBeenCalledWith(campaignUpdatedEvent, entry);
  });

  it('rejects blank segment ids for room subscriptions', async () => {
    const gateway = new SegmentGateway();
    const client = {
      join: jest.fn(),
      leave: jest.fn(),
    };

    await expect(gateway.handleJoinSegment('   ', client)).rejects.toBeInstanceOf(
      WsException,
    );
  });
});
