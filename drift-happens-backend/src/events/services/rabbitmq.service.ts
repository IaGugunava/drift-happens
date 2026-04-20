import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, {
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
  type Options,
} from 'amqplib';
import {
  SEGMENT_EVENTS_EXCHANGE,
  SEGMENT_EVENT_ROUTING_PATTERN,
  segmentEventQueues,
} from '../events.constants';

@Injectable()
export class RabbitMqService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection?: ChannelModel;
  private channel?: Channel;
  private readonly consumerChannels = new Set<Channel>();
  private readonly consumerRetryTimers = new Map<string, NodeJS.Timeout>();
  private setupPromise?: Promise<void>;

  constructor(private readonly configService: ConfigService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureTopology();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown RabbitMQ error';
      this.logger.warn(`RabbitMQ bootstrap skipped: ${message}`);
    }
  }

  async publish(
    exchange: string,
    routingKey: string,
    payload: unknown,
    options: Options.Publish = { persistent: true, contentType: 'application/json' },
  ): Promise<boolean> {
    await this.ensureTopology();

    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available');
    }

    return this.channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      options,
    );
  }

  async consume(
    queue: string,
    handler: (message: ConsumeMessage) => Promise<void>,
  ): Promise<void> {
    await this.ensureTopology();

    if (!this.connection) {
      throw new Error('RabbitMQ connection is not available');
    }

    const channel = await this.connection.createChannel();
    this.consumerChannels.add(channel);

    channel.on('close', () => {
      this.consumerChannels.delete(channel);
    });

    channel.on('error', (error) => {
      this.logger.error(`RabbitMQ consumer channel error: ${error.message}`);
    });

    await channel.prefetch(1);
    await channel.consume(queue, async (message) => {
      if (!message) {
        return;
      }

      try {
        await handler(message);
        channel.ack(message);
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : 'Unknown consumer error';
        this.logger.error(`RabbitMQ consumer failed for ${queue}: ${messageText}`);
        channel.nack(message, false, false);
      }
    });
  }

  consumeWithRetry(
    queue: string,
    handler: (message: ConsumeMessage) => Promise<void>,
    retryDelayMs = 5000,
  ): void {
    this.clearConsumerRetry(queue);

    const attemptConsume = async () => {
      try {
        await this.consume(queue, handler);
        this.logger.log(`RabbitMQ consumer is listening on ${queue}`);
        this.clearConsumerRetry(queue);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown RabbitMQ consumer bootstrap error';
        this.logger.warn(
          `RabbitMQ consumer startup skipped for ${queue}: ${message}. Retrying in ${retryDelayMs}ms`,
        );
        this.scheduleConsumerRetry(queue, attemptConsume, retryDelayMs);
      }
    };

    void attemptConsume();
  }

  async onModuleDestroy(): Promise<void> {
    this.clearAllConsumerRetries();
    await this.closeConsumerChannels();
    await this.closeChannel();
    await this.closeConnection();
  }

  private async ensureTopology(): Promise<void> {
    if (!this.setupPromise) {
      this.setupPromise = this.setupChannelAndTopology().catch((error) => {
        this.setupPromise = undefined;
        throw error;
      });
    }

    await this.setupPromise;
  }

  private async setupChannelAndTopology(): Promise<void> {
    if (!this.connection) {
      const connection = await amqp.connect(
        this.configService.getOrThrow<string>('RABBITMQ_URL'),
      );
      connection.on('close', () => {
        this.connection = undefined;
        this.channel = undefined;
        this.setupPromise = undefined;
      });
      connection.on('error', (error) => {
        this.logger.error(`RabbitMQ connection error: ${error.message}`);
      });
      this.connection = connection;
    }

    if (!this.channel) {
      const channel = await this.connection.createChannel();
      channel.on('close', () => {
        this.channel = undefined;
        this.setupPromise = undefined;
      });
      channel.on('error', (error) => {
        this.logger.error(`RabbitMQ channel error: ${error.message}`);
      });
      this.channel = channel;
    }

    const channel = this.channel;

    await channel.assertExchange(SEGMENT_EVENTS_EXCHANGE, 'topic', {
      durable: true,
    });

    for (const queueName of Object.values(segmentEventQueues)) {
      await channel.assertQueue(queueName, {
        durable: true,
      });
      await channel.bindQueue(
        queueName,
        SEGMENT_EVENTS_EXCHANGE,
        SEGMENT_EVENT_ROUTING_PATTERN,
      );
    }
  }

  private async closeChannel(): Promise<void> {
    if (!this.channel) {
      return;
    }

    const channel = this.channel;
    this.channel = undefined;
    await channel.close();
  }

  private async closeConsumerChannels(): Promise<void> {
    const channels = [...this.consumerChannels];
    this.consumerChannels.clear();

    await Promise.all(channels.map(async (channel) => channel.close()));
  }

  private async closeConnection(): Promise<void> {
    if (!this.connection) {
      return;
    }

    const connection = this.connection;
    this.connection = undefined;
    await connection.close();
  }

  private scheduleConsumerRetry(
    queue: string,
    attemptConsume: () => Promise<void>,
    retryDelayMs: number,
  ): void {
    this.clearConsumerRetry(queue);
    const timer = setTimeout(() => {
      this.consumerRetryTimers.delete(queue);
      void attemptConsume();
    }, retryDelayMs);
    this.consumerRetryTimers.set(queue, timer);
  }

  private clearConsumerRetry(queue: string): void {
    const timer = this.consumerRetryTimers.get(queue);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.consumerRetryTimers.delete(queue);
  }

  private clearAllConsumerRetries(): void {
    for (const timer of this.consumerRetryTimers.values()) {
      clearTimeout(timer);
    }

    this.consumerRetryTimers.clear();
  }
}
