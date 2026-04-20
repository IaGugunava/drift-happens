import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '../events/events.module';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { SegmentsController } from './segments.controller';
import { Segment, SegmentSchema } from './schemas/segment.schema';
import {
  SegmentEvent,
  SegmentEventSchema,
} from './schemas/segment-event.schema';
import { SearchModule } from '../search/search.module';
import { RedisModule } from '../redis/redis.module';
import { SegmentDependencyService } from './services/segment-dependency.service';
import { SegmentEvaluatorService } from './services/segment-evaluator.service';
import { RuleTranslatorService } from './services/rule-translator.service';
import { SegmentsService } from './services/segments.service';
import { SegmentGateway } from './gateway/segment.gateway';

@Module({
  imports: [
    forwardRef(() => EventsModule),
    RedisModule,
    SearchModule,
    MongooseModule.forFeature([
      {
        name: Segment.name,
        schema: SegmentSchema,
      },
      {
        name: SegmentEvent.name,
        schema: SegmentEventSchema,
      },
      {
        name: Customer.name,
        schema: CustomerSchema,
      },
    ]),
  ],
  controllers: [SegmentsController],
  providers: [
    RuleTranslatorService,
    SegmentsService,
    SegmentEvaluatorService,
    SegmentDependencyService,
    SegmentGateway,
  ],
  exports: [
    MongooseModule,
    RuleTranslatorService,
    SegmentsService,
    SegmentEvaluatorService,
    SegmentDependencyService,
    SegmentGateway,
  ],
})
export class SegmentsModule {}
