import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BufferModule } from './buffer/buffer.module';
import { CustomersModule } from './customers/customers.module';
import { EventsModule } from './events/events.module';
import { RedisModule } from './redis/redis.module';
import { SearchModule } from './search/search.module';
import { SegmentsModule } from './segments/segments.module';
import { SimulationModule } from './simulation/simulation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGO_URI'),
      }),
    }),
    ScheduleModule.forRoot(),
    EventsModule,
    RedisModule,
    SearchModule,
    BufferModule,
    CustomersModule,
    SegmentsModule,
    SimulationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
