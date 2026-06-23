export type SegmentType = "dynamic" | "static";

export type SegmentConditionType =
  | "purchase_count"
  | "total_spent"
  | "last_purchase_at"
  | "average_order_value"
  | "city"
  | "gender"
  | "tier"
  | "wallet_balance"
  | "points"
  | "reward_status"
  | "campaign_received"
  | "campaign_clicked"
  | "churn_risk"
  | "woocommerce_product_bought"
  | "woocommerce_category_bought"
  | "coupon_used";

export type SegmentConditionOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "in";

export interface SegmentRow {
  id: string;
  name: string;
  description: string | null;
  segment_type: SegmentType;
  is_active: boolean;
  last_evaluated_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SegmentConditionRow {
  id: string;
  segment_id: string;
  condition_type: SegmentConditionType;
  operator: SegmentConditionOperator;
  value: unknown;
  created_at: string;
}

export interface SegmentMemberRow {
  id: string;
  segment_id: string;
  customer_id: string;
  added_at: string;
}

export interface NewSegmentConditionRecord {
  conditionType: SegmentConditionType;
  operator: SegmentConditionOperator;
  value: unknown;
}

export interface NewSegmentRecord {
  name: string;
  description?: string | null;
  segmentType: SegmentType;
  isActive?: boolean;
  conditions?: NewSegmentConditionRecord[];
  /** Only meaningful for segmentType = 'static': the initial member set. */
  memberCustomerIds?: string[];
}

export interface UpdateSegmentRecord {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  conditions?: NewSegmentConditionRecord[];
}

export interface PublicSegmentCondition {
  id: string;
  conditionType: SegmentConditionType;
  operator: SegmentConditionOperator;
  value: unknown;
}

export interface PublicSegment {
  id: string;
  name: string;
  description: string | null;
  segmentType: SegmentType;
  isActive: boolean;
  lastEvaluatedAt: string | null;
  conditions: PublicSegmentCondition[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export function toPublicSegmentCondition(row: SegmentConditionRow): PublicSegmentCondition {
  return {
    id: row.id,
    conditionType: row.condition_type,
    operator: row.operator,
    value: row.value,
  };
}

export function toPublicSegment(
  row: SegmentRow,
  conditions: SegmentConditionRow[],
  memberCount: number,
): PublicSegment {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    segmentType: row.segment_type,
    isActive: row.is_active,
    lastEvaluatedAt: row.last_evaluated_at,
    conditions: conditions.map(toPublicSegmentCondition),
    memberCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PublicSegmentMember {
  customerId: string;
  addedAt: string;
}

export function toPublicSegmentMember(row: SegmentMemberRow): PublicSegmentMember {
  return { customerId: row.customer_id, addedAt: row.added_at };
}

export interface ListParams {
  page: number;
  pageSize: number;
}

export interface ListResult<T> {
  rows: T[];
  totalItems: number;
}
