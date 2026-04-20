import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Customer } from '../../customers/schemas/customer.schema';
import type { RuleNode } from '../types/rule-node.type';
import { isRuleNode } from '../types/rule-node.utils';

export type SegmentDocument = HydratedDocument<Segment>;

@Schema({ collection: 'segments', versionKey: false })
export class Segment {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, enum: ['dynamic', 'static'] })
  type!: 'dynamic' | 'static';

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
    validate: {
      validator: isRuleNode,
      message: 'rules must match the supported RuleNode DSL',
    },
  })
  rules!: RuleNode;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: Customer.name }],
    default: [],
  })
  memberIds!: Types.ObjectId[];

  @Prop({ required: true, default: 0, min: 0 })
  memberCount!: number;

  @Prop({ type: Date, default: null })
  frozenAt!: Date | null;

  @Prop({ type: Date, default: null })
  lastEvaluatedAt!: Date | null;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Segment' }],
    default: [],
  })
  dependsOnSegments!: Types.ObjectId[];
}

export const SegmentSchema = SchemaFactory.createForClass(Segment);

SegmentSchema.index({ name: 1 }, { unique: true });
SegmentSchema.index({ type: 1 });
