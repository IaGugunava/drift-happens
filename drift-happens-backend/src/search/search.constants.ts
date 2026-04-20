import type { IndicesIndexSettings, MappingTypeMapping } from '@elastic/elasticsearch/lib/api/types';

export const CUSTOMERS_INDEX = 'customers';

export const customersIndexSettings: IndicesIndexSettings = {
  number_of_shards: 1,
  number_of_replicas: 0,
};

export const customersIndexMappings: MappingTypeMapping = {
  dynamic: 'strict',
  properties: {
    name: {
      type: 'text',
      fields: {
        keyword: {
          type: 'keyword',
        },
      },
    },
    email: {
      type: 'keyword',
    },
    totalSpent: {
      type: 'double',
    },
    lastTransactionAt: {
      type: 'date',
    },
    tags: {
      type: 'keyword',
    },
    createdAt: {
      type: 'date',
    },
    transactions: {
      type: 'nested',
      properties: {
        amount: {
          type: 'double',
        },
        createdAt: {
          type: 'date',
        },
      },
    },
  },
};
