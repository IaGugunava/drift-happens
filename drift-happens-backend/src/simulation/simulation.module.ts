import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { SimulationController } from './simulation.controller';

@Module({
  imports: [CustomersModule],
  controllers: [SimulationController],
})
export class SimulationModule {}
