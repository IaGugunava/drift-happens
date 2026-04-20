import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RedisService } from '../../redis/redis.service';
import { Segment } from '../schemas/segment.schema';
import { collectSegmentDependencies } from '../types/rule-node.utils';

const SEGMENT_DEPENDENTS_KEY_PREFIX = 'segment:dependents:';

interface SegmentDependencyRecord {
  _id: Types.ObjectId;
  name: string;
  rules: Segment['rules'];
  dependsOnSegments: Types.ObjectId[];
}

@Injectable()
export class SegmentDependencyService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(Segment.name)
    private readonly segmentModel: Model<Segment>,
    private readonly redisService: RedisService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.rebuildDependencyGraph();
  }

  async rebuildDependencyGraph(): Promise<void> {
    const segments = await this.segmentModel
      .find()
      .select({
        _id: 1,
        name: 1,
        rules: 1,
        dependsOnSegments: 1,
      })
      .lean<SegmentDependencyRecord[]>()
      .exec();

    const segmentIdsByName = new Map(
      segments.map((segment) => [segment.name, segment._id.toString()]),
    );
    const reverseDependencies = new Map<string, Set<string>>();

    for (const segment of segments) {
      const resolvedDependencyIds = this.resolveDependencyIds(
        collectSegmentDependencies(segment.rules),
        segmentIdsByName,
      );

      await this.syncStoredDependencies(segment, resolvedDependencyIds);

      for (const dependencyId of resolvedDependencyIds) {
        if (!reverseDependencies.has(dependencyId)) {
          reverseDependencies.set(dependencyId, new Set());
        }

        reverseDependencies.get(dependencyId)?.add(segment._id.toString());
      }
    }

    await this.redisService.deleteKeysByPattern(`${SEGMENT_DEPENDENTS_KEY_PREFIX}*`);

    for (const [segmentId, dependentIds] of reverseDependencies.entries()) {
      await this.redisService.replaceSetMembers(
        this.getDependentsKey(segmentId),
        [...dependentIds],
      );
    }
  }

  async refreshDependenciesForSegment(_segmentId: string): Promise<void> {
    await this.rebuildDependencyGraph();
  }

  async getDependentSegmentIds(segmentId: string): Promise<string[]> {
    return this.redisService.getSetMembers(this.getDependentsKey(segmentId));
  }

  private resolveDependencyIds(
    references: string[],
    segmentIdsByName: Map<string, string>,
  ): string[] {
    return [...new Set(
      references
        .map((reference) =>
          Types.ObjectId.isValid(reference) ? reference : segmentIdsByName.get(reference),
        )
        .filter((value): value is string => Boolean(value)),
    )];
  }

  private async syncStoredDependencies(
    segment: SegmentDependencyRecord,
    resolvedDependencyIds: string[],
  ): Promise<void> {
    const currentDependencyIds = [...new Set(segment.dependsOnSegments.map((id) => id.toString()))];

    if (this.areSameDependencies(currentDependencyIds, resolvedDependencyIds)) {
      return;
    }

    await this.segmentModel
      .updateOne(
        { _id: segment._id },
        {
          $set: {
            dependsOnSegments: resolvedDependencyIds.map((id) => new Types.ObjectId(id)),
          },
        },
      )
      .exec();
  }

  private areSameDependencies(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    const leftSorted = [...left].sort();
    const rightSorted = [...right].sort();

    return leftSorted.every((value, index) => value === rightSorted[index]);
  }

  private getDependentsKey(segmentId: string): string {
    return `${SEGMENT_DEPENDENTS_KEY_PREFIX}${segmentId}`;
  }
}
