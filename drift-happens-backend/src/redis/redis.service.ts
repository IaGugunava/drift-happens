import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis(this.configService.getOrThrow<string>('REDIS_URL'));
  }

  getClient(): Redis {
    return this.client;
  }

  async addToSet(key: string, member: string): Promise<void> {
    await this.client.sadd(key, member);
  }

  async addManyToSet(key: string, members: string[]): Promise<void> {
    if (members.length === 0) {
      return;
    }

    await this.client.sadd(key, ...members);
  }

  async getSetMembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async drainSet(key: string): Promise<string[]> {
    const size = await this.client.scard(key);

    if (size === 0) {
      return [];
    }

    const result = await this.client.spop(key, size);
    if (Array.isArray(result)) {
      return result;
    }

    return result ? [result] : [];
  }

  async replaceSetMembers(key: string, members: string[]): Promise<void> {
    const pipeline = this.client.pipeline();
    pipeline.del(key);

    if (members.length > 0) {
      pipeline.sadd(key, ...members);
    }

    await pipeline.exec();
  }

  async deleteKeysByPattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);

    if (keys.length === 0) {
      return;
    }

    await this.client.del(...keys);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
