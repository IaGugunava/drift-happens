export interface CampaignLogEntry {
  id: string;
  segmentId: string;
  segmentName: string;
  evaluatedAt: string;
  added: string[];
  removed: string[];
  addedCount: number;
  removedCount: number;
  totalCount: number;
  message: string;
}
