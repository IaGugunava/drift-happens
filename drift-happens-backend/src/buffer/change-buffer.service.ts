import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const PENDING_CUSTOMERS_KEY = 'segment:pending:customers';
const BULK_BUFFER_CHUNK_SIZE = 1000;

@Injectable()
export class ChangeBufferService {
  constructor(private readonly redisService: RedisService) {}

  async markCustomerChanged(customerId: string): Promise<void> {
    await this.redisService.addToSet(PENDING_CUSTOMERS_KEY, customerId);
  }

  async markCustomersChanged(customerIds: string[]): Promise<void> {
    for (const chunk of this.chunkCustomerIds(customerIds, BULK_BUFFER_CHUNK_SIZE)) {
      await this.redisService.addManyToSet(PENDING_CUSTOMERS_KEY, chunk);
    }
  }

  async consumePendingCustomerIds(): Promise<string[]> {
    return this.redisService.drainSet(PENDING_CUSTOMERS_KEY);
  }

  private chunkCustomerIds(customerIds: string[], chunkSize: number): string[][] {
    const chunks: string[][] = [];

    for (let index = 0; index < customerIds.length; index += chunkSize) {
      chunks.push(customerIds.slice(index, index + chunkSize));
    }

    return chunks;
  }
}
