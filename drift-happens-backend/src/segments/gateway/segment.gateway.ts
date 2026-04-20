import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { CampaignLogEntry } from '../../events/types/campaign-log-entry.type';
import type { SegmentDeltaEvent } from '../../events/types/segment-delta-event.type';

interface SegmentSocketLike {
  join(room: string): void | Promise<void>;
  leave(room: string): void | Promise<void>;
}

interface SegmentServerLike {
  to(room: string): {
    emit(event: string, payload: CampaignLogEntry | SegmentDeltaEvent): void;
  };
}

export const joinSegmentEvent = 'join:segment';
export const leaveSegmentEvent = 'leave:segment';
export const joinCampaignsEvent = 'join:campaigns';
export const leaveCampaignsEvent = 'leave:campaigns';
export const segmentUpdatedEvent = 'segment:updated';
export const campaignUpdatedEvent = 'campaign:updated';
const campaignsRoom = 'campaigns';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SegmentGateway {
  private readonly logger = new Logger(SegmentGateway.name);

  @WebSocketServer()
  server!: SegmentServerLike;

  @SubscribeMessage(joinSegmentEvent)
  async handleJoinSegment(
    @MessageBody() segmentId: string,
    @ConnectedSocket() client: SegmentSocketLike,
  ): Promise<{ room: string; segmentId: string }> {
    const normalizedSegmentId = this.normalizeSegmentId(segmentId);
    const room = this.getSegmentRoom(normalizedSegmentId);

    await client.join(room);
    this.logger.debug(`Client joined ${room}`);

    return {
      room,
      segmentId: normalizedSegmentId,
    };
  }

  @SubscribeMessage(leaveSegmentEvent)
  async handleLeaveSegment(
    @MessageBody() segmentId: string,
    @ConnectedSocket() client: SegmentSocketLike,
  ): Promise<{ room: string; segmentId: string }> {
    const normalizedSegmentId = this.normalizeSegmentId(segmentId);
    const room = this.getSegmentRoom(normalizedSegmentId);

    await client.leave(room);
    this.logger.debug(`Client left ${room}`);

    return {
      room,
      segmentId: normalizedSegmentId,
    };
  }

  @SubscribeMessage(joinCampaignsEvent)
  async handleJoinCampaigns(
    @ConnectedSocket() client: SegmentSocketLike,
  ): Promise<{ room: string }> {
    await client.join(campaignsRoom);
    this.logger.debug(`Client joined ${campaignsRoom}`);

    return { room: campaignsRoom };
  }

  @SubscribeMessage(leaveCampaignsEvent)
  async handleLeaveCampaigns(
    @ConnectedSocket() client: SegmentSocketLike,
  ): Promise<{ room: string }> {
    await client.leave(campaignsRoom);
    this.logger.debug(`Client left ${campaignsRoom}`);

    return { room: campaignsRoom };
  }

  broadcastSegmentUpdate(event: SegmentDeltaEvent): void {
    const room = this.getSegmentRoom(event.segmentId);
    this.server.to(room).emit(segmentUpdatedEvent, event);
  }

  broadcastCampaignUpdate(entry: CampaignLogEntry): void {
    this.server.to(campaignsRoom).emit(campaignUpdatedEvent, entry);
  }

  getSegmentRoom(segmentId: string): string {
    return `segment:${segmentId}`;
  }

  private normalizeSegmentId(segmentId: string): string {
    if (typeof segmentId !== 'string' || segmentId.trim().length === 0) {
      throw new WsException('segmentId must be a non-empty string');
    }

    return segmentId.trim();
  }
}
