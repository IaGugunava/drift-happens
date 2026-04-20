import { ChangeBufferService } from './change-buffer.service';

describe('ChangeBufferService', () => {
  it('buffers a single changed customer id', async () => {
    const redisService = createRedisServiceMock();
    const service = new ChangeBufferService(redisService as never);

    await service.markCustomerChanged('customer-1');

    expect(redisService.addToSet).toHaveBeenCalledWith(
      'segment:pending:customers',
      'customer-1',
    );
  });

  it('chunks bulk customer buffering into Redis set writes', async () => {
    const redisService = createRedisServiceMock();
    const service = new ChangeBufferService(redisService as never);
    const customerIds = Array.from({ length: 1001 }, (_, index) => `customer-${index}`);

    await service.markCustomersChanged(customerIds);

    expect(redisService.addManyToSet).toHaveBeenCalledTimes(2);
    expect(redisService.addManyToSet).toHaveBeenNthCalledWith(
      1,
      'segment:pending:customers',
      customerIds.slice(0, 1000),
    );
    expect(redisService.addManyToSet).toHaveBeenNthCalledWith(
      2,
      'segment:pending:customers',
      customerIds.slice(1000),
    );
  });

  it('drains pending customer ids from Redis', async () => {
    const redisService = createRedisServiceMock(['customer-1', 'customer-2']);
    const service = new ChangeBufferService(redisService as never);

    await expect(service.consumePendingCustomerIds()).resolves.toEqual([
      'customer-1',
      'customer-2',
    ]);
  });
});

function createRedisServiceMock(drainedMembers: string[] = []) {
  return {
    addToSet: jest.fn(async () => undefined),
    addManyToSet: jest.fn(async () => undefined),
    drainSet: jest.fn(async () => drainedMembers),
  };
}
