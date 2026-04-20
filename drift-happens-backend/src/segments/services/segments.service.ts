import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from '../../customers/schemas/customer.schema';
import { Segment, SegmentDocument } from '../schemas/segment.schema';
import { SegmentEvent } from '../schemas/segment-event.schema';
import type { RuleNode } from '../types/rule-node.type';
import { SegmentDependencyService } from './segment-dependency.service';
import { SegmentEvaluatorService } from './segment-evaluator.service';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateSegmentInput {
  name: string;
  type: 'dynamic' | 'static';
  rules: RuleNode;
  frozenAt?: Date | null;
}

export interface UpdateSegmentInput {
  name?: string;
  type?: 'dynamic' | 'static';
  rules?: RuleNode;
  frozenAt?: Date | null;
  memberIds?: Segment['memberIds'];
  memberCount?: number;
  lastEvaluatedAt?: Date | null;
}

@Injectable()
export class SegmentsService {
  constructor(
    @InjectModel(Segment.name)
    private readonly segmentModel: Model<Segment>,
    @InjectModel(SegmentEvent.name)
    private readonly segmentEventModel: Model<SegmentEvent>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<Customer>,
    private readonly segmentDependencyService: SegmentDependencyService,
    private readonly segmentEvaluatorService: SegmentEvaluatorService,
  ) {}

  async list(
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<SegmentDocument>> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.segmentModel
        .find()
        .sort({ name: 1 })
        .skip(skip)
        .limit(pageSize)
        .exec(),
      this.segmentModel.countDocuments().exec(),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async create(input: CreateSegmentInput): Promise<SegmentDocument> {
    const segment = await this.segmentModel.create({
      ...input,
      memberIds: [],
      memberCount: 0,
      frozenAt: input.frozenAt ?? null,
      lastEvaluatedAt: null,
      dependsOnSegments: [],
    });

    await this.segmentDependencyService.refreshDependenciesForSegment(segment.id);

    if (input.type === 'static') {
      await this.refreshStaticSegment(segment.id);
    } else {
      await this.segmentEvaluatorService.evaluateSegment(segment.id, {
        triggeredBy: 'manual',
      });
    }

    return this.findByIdOrThrow(segment.id);
  }

  async update(
    segmentId: string,
    updates: UpdateSegmentInput,
  ): Promise<SegmentDocument> {
    const segment = await this.segmentModel
      .findByIdAndUpdate(segmentId, updates, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!segment) {
      throw new NotFoundException(`Segment ${segmentId} not found`);
    }

    await this.segmentDependencyService.refreshDependenciesForSegment(segment.id);

    if (segment.type === 'dynamic') {
      await this.segmentEvaluatorService.evaluateSegment(segment.id, {
        triggeredBy: 'manual',
      });
    }

    return this.findByIdOrThrow(segment.id);
  }

  async findById(segmentId: string): Promise<SegmentDocument | null> {
    return this.segmentModel.findById(segmentId).exec();
  }

  async findByIdOrThrow(segmentId: string): Promise<SegmentDocument> {
    const segment = await this.findById(segmentId);

    if (!segment) {
      throw new NotFoundException(`Segment ${segmentId} not found`);
    }

    return segment;
  }

  async listMembers(
    segmentId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<CustomerDocument>> {
    const segment = await this.findByIdOrThrow(segmentId);
    const start = (page - 1) * pageSize;
    const memberIds = segment.memberIds.slice(start, start + pageSize);

    const customers = await this.customerModel
      .find({
        _id: {
          $in: memberIds,
        },
      })
      .exec();

    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const orderedCustomers = memberIds
      .map((memberId) => customerById.get(memberId.toString()))
      .filter((customer): customer is CustomerDocument => Boolean(customer));

    return {
      items: orderedCustomers,
      total: segment.memberIds.length,
      page,
      pageSize,
    };
  }

  async listEvents(
    segmentId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<SegmentEvent>> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.segmentEventModel
        .find({ segmentId })
        .sort({ evaluatedAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .exec(),
      this.segmentEventModel.countDocuments({ segmentId }).exec(),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async refreshStaticSegment(segmentId: string) {
    const segment = await this.findByIdOrThrow(segmentId);

    if (segment.type !== 'static') {
      throw new BadRequestException('Only static segments can be refreshed manually');
    }

    return this.segmentEvaluatorService.evaluateSegment(segment.id, {
      force: true,
      triggeredBy: 'manual',
      persistEvenIfUnchanged: true,
    });
  }
}
