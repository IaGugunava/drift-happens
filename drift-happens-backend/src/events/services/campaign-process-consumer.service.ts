import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ConsumeMessage } from 'amqplib';
import { Model } from 'mongoose';
import { CampaignLog } from '../schemas/campaign-log.schema';
import type { CampaignLogEntry } from '../types/campaign-log-entry.type';
import { segmentEventQueues } from '../events.constants';
import type { SegmentDeltaEvent } from '../types/segment-delta-event.type';
import { RabbitMqService } from './rabbitmq.service';
import { SegmentGateway } from '../../segments/gateway/segment.gateway';

@Injectable()
export class CampaignProcessConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CampaignProcessConsumerService.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    @InjectModel(CampaignLog.name)
    private readonly campaignLogModel: Model<CampaignLog>,
    private readonly segmentGateway: SegmentGateway,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.rabbitMqService.consumeWithRetry(segmentEventQueues.campaign, async (message) => {
      await this.handleMessage(message);
    });
  }

  async handleMessage(message: ConsumeMessage): Promise<void> {
    const event = this.parseMessage(message);
    const logMessage = this.buildLogMessage(event);

    if (event.addedCount > 0) {
      this.logger.log(`Enrolling ${event.addedCount} customers in campaign for ${event.segmentName}`);
    }

    if (event.removedCount > 0) {
      this.logger.log(`Removing ${event.removedCount} customers from campaign for ${event.segmentName}`);
    }

    const log = await this.campaignLogModel.create({
      segmentId: event.segmentId,
      segmentName: event.segmentName,
      evaluatedAt: new Date(event.evaluatedAt),
      added: event.added,
      removed: event.removed,
      addedCount: event.addedCount,
      removedCount: event.removedCount,
      totalCount: event.totalCount,
      message: logMessage,
    });

    this.segmentGateway.broadcastCampaignUpdate(this.toCampaignLogEntry(log));
  }

  private buildLogMessage(event: SegmentDeltaEvent): string {
    if (event.addedCount > 0 && event.removedCount > 0) {
      return `Enrolled ${event.addedCount} and removed ${event.removedCount} customers for ${event.segmentName}.`;
    }

    if (event.addedCount > 0) {
      return `Enrolled ${event.addedCount} customers for ${event.segmentName}.`;
    }

    return `Removed ${event.removedCount} customers for ${event.segmentName}.`;
  }

  private parseMessage(message: ConsumeMessage): SegmentDeltaEvent {
    return JSON.parse(message.content.toString()) as SegmentDeltaEvent;
  }

  private toCampaignLogEntry(log: CampaignLog): CampaignLogEntry {
    return {
      id: 'id' in log ? String(log.id) : '',
      segmentId: log.segmentId,
      segmentName: log.segmentName,
      evaluatedAt: log.evaluatedAt.toISOString(),
      added: log.added,
      removed: log.removed,
      addedCount: log.addedCount,
      removedCount: log.removedCount,
      totalCount: log.totalCount,
      message: log.message,
    };
  }
}
