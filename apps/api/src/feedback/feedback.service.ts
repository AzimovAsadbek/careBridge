import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FeedbackAnalysisService } from '../ai/feedback-analysis.service';
import { ListFeedbackQuery, PublicFeedbackDto } from './feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analysis: FeedbackAnalysisService,
  ) {}

  /** Only safe, public facility info. Internal ids are never exposed. */
  async publicFacility(code: string) {
    const facility = await this.prisma.facility.findUnique({
      where: { publicCode: code },
      select: { publicCode: true, name: true, type: true, district: true },
    });
    if (!facility) throw new NotFoundException('Facility not found');
    return facility;
  }

  /** Anonymous: nothing about the submitter (IP, device, user, patient) is stored. */
  async submit(dto: PublicFeedbackDto) {
    const facility = await this.prisma.facility.findUnique({ where: { publicCode: dto.facilityCode }, select: { id: true } });
    if (!facility) throw new NotFoundException('Facility not found');
    const fb = await this.prisma.feedback.create({
      data: { facilityId: facility.id, ward: dto.ward || null, rating: dto.rating, type: dto.type, text: dto.text || null },
      select: { id: true },
    });
    // Keyword result is stored now; the Gemini review runs in the background. Nothing is returned to the submitter.
    await this.analysis.analyze(fb.id);
    return { received: true };
  }

  async list(q: ListFeedbackQuery) {
    const where: Prisma.FeedbackWhereInput = {
      ...(q.facilityId ? { facilityId: q.facilityId } : {}),
      ...(q.sentiment || q.priority
        ? { analysis: { ...(q.sentiment ? { sentiment: q.sentiment } : {}), ...(q.priority ? { priority: q.priority } : {}) } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { facility: { select: { name: true } }, analysis: true },
      }),
      this.prisma.feedback.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async reanalyze(id: string) {
    const row = await this.analysis.analyze(id);
    if (!row) throw new NotFoundException('Feedback not found');
    return row;
  }
}
