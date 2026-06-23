import { CustomersRepository } from "../customers/customers.repository";
import { OrdersRepository } from "../orders/orders.repository";
import { ProductsRepository } from "../products/products.repository";
import { RewardsRepository } from "../rewards/rewards.repository";
import { WalletService } from "../wallet/wallet.service";
import { PointsService } from "../points/points.service";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { SegmentConditionRow } from "./segments.types";

/**
 * Resolves customers who have a campaign_events row of `eventType` for a
 * given campaign. Injected (rather than imported) so the segments module
 * never depends on the campaigns module directly — campaigns depends on
 * segments, not the other way around.
 */
export type CampaignEventLookup = (
  campaignId: string,
  eventType: "sent" | "clicked",
) => Promise<Set<string>>;

export interface SegmentEvaluationDeps {
  customersRepository: CustomersRepository;
  ordersRepository: OrdersRepository;
  productsRepository: ProductsRepository;
  rewardsRepository: RewardsRepository;
  walletService: WalletService;
  pointsService: PointsService;
  loyaltyService: LoyaltyService;
  campaignEventLookup?: CampaignEventLookup;
}

/**
 * Every condition's `value` jsonb is normalized to either `{ value }` (for
 * gt/gte/lt/lte/eq) or `{ values: [...] }` (for `in`) — a single uniform
 * shape across all 16 condition types, rather than a bespoke shape per
 * type. Numeric fields compare as numbers; everything else compares as
 * strings (case-sensitive, exact).
 */
function matches(operator: string, actual: unknown, value: unknown): boolean {
  if (operator === "in") {
    const list = Array.isArray((value as { values?: unknown[] })?.values) ? (value as { values: unknown[] }).values : [];
    return list.some((v) => String(v) === String(actual));
  }
  const target = (value as { value?: unknown })?.value;
  if (operator === "eq") return String(actual) === String(target);
  const a = Number(actual);
  const t = Number(target);
  if (Number.isNaN(a) || Number.isNaN(t)) return false;
  switch (operator) {
    case "gt":
      return a > t;
    case "gte":
      return a >= t;
    case "lt":
      return a < t;
    case "lte":
      return a <= t;
    default:
      return false;
  }
}

function daysSince(dateIso: string | null): number {
  if (!dateIso) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(dateIso).getTime()) / (24 * 60 * 60 * 1000);
}

