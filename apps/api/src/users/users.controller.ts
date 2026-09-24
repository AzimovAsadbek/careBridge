import { Controller, Get, ParseEnumPipe, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Staff directory used for assigning doctors / nurses. Never returns password hashes. */
  @Get()
  @Roles(Role.ADMIN, Role.DOCTOR)
  list(@Query('role', new ParseEnumPipe(Role, { optional: true })) role?: Role) {
    return this.prisma.user.findMany({
      where: { isActive: true, ...(role ? { role } : {}) },
      select: { id: true, fullName: true, role: true, facility: { select: { id: true, name: true } } },
      orderBy: { fullName: 'asc' },
    });
  }
}
