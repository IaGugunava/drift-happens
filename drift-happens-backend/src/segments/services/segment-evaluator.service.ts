import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventPublisherService } from '../../events/services/event-publisher.service';
import { SearchService } from '../../search/search.service';
import { Segment } from '../schemas/segment.schema';
import { SegmentEvent } from '../schemas/segment-event.schema';
import { RuleTranslatorService } from './rule-translator.service';

export type SegmentEvaluationTrigger = 'data_change' | 'cascade' | 'manual';

export interface EvaluateSegmentOptions {
  force?: boolean;
  triggeredBy?: SegmentEvaluationTrigger;
  cascadeDepth?: number;
  visitedSegmentIds?: string[];
  persistEvenIfUnchanged?: boolean;
}

export interface SegmentDeltaResult {
  segmentId: string;
  segmentName: string;
  evaluatedAt: string;
  added: string[];
  removed: string[];
  addedCount: number;
  removedCount: number;
  totalCount: number;
  triggeredBy: SegmentEvaluationTrigger;
}

@Injectable()
export class SegmentEvaluatorService {
  constructor(
    @InjectModel(Segment.name)
    private readonly segmentModel: Model<Segment>,
    @InjectModel(SegmentEvent.name)
    private readonly segmentEventModel: Model<SegmentEvent>,
    private readonly ruleTranslatorService: RuleTranslatorService,
    private readonly searchService: SearchService,
    private readonly eventPublisherService: EventPublisherService,
  ) {}

  async evaluateSegment(
    segmentId: string,
    options: EvaluateSegmentOptions = {},
  ): Promise<SegmentDeltaResult | null> {
    const segment = await this.segmentModel.findById(segmentId).exec();

    if (!segment) {
      throw new NotFoundException(`Segment ${segmentId} not found`);
    }

    if (segment.type === 'static' && !options.force) {
      return null;
    }

    const query = await this.ruleTranslatorService.translate(segment.rules);
    const matchingCustomerIds = await this.searchService.searchCustomerIdsByQuery(query);
    const nextMemberIds = this.uniqueIds(matchingCustomerIds);
    const previousMemberIds = this.uniqueIds(
      segment.memberIds.map((memberId) => memberId.toString()),
    );

    const previousMemberIdSet = new Set(previousMemberIds);
    const nextMemberIdSet = new Set(nextMemberIds);
    const added = nextMemberIds.filter((customerId) => !previousMemberIdSet.has(customerId));
    const removed = previousMemberIds.filter((customerId) => !nextMemberIdSet.has(customerId));

    if (added.length === 0 && removed.length === 0 && !options.persistEvenIfUnchanged) {
      return null;
    }

    const evaluatedAt = new Date();
    const triggeredBy = options.triggeredBy ?? 'data_change';

    await this.segmentModel
      .updateOne(
        { _id: segment._id },
        {
          $set: {
            memberIds: nextMemberIds.map((customerId) => new Types.ObjectId(customerId)),
            memberCount: nextMemberIds.length,
            lastEvaluatedAt: evaluatedAt,
            ...(segment.type === 'static' && options.force ? { frozenAt: evaluatedAt } : {}),
          },
        },
      )
      .exec();

    if (added.length > 0 || removed.length > 0) {
      await this.segmentEventModel.create({
        segmentId: segment._id,
        evaluatedAt,
        addedIds: added.map((customerId) => new Types.ObjectId(customerId)),
        removedIds: removed.map((customerId) => new Types.ObjectId(customerId)),
        addedCount: added.length,
        removedCount: removed.length,
        totalCount: nextMemberIds.length,
        triggeredBy,
      });
    }

    const deltaResult: SegmentDeltaResult = {
      segmentId: segment.id,
      segmentName: segment.name,
      evaluatedAt: evaluatedAt.toISOString(),
      added,
      removed,
      addedCount: added.length,
      removedCount: removed.length,
      totalCount: nextMemberIds.length,
      triggeredBy,
    };

    if (added.length > 0 || removed.length > 0) {
      await this.eventPublisherService.publishSegmentDelta(deltaResult, {
        persistent: true,
        contentType: 'application/json',
        headers: {
          'x-cascade-depth': options.cascadeDepth ?? 0,
          'x-visited-segment-ids': JSON.stringify(
            options.visitedSegmentIds ?? [segment.id],
          ),
        },
      });
    }

    return deltaResult;
  }

  private uniqueIds(ids: string[]): string[] {
    return [...new Set(ids)];
  }
}
