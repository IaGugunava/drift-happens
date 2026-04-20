import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import type {
  FieldValue,
  QueryDslQueryContainer,
  SearchRequest,
  SearchResponse,
} from '@elastic/elasticsearch/lib/api/types';
import {
  CUSTOMERS_INDEX,
  customersIndexMappings,
  customersIndexSettings,
} from './search.constants';

const SEARCH_PAGE_SIZE = 1000;
const SEARCH_PIT_KEEP_ALIVE = '1m';

@Injectable()
export class SearchService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: Client;
  private ensureCustomersIndexPromise?: Promise<void>;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({
      node: this.configService.getOrThrow<string>('ELASTICSEARCH_NODE'),
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureCustomersIndex();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Elasticsearch error';
      this.logger.warn(`Customers index bootstrap skipped: ${message}`);
    }
  }

  getClient(): Client {
    return this.client;
  }

  async ensureCustomersIndex(): Promise<void> {
    if (!this.ensureCustomersIndexPromise) {
      this.ensureCustomersIndexPromise = this.createCustomersIndexIfMissing().catch(
        (error) => {
          this.ensureCustomersIndexPromise = undefined;
          throw error;
        },
      );
    }

    await this.ensureCustomersIndexPromise;
  }

  async indexCustomerDocument(
    customerId: string,
    document: Record<string, unknown>,
  ): Promise<void> {
    await this.ensureCustomersIndex();
    await this.client.index({
      index: CUSTOMERS_INDEX,
      id: customerId,
      document,
      refresh: 'wait_for',
    });
  }

  async bulkIndexCustomerDocuments(
    documents: Array<{ customerId: string; document: Record<string, unknown> }>,
  ): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    await this.ensureCustomersIndex();
    await this.client.bulk({
      refresh: 'wait_for',
      operations: documents.flatMap(({ customerId, document }) => [
        {
          index: {
            _index: CUSTOMERS_INDEX,
            _id: customerId,
          },
        },
        document,
      ]),
    });
  }

  async deleteCustomerDocument(customerId: string): Promise<void> {
    await this.client.delete({
      index: CUSTOMERS_INDEX,
      id: customerId,
      refresh: 'wait_for',
    });
  }

  async searchCustomerIdsByQuery(
    query: QueryDslQueryContainer,
  ): Promise<string[]> {
    await this.ensureCustomersIndex();

    const customerIds: string[] = [];
    let pointInTimeId: string | undefined;
    let searchAfter: FieldValue[] | undefined;

    try {
      const pointInTime = await this.client.openPointInTime({
        index: CUSTOMERS_INDEX,
        keep_alive: SEARCH_PIT_KEEP_ALIVE,
      });
      pointInTimeId = pointInTime.id;

      while (pointInTimeId) {
        // The official client overloads currently trip a TS compiler bug here during production builds.
        const searchRequest: SearchRequest = {
          size: SEARCH_PAGE_SIZE,
          query,
          _source: false,
          pit: {
            id: pointInTimeId,
            keep_alive: SEARCH_PIT_KEEP_ALIVE,
          },
          sort: ['_shard_doc'],
          ...(searchAfter ? { search_after: searchAfter } : {}),
        };
        const response = (await (this.client.search as (
          request: SearchRequest,
        ) => Promise<SearchResponse<Record<string, never>>>)(searchRequest)) as
          | SearchResponse<Record<string, never>>
          | undefined;

        if (!response) {
          break;
        }

        const hits = response.hits.hits;
        customerIds.push(
          ...hits
            .map((hit) => hit._id)
            .filter((id): id is string => typeof id === 'string'),
        );

        pointInTimeId = this.getPointInTimeId(response) ?? pointInTimeId;

        if (hits.length < SEARCH_PAGE_SIZE) {
          break;
        }

        const lastHit = hits.at(-1);
        if (!lastHit?.sort || lastHit.sort.length === 0) {
          break;
        }

        searchAfter = [...lastHit.sort];
      }
    } finally {
      await this.closePointInTime(pointInTimeId);
    }

    return customerIds;
  }

  private async createCustomersIndexIfMissing(): Promise<void> {
    const exists = await this.client.indices.exists({
      index: CUSTOMERS_INDEX,
    });

    if (exists) {
      return;
    }

    await this.client.indices.create({
      index: CUSTOMERS_INDEX,
      settings: customersIndexSettings,
      mappings: customersIndexMappings,
    });
  }

  private getPointInTimeId(
    response: SearchResponse<Record<string, never>>,
  ): string | undefined {
    const responseWithPit = response as SearchResponse<Record<string, never>> & {
      pit_id?: string;
    };

    return responseWithPit.pit_id;
  }

  private async closePointInTime(pointInTimeId: string | undefined): Promise<void> {
    if (!pointInTimeId) {
      return;
    }

    try {
      await this.client.closePointInTime({ id: pointInTimeId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Elasticsearch PIT close error';
      this.logger.warn(`Failed to close customers PIT ${pointInTimeId}: ${message}`);
    }
  }
}
