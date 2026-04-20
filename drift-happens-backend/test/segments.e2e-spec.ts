import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { Customer } from '../src/customers/schemas/customer.schema';
import { EventPublisherService } from '../src/events/services/event-publisher.service';
import { SearchService } from '../src/search/search.service';
import { SegmentsController } from '../src/segments/segments.controller';
import { SegmentEvent } from '../src/segments/schemas/segment-event.schema';
import { Segment } from '../src/segments/schemas/segment.schema';
import { RuleTranslatorService } from '../src/segments/services/rule-translator.service';
import { SegmentDependencyService } from '../src/segments/services/segment-dependency.service';
import { SegmentEvaluatorService } from '../src/segments/services/segment-evaluator.service';
import { SegmentsService } from '../src/segments/services/segments.service';

describe('SegmentsController exact delta (e2e)', () => {
  let app: INestApplication<App>;

  const removedCustomerId = new Types.ObjectId().toString();
  const retainedCustomerIds = Array.from({ length: 10_000 }, () => new Types.ObjectId().toString());
  const addedCustomerIds = [new Types.ObjectId().toString(), new Types.ObjectId().toString()];
  const nextMemberIds = [...retainedCustomerIds, ...addedCustomerIds];
  const segmentId = new Types.ObjectId().toString();

  const segmentState = {
    _id: new Types.ObjectId(segmentId),
    id: segmentId,
    name: 'March Campaign',
    type: 'static' as const,
    rules: {
      type: 'DATE_WITHIN',
      field: 'createdAt',
      days: 31,
    },
    memberIds: [removedCustomerId, ...retainedCustomerIds].map((id) => new Types.ObjectId(id)),
    memberCount: 10_001,
    frozenAt: new Date('2026-03-01T00:00:00.000Z'),
    lastEvaluatedAt: new Date('2026-03-01T00:00:00.000Z'),
    dependsOnSegments: [],
  };

  const segmentModel = {
    findById: jest.fn((id: string) => ({
      exec: jest.fn().mockResolvedValue(id === segmentId ? snapshotSegmentState() : null),
    })),
    updateOne: jest.fn((_filter: unknown, update: { $set: Record<string, unknown> }) => ({
      exec: jest.fn().mockImplementation(async () => {
        const set = update.$set;
        segmentState.memberIds = (set.memberIds as Types.ObjectId[]) ?? segmentState.memberIds;
        segmentState.memberCount = (set.memberCount as number) ?? segmentState.memberCount;
        segmentState.lastEvaluatedAt =
          (set.lastEvaluatedAt as Date) ?? segmentState.lastEvaluatedAt;
        segmentState.frozenAt = (set.frozenAt as Date) ?? segmentState.frozenAt;

        return {
          acknowledged: true,
          modifiedCount: 1,
        };
      }),
    })),
  };

  const segmentEventModel = {
    create: jest.fn(async (payload: unknown) => payload),
  };

  const customerModel = {};

  const searchService = {
    searchCustomerIdsByQuery: jest.fn().mockResolvedValue(nextMemberIds),
  };

  const eventPublisherService = {
    publishSegmentDelta: jest.fn().mockResolvedValue(undefined),
  };

  const segmentDependencyService = {
    refreshDependenciesForSegment: jest.fn().mockResolvedValue(undefined),
    getDependentSegmentIds: jest.fn().mockResolvedValue([]),
  };

  function snapshotSegmentState() {
    return {
      ...segmentState,
      memberIds: [...segmentState.memberIds],
      dependsOnSegments: [...segmentState.dependsOnSegments],
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    segmentState.memberIds = [removedCustomerId, ...retainedCustomerIds].map(
      (id) => new Types.ObjectId(id),
    );
    segmentState.memberCount = 10_001;
    segmentState.frozenAt = new Date('2026-03-01T00:00:00.000Z');
    segmentState.lastEvaluatedAt = new Date('2026-03-01T00:00:00.000Z');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SegmentsController],
      providers: [
        SegmentsService,
        SegmentEvaluatorService,
        RuleTranslatorService,
        {
          provide: getModelToken(Segment.name),
          useValue: segmentModel,
        },
        {
          provide: getModelToken(SegmentEvent.name),
          useValue: segmentEventModel,
        },
        {
          provide: getModelToken(Customer.name),
          useValue: customerModel,
        },
        {
          provide: SearchService,
          useValue: searchService,
        },
        {
          provide: EventPublisherService,
          useValue: eventPublisherService,
        },
        {
          provide: SegmentDependencyService,
          useValue: segmentDependencyService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the exact added and removed customer ids for a segment refresh larger than 10k members', async () => {
    const response = await request(app.getHttpServer())
      .post(`/segments/${segmentId}/refresh`)
      .expect(201);

    expect(response.body.delta).toEqual(
      expect.objectContaining({
        segmentId,
        added: addedCustomerIds,
        removed: [removedCustomerId],
        addedCount: 2,
        removedCount: 1,
        totalCount: 10_002,
        triggeredBy: 'manual',
      }),
    );
    expect(response.body.segment).toEqual(
      expect.objectContaining({
        id: segmentId,
        type: 'static',
        memberCount: 10_002,
      }),
    );
    expect(segmentEventModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        addedCount: 2,
        removedCount: 1,
        totalCount: 10_002,
        triggeredBy: 'manual',
      }),
    );
    expect(eventPublisherService.publishSegmentDelta).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId,
        added: addedCustomerIds,
        removed: [removedCustomerId],
      }),
      expect.any(Object),
    );
  });
});
