import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Customer } from '../../customers/schemas/customer.schema';
import { Segment } from './segment.schema';

export type SegmentEventDocument = HydratedDocument<SegmentEvent>;

@Schema({ collection: 'segment_events', versionKey: false })
export class SegmentEvent {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Segment.name,
    required: true,
    index: true,
  })
  segmentId!: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now, index: true })
  evaluatedAt!: Date;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: Customer.name }],
    default: [],
  })
  addedIds!: Types.ObjectId[];

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: Customer.name }],
    default: [],
  })
  removedIds!: Types.ObjectId[];

  @Prop({ required: true, default: 0, min: 0 })
  addedCount!: number;

  @Prop({ required: true, default: 0, min: 0 })
  removedCount!: number;

  @Prop({ required: true, default: 0, min: 0 })
  totalCount!: number;

  @Prop({ required: true, enum: ['data_change', 'cascade', 'manual'] })
  triggeredBy!: 'data_change' | 'cascade' | 'manual';
}

export const SegmentEventSchema = SchemaFactory.createForClass(SegmentEvent);

SegmentEventSchema.index({ segmentId: 1, evaluatedAt: -1 });
