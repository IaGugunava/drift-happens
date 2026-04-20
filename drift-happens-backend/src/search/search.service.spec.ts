import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { SearchService } from './search.service';

const clientMock = {
  indices: {
    exists: jest.fn(),
    create: jest.fn(),
  },
  openPointInTime: jest.fn(),
  closePointInTime: jest.fn(),
  search: jest.fn(),
  index: jest.fn(),
  bulk: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@elastic/elasticsearch', () => ({
  Client: jest.fn(() => clientMock),
}));

describe('SearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('collects every matching customer id across PIT pages beyond 10k results', async () => {
    const totalCustomerIds = 10_001;
    const allIds = Array.from({ length: totalCustomerIds }, () => createObjectIdString());
    const expectedQuery = {
      range: {
        totalSpent: {
          gte: 5000,
        },
      },
    };

    clientMock.openPointInTime.mockResolvedValue({
      id: 'pit-initial',
    });

    for (let offset = 0; offset < allIds.length; offset += 1000) {
      const pageIds = allIds.slice(offset, offset + 1000);
      const pitId = `pit-${offset / 1000 + 1}`;
      clientMock.search.mockResolvedValueOnce({
        pit_id: pitId,
        hits: {
          hits: pageIds.map((id, index) => ({
            _id: id,
            sort: [offset + index],
          })),
        },
      });
    }

    const service = new SearchService({
      getOrThrow: jest.fn().mockReturnValue('http://elastic.local:9200'),
    } as unknown as ConfigService);

    await expect(service.searchCustomerIdsByQuery(expectedQuery)).resolves.toEqual(allIds);

    expect(Client).toHaveBeenCalledWith({
      node: 'http://elastic.local:9200',
    });
    expect(clientMock.openPointInTime).toHaveBeenCalledWith({
      index: 'customers',
      keep_alive: '1m',
    });
    expect(clientMock.search).toHaveBeenCalledTimes(11);
    expect(clientMock.search).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        size: 1000,
        query: expectedQuery,
        sort: ['_shard_doc'],
        pit: {
          id: 'pit-initial',
          keep_alive: '1m',
        },
      }),
    );
    expect(clientMock.search).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        search_after: [999],
        pit: {
          id: 'pit-1',
          keep_alive: '1m',
        },
      }),
    );
    expect(clientMock.closePointInTime).toHaveBeenCalledWith({
      id: 'pit-11',
    });
  });
});

function createObjectIdString(): string {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
