import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { segmentEventQueues } from '../events.constants';
import type { SegmentDeltaEvent } from '../types/segment-delta-event.type';
import { RabbitMqService } from './rabbitmq.service';
import { SegmentDependencyService } from '../../segments/services/segment-dependency.service';
import { SegmentEvaluatorService } from '../../segments/services/segment-evaluator.service';

const MAX_CASCADE_DEPTH = 5;
const CASCADE_DEPTH_HEADER = 'x-cascade-depth';
const CASCADE_VISITED_HEADER = 'x-visited-segment-ids';

@Injectable()
export class CascadeConsumerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CascadeConsumerService.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly segmentDependencyService: SegmentDependencyService,
    private readonly segmentEvaluatorService: SegmentEvaluatorService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.rabbitMqService.consumeWithRetry(segmentEventQueues.cascade, async (message) => {
      await this.handleMessage(message);
    });
  }

  async handleMessage(message: ConsumeMessage): Promise<void> {
    const event = this.parseMessage(message);
    const cascadeDepth = this.getCascadeDepth(message);

    if (cascadeDepth >= MAX_CASCADE_DEPTH) {
      this.logger.warn(`Cascade depth limit reached for segment ${event.segmentId}`);
      return;
    }

    const visitedSegmentIds = this.getVisitedSegmentIds(message, event.segmentId);
    const dependentSegmentIds =
      await this.segmentDependencyService.getDependentSegmentIds(event.segmentId);

    for (const dependentSegmentId of dependentSegmentIds) {
      if (visitedSegmentIds.has(dependentSegmentId)) {
        this.logger.warn(
          `Skipping cascade reevaluation for ${dependentSegmentId} because it was already visited`,
        );
        continue;
      }

      await this.segmentEvaluatorService.evaluateSegment(dependentSegmentId, {
        triggeredBy: 'cascade',
        cascadeDepth: cascadeDepth + 1,
        visitedSegmentIds: [...visitedSegmentIds, dependentSegmentId],
      });
    }
  }

  private getCascadeDepth(message: ConsumeMessage): number {
    const rawValue = message.properties.headers?.[CASCADE_DEPTH_HEADER];
    return typeof rawValue === 'number' ? rawValue : 0;
  }

  private getVisitedSegmentIds(
    message: ConsumeMessage,
    segmentId: string,
  ): Set<string> {
    const rawValue = message.properties.headers?.[CASCADE_VISITED_HEADER];

    if (typeof rawValue !== 'string') {
      return new Set([segmentId]);
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;

      if (!Array.isArray(parsed)) {
        return new Set([segmentId]);
      }

      return new Set(
        parsed
          .filter((value): value is string => typeof value === 'string')
          .concat(segmentId),
      );
    } catch {
      return new Set([segmentId]);
    }
  }

  private parseMessage(message: ConsumeMessage): SegmentDeltaEvent {
    return JSON.parse(message.content.toString()) as SegmentDeltaEvent;
  }
}
