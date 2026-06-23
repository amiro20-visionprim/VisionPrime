import {
  ListParams,
  ListResult,
  NewSegmentRecord,
  SegmentConditionRow,
  SegmentMemberRow,
  SegmentRow,
  UpdateSegmentRecord,
} from "./segments.types";

export interface SegmentsRepository {
  list(params: ListParams): Promise<ListResult<SegmentRow>>;
  findById(id: string): Promise<SegmentRow | null>;
  create(record: NewSegmentRecord): Promise<SegmentRow>;
  update(id: string, record: UpdateSegmentRecord): Promise<SegmentRow | null>;
  softDelete(id: string): Promise<boolean>;
  touchLastEvaluatedAt(id: string): Promise<void>;

  listConditions(segmentId: string): Promise<SegmentConditionRow[]>;
  /** Replaces every condition row for a segment (delete + re-insert). */
  replaceConditions(segmentId: string, conditions: NewSegmentRecord["conditions"]): Promise<SegmentConditionRow[]>;

  listMembers(segmentId: string, params: ListParams): Promise<ListResult<SegmentMemberRow>>;
  countMembers(segmentId: string): Promise<number>;
  /** Clears and re-inserts membership — used both by dynamic-segment
   * evaluate() and by static-segment explicit member management. */
  replaceMembers(segmentId: string, customerIds: string[]): Promise<void>;
  addMembers(segmentId: string, customerIds: string[]): Promise<void>;
  removeMembers(segmentId: string, customerIds: string[]): Promise<void>;
  listAllMemberCustomerIds(segmentId: string): Promise<string[]>;
}
