import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CampaignLogDocument = HydratedDocument<CampaignLog>;

@Schema({ collection: 'campaign_log', versionKey: false })
export class CampaignLog {
  @Prop({ required: true })
  segmentId!: string;

  @Prop({ required: true, trim: true })
  segmentName!: string;

  @Prop({ type: Date, required: true, index: true })
  evaluatedAt!: Date;

  @Prop({ type: [String], default: [] })
  added!: string[];

  @Prop({ type: [String], default: [] })
  removed!: string[];

  @Prop({ required: true, default: 0, min: 0 })
  addedCount!: number;

  @Prop({ required: true, default: 0, min: 0 })
  removedCount!: number;

  @Prop({ required: true, default: 0, min: 0 })
  totalCount!: number;

  @Prop({ required: true, trim: true })
  message!: string;
}

export const CampaignLogSchema = SchemaFactory.createForClass(CampaignLog);

CampaignLogSchema.index({ evaluatedAt: -1 });
