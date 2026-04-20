import { Types } from 'mongoose';
import { DebounceSchedulerService } from './debounce-scheduler.service';

describe('DebounceSchedulerService', () => {
  it('does nothing when there are no pending customer changes', async () => {
    const changeBufferService = {
      consumePendingCustomerIds: jest.fn().mockResolvedValue([]),
    };
    const segmentEvaluatorService = {
      evaluateSegment: jest.fn(),
    };
    const segmentModel = createSegmentModelMock([]);
    const service = new DebounceSchedulerService(
      changeBufferService as never,
      segmentEvaluatorService as never,
      segmentModel as never,
    );

    await service.flushPendingChanges();

    expect(segmentModel.find).not.toHaveBeenCalled();
    expect(segmentEvaluatorService.evaluateSegment).not.toHaveBeenCalled();
  });

  it('re-evaluates all dynamic segments when buffered changes exist', async () => {
    const firstSegmentId = new Types.ObjectId();
    const secondSegmentId = new Types.ObjectId();
    const changeBufferService = {
      consumePendingCustomerIds: jest.fn().mockResolvedValue(['customer-1']),
    };
    const segmentEvaluatorService = {
      evaluateSegment: jest.fn().mockResolvedValue(null),
    };
    const segmentModel = createSegmentModelMock([
      { _id: firstSegmentId },
      { _id: secondSegmentId },
    ]);
    const service = new DebounceSchedulerService(
      changeBufferService as never,
      segmentEvaluatorService as never,
      segmentModel as never,
    );

    await service.flushPendingChanges();

    expect(segmentModel.find).toHaveBeenCalledWith({ type: 'dynamic' });
    expect(segmentEvaluatorService.evaluateSegment).toHaveBeenNthCalledWith(
      1,
      firstSegmentId.toString(),
      {
        triggeredBy: 'data_change',
      },
    );
    expect(segmentEvaluatorService.evaluateSegment).toHaveBeenNthCalledWith(
      2,
      secondSegmentId.toString(),
      {
        triggeredBy: 'data_change',
      },
    );
  });
});

function createSegmentModelMock(segments: unknown[]) {
  return {
    find: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(segments),
    })),
  };
}
