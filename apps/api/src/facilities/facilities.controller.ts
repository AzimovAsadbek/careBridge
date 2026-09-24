import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.facility.findMany({
      select: { id: true, name: true, type: true, district: true, publicCode: true },
      orderBy: { name: 'asc' },
    });
  }
}
