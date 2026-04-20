import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({ _id: false })
export class CustomerTransaction {
  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ type: Date, required: true, default: Date.now })
  createdAt!: Date;
}

export const CustomerTransactionSchema =
  SchemaFactory.createForClass(CustomerTransaction);

@Schema({ collection: 'customers', versionKey: false })
export class Customer {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email!: string;

  @Prop({ required: true, default: 0, min: 0 })
  totalSpent!: number;

  @Prop({ type: Date, default: null })
  lastTransactionAt!: Date | null;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: Date, required: true, default: Date.now })
  createdAt!: Date;

  @Prop({ type: [CustomerTransactionSchema], default: [] })
  transactions!: CustomerTransaction[];
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

CustomerSchema.index({ email: 1 }, { unique: true });
CustomerSchema.index({ totalSpent: 1 });
CustomerSchema.index({ lastTransactionAt: 1 });
