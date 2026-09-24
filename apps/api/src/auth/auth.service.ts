import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';

// Used to keep response time constant when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('carebridge-timing-dummy', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { facility: { select: { id: true, name: true, type: true } } },
    });
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.isActive) {
      await this.audit.log({ action: 'auth.login_failed', entityType: 'User', entityId: user?.id ?? null });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.audit.log({ actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id });
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { accessToken, user: this.toProfile(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { facility: { select: { id: true, name: true, type: true } } },
    });
    return this.toProfile(user);
  }

  private toProfile(user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    facility: { id: string; name: string; type: string };
  }) {
    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role, facility: user.facility };
  }
}
