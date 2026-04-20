import { Controller, Get, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CampaignLog } from './schemas/campaign-log.schema';

@Controller('campaigns')
export class CampaignsController {
  constructor(
    @InjectModel(CampaignLog.name)
    private readonly campaignLogModel: Model<CampaignLog>,
  ) {}

  @Get('log')
  async getCampaignLog(@Query() query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      this.campaignLogModel
        .find()
        .sort({ evaluatedAt: -1 })
        .skip(skip)
        .limit(query.pageSize)
        .exec(),
      this.campaignLogModel.countDocuments().exec(),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        segmentId: item.segmentId,
        segmentName: item.segmentName,
        evaluatedAt: item.evaluatedAt.toISOString(),
        added: item.added,
        removed: item.removed,
        addedCount: item.addedCount,
        removedCount: item.removedCount,
        totalCount: item.totalCount,
        message: item.message,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
