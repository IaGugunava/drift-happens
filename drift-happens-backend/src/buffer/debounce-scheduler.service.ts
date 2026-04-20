import {
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { Segment } from '../segments/schemas/segment.schema';
import { SegmentEvaluatorService } from '../segments/services/segment-evaluator.service';
import { ChangeBufferService } from './change-buffer.service';

@Injectable()
export class DebounceSchedulerService {
  private isFlushing = false;

  constructor(
    private readonly changeBufferService: ChangeBufferService,
    private readonly segmentEvaluatorService: SegmentEvaluatorService,
    @InjectModel(Segment.name)
    private readonly segmentModel: Model<Segment>,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async flushPendingChanges(): Promise<void> {
    if (this.isFlushing) {
      return;
    }

    this.isFlushing = true;

    try {
      const pendingCustomerIds = await this.changeBufferService.consumePendingCustomerIds();

      if (pendingCustomerIds.length === 0) {
        return;
      }

      const dynamicSegments = await this.segmentModel
        .find({ type: 'dynamic' })
        .select({ _id: 1 })
        .lean<Array<{ _id: Types.ObjectId }>>()
        .exec();

      for (const segment of dynamicSegments) {
        await this.segmentEvaluatorService.evaluateSegment(segment._id.toString(), {
          triggeredBy: 'data_change',
        });
      }
    } finally {
      this.isFlushing = false;
    }
  }
}
