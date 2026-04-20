import { Injectable, Logger } from '@nestjs/common';
import type { Options } from 'amqplib';
import {
  SEGMENT_EVENTS_EXCHANGE,
  getSegmentUpdatedRoutingKey,
} from '../events.constants';
import type { SegmentDeltaEvent } from '../types/segment-delta-event.type';
import { RabbitMqService } from './rabbitmq.service';

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(private readonly rabbitMqService: RabbitMqService) {}

  async publishSegmentDelta(
    event: SegmentDeltaEvent,
    options?: Options.Publish,
  ): Promise<void> {
    try {
      await this.rabbitMqService.publish(
        SEGMENT_EVENTS_EXCHANGE,
        getSegmentUpdatedRoutingKey(event.segmentId),
        event,
        options,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown RabbitMQ publish error';
      this.logger.error(
        `Failed to publish segment delta for ${event.segmentId}: ${message}`,
      );
    }
  }
}
