export const SEGMENT_EVENTS_EXCHANGE = 'segment.events';

export const segmentEventQueues = {
  ui: 'segment.ui',
  campaign: 'segment.campaign',
  cascade: 'segment.cascade',
} as const;

export const SEGMENT_EVENT_ROUTING_PATTERN = 'segment.*.updated';

export function getSegmentUpdatedRoutingKey(segmentId: string): string {
  return `segment.${segmentId}.updated`;
}
