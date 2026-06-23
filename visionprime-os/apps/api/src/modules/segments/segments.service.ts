import { HttpError, NotFoundError } from "../../common/http-error";
import { AuditService, toPaginationMeta } from "../audit/audit.service";
import { evaluateSegmentConditions, SegmentEvaluationDeps } from "./segments.evaluation";
import { SegmentsRepository } from "./segments.repository";
import { NewSegmentRecord, toPublicSegment, toPublicSegmentMember, UpdateSegmentRecord } from "./segments.types";

export interface SegmentsActor {
  userId: string;
}

export interface SegmentsServiceDeps {
  segmentsRepository: SegmentsRepository;
  auditService: AuditService;
  evaluationDeps: SegmentEvaluationDeps;
}

export class SegmentsService {
  constructor(private readonly deps: SegmentsServiceDeps) {}

  private async toPublic(row: Awaited<ReturnType<SegmentsRepository["findById"]>>) {
    if (!row) return null;
    const [conditions, memberCount] = await Promise.all([
      this.deps.segmentsRepository.listConditions(row.id),
      this.deps.segmentsRepository.countMembers(row.id),
    ]);
    return toPublicSegment(row, conditions, memberCount);
  }

  async listSegments(page: number, pageSize: number) {
    const result = await this.deps.segmentsRepository.list({ page, pageSize });
    const rows = await Promise.all(result.rows.map((row) => this.toPublic(row)));
    return { rows: rows.filter((r): r is NonNullable<typeof r> => r !== null), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getSegment(id: string) {
    const row = await this.deps.segmentsRepository.findById(id);
    if (!row) throw new NotFoundError("Segment not found");
    return this.toPublic(row);
  }

  /** Looks up a segment's raw row + conditions for internal use by other
   * services (e.g. campaigns) without going through the public DTO. */
  async getSegmentForSend(id: string) {
    const row = await this.deps.segmentsRepository.findById(id);
    if (!row) throw new NotFoundError("Segment not found");
    return row;
  }

  async createSegment(record: NewSegmentRecord, actor: SegmentsActor) {
    if (record.segmentType === "dynamic" && record.memberCustomerIds?.length) {
      throw new HttpError(422, "VALIDATION_FAILED", "Dynamic segments cannot have an explicit member list — use conditions instead.");
    }
    const row = await this.deps.segmentsRepository.create(record);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "segment.create",
      targetType: "segment",
      targetId: row.id,
      before: null,
      after: { segment: row },
    });
    return this.toPublic(row);
  }

  async updateSegment(id: string, record: UpdateSegmentRecord, actor: SegmentsActor) {
    const before = await this.deps.segmentsRepository.findById(id);
    if (!before) throw new NotFoundError("Segment not found");
    const after = await this.deps.segmentsRepository.update(id, record);
    if (!after) throw new NotFoundError("Segment not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "segment.update",
      targetType: "segment",
      targetId: id,
      before: { segment: before },
      after: { segment: after },
    });
    return this.toPublic(after);
  }

  async deleteSegment(id: string, actor: SegmentsActor) {
    const before = await this.deps.segmentsRepository.findById(id);
    if (!before) throw new NotFoundError("Segment not found");
    await this.deps.segmentsRepository.softDelete(id);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "segment.delete",
      targetType: "segment",
      targetId: id,
      before: { segment: before },
      after: null,
    });
  }

  /**
   * For `dynamic` segments: recalculates membership from conditions and
   * overwrites segment_members entirely. For `static` segments: a no-op
   * on membership (it's only ever changed by explicit member management)
   * but still bumps last_evaluated_at so the UI can show "checked at".
   */
  async evaluateSegment(id: string, actor: SegmentsActor) {
    const segment = await this.deps.segmentsRepository.findById(id);
    if (!segment) throw new NotFoundError("Segment not found");

    let memberCount: number;
    if (segment.segment_type === "dynamic") {
      const conditions = await this.deps.segmentsRepository.listConditions(id);
      const matched = await evaluateSegmentConditions(conditions, this.deps.evaluationDeps);
      const customerIds = Array.from(matched);
      await this.deps.segmentsRepository.replaceMembers(id, customerIds);
      memberCount = customerIds.length;
    } else {
      memberCount = await this.deps.segmentsRepository.countMembers(id);
    }

    await this.deps.segmentsRepository.touchLastEvaluatedAt(id);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "segment.evaluate",
      targetType: "segment",
      targetId: id,
      before: null,
      after: { memberCount },
    });

    return this.toPublic(await this.deps.segmentsRepository.findById(id));
  }

  async listMembers(id: string, page: number, pageSize: number) {
    const segment = await this.deps.segmentsRepository.findById(id);
    if (!segment) throw new NotFoundError("Segment not found");
    const result = await this.deps.segmentsRepository.listMembers(id, { page, pageSize });
    return { rows: result.rows.map(toPublicSegmentMember), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  /** Used by campaigns at send time — every recipient must come from a
   * segment's current membership, never computed ad hoc. */
  async listMemberCustomerIds(id: string): Promise<string[]> {
    const segment = await this.deps.segmentsRepository.findById(id);
    if (!segment) throw new NotFoundError("Segment not found");
    return this.deps.segmentsRepository.listAllMemberCustomerIds(id);
  }
}