async function evaluateOne(condition: SegmentConditionRow, deps: SegmentEvaluationDeps): Promise<Set<string>> {
  const { rows: customers } = await deps.customersRepository.list({ page: 1, pageSize: 1_000_000 });
  const matched = new Set<string>();

  switch (condition.condition_type) {
    case "purchase_count": {
      for (const c of customers) {
        if (matches(condition.operator, c.purchase_count, condition.value)) matched.add(c.id);
      }
      return matched;
    }
    case "total_spent": {
      for (const c of customers) {
        if (matches(condition.operator, parseFloat(c.total_spent), condition.value)) matched.add(c.id);
      }
      return matched;
    }
    case "average_order_value": {
      for (const c of customers) {
        if (matches(condition.operator, parseFloat(c.average_order_value), condition.value)) matched.add(c.id);
      }
      return matched;
    }
    case "last_purchase_at":
    case "churn_risk": {
      for (const c of customers) {
        if (matches(condition.operator, daysSince(c.last_purchase_at), condition.value)) matched.add(c.id);
      }
      return matched;
    }
    case "city": {
      for (const c of customers) {
        if (matches(condition.operator, (c as { city?: string | null }).city ?? null, condition.value)) {
          matched.add(c.id);
        }
      }
      return matched;
    }
    case "gender": {
      for (const c of customers) {
        if (matches(condition.operator, (c as { gender?: string | null }).gender ?? null, condition.value)) {
          matched.add(c.id);
        }
      }
      return matched;
    }
    case "tier": {
      for (const c of customers) {
        const status = await deps.loyaltyService.getCustomerStatus(c.id);
        if (matches(condition.operator, status.currentTier?.name ?? null, condition.value)) matched.add(c.id);
      }
      return matched;
    }
    case "wallet_balance": {
      for (const c of customers) {
        const wallet = await deps.walletService.getWalletSummary(c.id);
        if (matches(condition.operator, wallet.availableBalanceCents, condition.value)) matched.add(c.id);
      }
      return matched;
    }
    case "points": {
      for (const c of customers) {
        const balance = await deps.pointsService.getBalance(c.id);
        if (matches(condition.operator, balance.balance, condition.value)) matched.add(c.id);
      }
      return matched;
    }
    case "reward_status": {
      for (const c of customers) {
        const { rows: claims } = await deps.rewardsRepository.listClaims({ page: 1, pageSize: 1000 }, c.id);
        if (claims.some((claim) => matches(condition.operator, claim.status, condition.value))) matched.add(c.id);
      }
      return matched;
    }
    case "campaign_received":
    case "campaign_clicked": {
      const campaignId = String((condition.value as { value?: unknown })?.value ?? "");
      if (!campaignId || !deps.campaignEventLookup) return matched;
      const eventType = condition.condition_type === "campaign_received" ? "sent" : "clicked";
      return deps.campaignEventLookup(campaignId, eventType);
    }
    case "woocommerce_product_bought": {
      const productId = String((condition.value as { value?: unknown })?.value ?? "");
      for (const c of customers) {
        const orders = await deps.ordersRepository.listByCustomer(c.id);
        for (const order of orders) {
          const items = await deps.ordersRepository.listItems(order.id);
          if (items.some((item) => item.woocommerce_product_id === productId)) {
            matched.add(c.id);
            break;
          }
        }
      }
      return matched;
    }
    case "woocommerce_category_bought": {
      const categoryId = String((condition.value as { value?: unknown })?.value ?? "");
      for (const c of customers) {
        const orders = await deps.ordersRepository.listByCustomer(c.id);
        outer: for (const order of orders) {
          const items = await deps.ordersRepository.listItems(order.id);
          for (const item of items) {
            if (!item.woocommerce_product_id) continue;
            const product = await deps.productsRepository.findByWoocommerceProductId(item.woocommerce_product_id);
            if (product?.category_woocommerce_ids?.includes(categoryId)) {
              matched.add(c.id);
              break outer;
            }
          }
        }
      }
      return matched;
    }
    case "coupon_used": {
      const code = (condition.value as { value?: unknown })?.value;
      for (const c of customers) {
        const orders = await deps.ordersRepository.listByCustomer(c.id);
        const usedCoupon = orders.some((order) => {
          const couponLines = (order.raw as { coupon_lines?: Array<{ code?: string }> })?.coupon_lines;
          if (!Array.isArray(couponLines) || couponLines.length === 0) return false;
          if (code === undefined || code === null || code === "") return true;
          return couponLines.some((line) => line.code === code);
        });
        if (usedCoupon) matched.add(c.id);
      }
      return matched;
    }
    default:
      return matched;
  }
}

/**
 * AND-only across all of a segment's conditions (no OR groups — out of
 * scope this phase): each condition is evaluated independently into a
 * Set<customerId>, then every set is intersected. A segment with zero
 * conditions matches zero customers (an explicit condition is always
 * required to populate a dynamic segment).
 */
export async function evaluateSegmentConditions(
  conditions: SegmentConditionRow[],
  deps: SegmentEvaluationDeps,
): Promise<Set<string>> {
  if (conditions.length === 0) return new Set();

  let result: Set<string> | null = null;
  for (const condition of conditions) {
    const matched = await evaluateOne(condition, deps);
    if (result === null) {
      result = matched;
    } else {
      const intersected = new Set<string>();
      for (const id of result) {
        if (matched.has(id)) intersected.add(id);
      }
      result = intersected;
    }
    if (result.size === 0) break;
  }
  return result ?? new Set();
}
