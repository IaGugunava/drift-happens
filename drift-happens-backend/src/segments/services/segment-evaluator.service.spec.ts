import { Types } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { SegmentEvaluatorService } from './segment-evaluator.service';
import type { Segment } from '../schemas/segment.schema';
import type { SegmentEvent } from '../schemas/segment-event.schema';

describe('SegmentEvaluatorService', () => {
  it('skips static segments unless forced', async () => {
    const segmentModel = createSegmentModelMock({
      _id: new Types.ObjectId(),
      id: '6640ef6deeb28a6e5d41e101',
      type: 'static',
      rules: { type: 'DATE_WITHIN', field: 'createdAt', days: 30 },
      memberIds: [],
    });
    const segmentEventModel = createSegmentEventModelMock();
    const ruleTranslatorService = {
      translate: jest.fn(),
    };
    const searchService = {
      searchCustomerIdsByQuery: jest.fn(),
    };
    const eventPublisherService = {
      publishSegmentDelta: jest.fn(),
    };
    const service = new SegmentEvaluatorService(
      segmentModel,
      segmentEventModel,
      ruleTranslatorService as never,
      searchService as never,
      eventPublisherService as never,
    );

    await expect(service.evaluateSegment('6640ef6deeb28a6e5d41e101')).resolves.toBeNull();
    expect(ruleTranslatorService.translate).not.toHaveBeenCalled();
    expect(searchService.searchCustomerIdsByQuery).not.toHaveBeenCalled();
    expect(segmentModel.updateOne).not.toHaveBeenCalled();
    expect(segmentEventModel.create).not.toHaveBeenCalled();
    expect(eventPublisherService.publishSegmentDelta).not.toHaveBeenCalled();
  });

  it('persists membership deltas and audit events for dynamic segments', async () => {
    const segmentId = new Types.ObjectId();
    const keptCustomerId = new Types.ObjectId();
    const removedCustomerId = new Types.ObjectId();
    const addedCustomerId = new Types.ObjectId();
    const segmentModel = createSegmentModelMock({
      _id: segmentId,
      id: segmentId.toString(),
      name: 'VIP Clients',
      type: 'dynamic',
      rules: { type: 'FIELD', field: 'totalSpent', op: 'gte', value: 5000 },
      memberIds: [keptCustomerId, removedCustomerId],
    });
    const segmentEventModel = createSegmentEventModelMock();
    const translatedQuery = {
      range: {
        totalSpent: {
          gte: 5000,
        },
      },
    };
    const ruleTranslatorService = {
      translate: jest.fn().mockResolvedValue(translatedQuery),
    };
    const searchService = {
      searchCustomerIdsByQuery: jest
        .fn()
        .mockResolvedValue([keptCustomerId.toString(), addedCustomerId.toString()]),
    };
    const eventPublisherService = {
      publishSegmentDelta: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SegmentEvaluatorService(
      segmentModel,
      segmentEventModel,
      ruleTranslatorService as never,
      searchService as never,
      eventPublisherService as never,
    );

    await expect(
      service.evaluateSegment(segmentId.toString(), {
        triggeredBy: 'cascade',
      }),
    ).resolves.toEqual({
      segmentId: segmentId.toString(),
      segmentName: 'VIP Clients',
      evaluatedAt: expect.any(String),
      added: [addedCustomerId.toString()],
      removed: [removedCustomerId.toString()],
      addedCount: 1,
      removedCount: 1,
      totalCount: 2,
      triggeredBy: 'cascade',
    });

    expect(ruleTranslatorService.translate).toHaveBeenCalledWith({
      type: 'FIELD',
      field: 'totalSpent',
      op: 'gte',
      value: 5000,
    });
    expect(searchService.searchCustomerIdsByQuery).toHaveBeenCalledWith(translatedQuery);
    expect(segmentModel.updateOne).toHaveBeenCalledWith(
      { _id: segmentId },
      {
        $set: expect.objectContaining({
          memberIds: [
            expect.any(Types.ObjectId),
            expect.any(Types.ObjectId),
          ],
          memberCount: 2,
          lastEvaluatedAt: expect.any(Date),
        }),
      },
    );
    expect(segmentEventModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId,
        evaluatedAt: expect.any(Date),
        addedIds: [expect.any(Types.ObjectId)],
        removedIds: [expect.any(Types.ObjectId)],
        addedCount: 1,
        removedCount: 1,
        totalCount: 2,
        triggeredBy: 'cascade',
      }),
    );
    expect(eventPublisherService.publishSegmentDelta).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: segmentId.toString(),
        segmentName: 'VIP Clients',
        added: [addedCustomerId.toString()],
        removed: [removedCustomerId.toString()],
        addedCount: 1,
        removedCount: 1,
        totalCount: 2,
        triggeredBy: 'cascade',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-cascade-depth': 0,
          'x-visited-segment-ids': JSON.stringify([segmentId.toString()]),
        }),
      }),
    );
  });

  it('returns null when evaluation produces no membership changes', async () => {
    const segmentId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const segmentModel = createSegmentModelMock({
      _id: segmentId,
      id: segmentId.toString(),
      type: 'dynamic',
      rules: { type: 'DATE_WITHIN', field: 'lastTransactionAt', days: 30 },
      memberIds: [customerId],
    });
    const segmentEventModel = createSegmentEventModelMock();
    const ruleTranslatorService = {
      translate: jest.fn().mockResolvedValue({
        range: {
          lastTransactionAt: {
            gte: 'now-30d/d',
          },
        },
      }),
    };
    const searchService = {
      searchCustomerIdsByQuery: jest.fn().mockResolvedValue([customerId.toString()]),
    };
    const eventPublisherService = {
      publishSegmentDelta: jest.fn(),
    };
    const service = new SegmentEvaluatorService(
      segmentModel,
      segmentEventModel,
      ruleTranslatorService as never,
      searchService as never,
      eventPublisherService as never,
    );

    await expect(service.evaluateSegment(segmentId.toString())).resolves.toBeNull();
    expect(segmentModel.updateOne).not.toHaveBeenCalled();
    expect(segmentEventModel.create).not.toHaveBeenCalled();
    expect(eventPublisherService.publishSegmentDelta).not.toHaveBeenCalled();
  });

  it('throws when the requested segment does not exist', async () => {
    const segmentModel = createSegmentModelMock(null);
    const segmentEventModel = createSegmentEventModelMock();
    const service = new SegmentEvaluatorService(
      segmentModel,
      segmentEventModel,
      { translate: jest.fn() } as never,
      { searchCustomerIdsByQuery: jest.fn() } as never,
      { publishSegmentDelta: jest.fn() } as never,
    );

    await expect(service.evaluateSegment(new Types.ObjectId().toString())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

type MockSegmentDocument = Pick<Segment, 'name' | 'type' | 'rules' | 'memberIds'> & {
  _id: Types.ObjectId;
  id: string;
};

function createSegmentModelMock(segment: MockSegmentDocument | null) {
  return {
    findById: jest.fn(() => ({
      exec: jest.fn().mockResolvedValue(segment),
    })),
    updateOne: jest.fn(() => ({
      exec: jest.fn().mockResolvedValue({
        acknowledged: true,
        modifiedCount: 1,
      }),
    })),
  } as unknown as {
    findById: jest.Mock;
    updateOne: jest.Mock;
  };
}

function createSegmentEventModelMock() {
  return {
    create: jest.fn(async (payload: Partial<SegmentEvent>) => payload),
  } as unknown as {
    create: jest.Mock;
  };
}
