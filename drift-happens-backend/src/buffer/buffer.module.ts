import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Segment, SegmentSchema } from '../segments/schemas/segment.schema';
import { SegmentsModule } from '../segments/segments.module';
import { ChangeBufferService } from './change-buffer.service';
import { DebounceSchedulerService } from './debounce-scheduler.service';

@Module({
  imports: [
    SegmentsModule,
    MongooseModule.forFeature([
      {
        name: Segment.name,
        schema: SegmentSchema,
      },
    ]),
  ],
  providers: [ChangeBufferService, DebounceSchedulerService],
  exports: [ChangeBufferService, DebounceSchedulerService],
})
export class BufferModule {}
