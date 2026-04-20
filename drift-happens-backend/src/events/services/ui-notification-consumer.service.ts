import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { segmentEventQueues } from '../events.constants';
import type { SegmentDeltaEvent } from '../types/segment-delta-event.type';
import { RabbitMqService } from './rabbitmq.service';
import { SegmentGateway } from '../../segments/gateway/segment.gateway';

@Injectable()
export class UiNotificationConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UiNotificationConsumerService.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly segmentGateway: SegmentGateway,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.rabbitMqService.consumeWithRetry(segmentEventQueues.ui, async (message) => {
      await this.handleMessage(message);
    });
  }

  async handleMessage(message: ConsumeMessage): Promise<void> {
    const event = this.parseMessage(message);
    this.segmentGateway.broadcastSegmentUpdate(event);
    this.logger.debug(`Forwarded segment delta for ${event.segmentId} to WebSocket clients`);
  }

  private parseMessage(message: ConsumeMessage): SegmentDeltaEvent {
    return JSON.parse(message.content.toString()) as SegmentDeltaEvent;
  }
}
