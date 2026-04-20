import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { CustomerDocument } from '../customers/schemas/customer.schema';
import type { SegmentEvent } from './schemas/segment-event.schema';
import type { SegmentDocument } from './schemas/segment.schema';
import { SegmentsService } from './services/segments.service';
import type { RuleNode } from './types/rule-node.type';

class CreateSegmentDto {
  @IsString()
  name!: string;

  @IsIn(['dynamic', 'static'])
  type!: 'dynamic' | 'static';

  @IsObject()
  rules!: Record<string, unknown>;
}

class UpdateSegmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['dynamic', 'static'])
  type?: 'dynamic' | 'static';

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;
}

@Controller('segments')
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Get()
  async listSegments(@Query() query: PaginationQueryDto) {
    const result = await this.segmentsService.list(query.page, query.pageSize);

    return {
      ...result,
      items: result.items.map((segment) => this.toSegmentResponse(segment)),
    };
  }

  @Post()
  async createSegment(@Body() body: CreateSegmentDto) {
    const segment = await this.segmentsService.create({
      name: body.name,
      type: body.type,
      rules: body.rules as unknown as RuleNode,
    });

    return this.toSegmentResponse(segment);
  }

  @Get(':id')
  async getSegment(@Param('id') segmentId: string) {
    const segment = await this.segmentsService.findByIdOrThrow(segmentId);
    return this.toSegmentResponse(segment);
  }

  @Patch(':id')
  async updateSegment(
    @Param('id') segmentId: string,
    @Body() body: UpdateSegmentDto,
  ) {
    const segment = await this.segmentsService.update(segmentId, {
      name: body.name,
      type: body.type,
      rules: body.rules as unknown as RuleNode | undefined,
    });

    return this.toSegmentResponse(segment);
  }

  @Get(':id/members')
  async getSegmentMembers(
    @Param('id') segmentId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const result = await this.segmentsService.listMembers(
      segmentId,
      query.page,
      query.pageSize,
    );

    return {
      ...result,
      items: result.items.map((customer) => this.toCustomerResponse(customer)),
    };
  }

  @Get(':id/events')
  async getSegmentEvents(
    @Param('id') segmentId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const result = await this.segmentsService.listEvents(
      segmentId,
      query.page,
      query.pageSize,
    );

    return {
      ...result,
      items: result.items.map((event) => this.toSegmentEventResponse(event)),
    };
  }

  @Post(':id/refresh')
  async refreshStaticSegment(@Param('id') segmentId: string) {
    const result = await this.segmentsService.refreshStaticSegment(segmentId);
    const segment = await this.segmentsService.findByIdOrThrow(segmentId);

    return {
      segment: this.toSegmentResponse(segment),
      delta: result,
    };
  }

  private toSegmentResponse(segment: SegmentDocument) {
    return {
      id: segment.id,
      name: segment.name,
      type: segment.type,
      rules: segment.rules,
      memberIds: segment.memberIds.map((memberId) => memberId.toString()),
      memberCount: segment.memberCount,
      frozenAt: segment.frozenAt?.toISOString() ?? null,
      lastEvaluatedAt: segment.lastEvaluatedAt?.toISOString() ?? null,
      dependsOnSegments: segment.dependsOnSegments.map((dependencyId) =>
        dependencyId.toString(),
      ),
    };
  }

  private toCustomerResponse(customer: CustomerDocument) {
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      totalSpent: customer.totalSpent,
      lastTransactionAt: customer.lastTransactionAt?.toISOString() ?? null,
      tags: customer.tags,
      createdAt: customer.createdAt.toISOString(),
    };
  }

  private toSegmentEventResponse(event: SegmentEvent) {
    return {
      id: 'id' in event ? String(event.id) : '',
      segmentId: event.segmentId.toString(),
      evaluatedAt: event.evaluatedAt.toISOString(),
      addedIds: event.addedIds.map((id) => id.toString()),
      removedIds: event.removedIds.map((id) => id.toString()),
      addedCount: event.addedCount,
      removedCount: event.removedCount,
      totalCount: event.totalCount,
      triggeredBy: event.triggeredBy,
    };
  }
}
