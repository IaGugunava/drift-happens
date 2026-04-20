import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BufferModule } from '../buffer/buffer.module';
import { CustomersController } from './customers.controller';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { CustomerIndexerService } from './services/customer-indexer.service';
import { CustomersService } from './services/customers.service';

@Module({
  imports: [
    BufferModule,
    MongooseModule.forFeature([
      {
        name: Customer.name,
        schema: CustomerSchema,
      },
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerIndexerService],
  exports: [MongooseModule, CustomersService, CustomerIndexerService],
})
export class CustomersModule {}
