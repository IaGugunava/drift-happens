import { forwardRef, Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CampaignsController } from './campaigns.controller';
import { CampaignLog, CampaignLogSchema } from './schemas/campaign-log.schema';
import { CampaignProcessConsumerService } from './services/campaign-process-consumer.service';
import { CascadeConsumerService } from './services/cascade-consumer.service';
import { EventPublisherService } from './services/event-publisher.service';
import { RabbitMqService } from './services/rabbitmq.service';
import { UiNotificationConsumerService } from './services/ui-notification-consumer.service';
import { SegmentsModule } from '../segments/segments.module';

@Global()
@Module({
  imports: [
    forwardRef(() => SegmentsModule),
    MongooseModule.forFeature([
      {
        name: CampaignLog.name,
        schema: CampaignLogSchema,
      },
    ]),
  ],
  controllers: [CampaignsController],
  providers: [
    RabbitMqService,
    EventPublisherService,
    UiNotificationConsumerService,
    CampaignProcessConsumerService,
    CascadeConsumerService,
  ],
  exports: [RabbitMqService, EventPublisherService, MongooseModule],
})
export class EventsModule {}
