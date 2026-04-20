import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  FieldValue,
  QueryDslQueryContainer,
} from '@elastic/elasticsearch/lib/api/types';
import { Model } from 'mongoose';
import { Segment } from '../schemas/segment.schema';
import type { FieldRuleNode, RuleNode } from '../types/rule-node.type';

@Injectable()
export class RuleTranslatorService {
  constructor(
    @InjectModel(Segment.name)
    private readonly segmentModel: Model<Segment>,
  ) {}

  async translate(rule: RuleNode): Promise<QueryDslQueryContainer> {
    switch (rule.type) {
      case 'AND':
        return {
          bool: {
            must: await Promise.all(rule.children.map((child) => this.translate(child))),
          },
        };
      case 'OR':
        return {
          bool: {
            should: await Promise.all(rule.children.map((child) => this.translate(child))),
            minimum_should_match: 1,
          },
        };
      case 'NOT':
        return {
          bool: {
            must_not: [await this.translate(rule.child)],
          },
        };
      case 'FIELD':
        return this.translateFieldRule(rule);
      case 'DATE_WITHIN':
        return {
          range: {
            [rule.field]: {
              gte: `now-${rule.days}d/d`,
            },
          },
        };
      case 'DATE_OLDER':
        return {
          range: {
            [rule.field]: {
              lt: `now-${rule.days}d/d`,
            },
          },
        };
      case 'IN_SEGMENT':
        return this.translateInSegmentRule(rule.segmentId);
    }
  }

  private translateFieldRule(rule: FieldRuleNode): QueryDslQueryContainer {
    const field = this.resolveFieldPath(rule.field, rule.op, rule.value);

    switch (rule.op) {
      case 'eq':
        return {
          term: {
            [field]: this.asFieldValue(rule.value),
          },
        };
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        return {
          range: {
            [rule.field]: {
              [rule.op]: rule.value,
            },
          },
        };
      case 'contains':
        return {
          wildcard: {
            [field]: {
              value: `*${String(rule.value)}*`,
              case_insensitive: true,
            },
          },
        };
    }
  }

  private async translateInSegmentRule(
    segmentId: string,
  ): Promise<QueryDslQueryContainer> {
    const segment = await this.segmentModel
      .findOne({
        $or: [{ _id: this.asObjectId(segmentId) }, { name: segmentId }],
      })
      .select({ memberIds: 1 })
      .lean()
      .exec();

    if (!segment || segment.memberIds.length === 0) {
      return {
        match_none: {},
      };
    }

    return {
      terms: {
        _id: segment.memberIds.map((memberId) => memberId.toString()),
      },
    };
  }

  private resolveFieldPath(
    field: string,
    op: FieldRuleNode['op'],
    value: unknown,
  ): string {
    if (op !== 'eq' && op !== 'contains') {
      return field;
    }

    if (field === 'tags' || field === 'email' || field === '_id') {
      return field;
    }

    if (typeof value === 'string') {
      return `${field}.keyword`;
    }

    return field;
  }

  private asObjectId(value: string) {
    return /^[a-f0-9]{24}$/i.test(value) ? value : null;
  }

  private asFieldValue(value: unknown): FieldValue {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return JSON.stringify(value);
  }
}
