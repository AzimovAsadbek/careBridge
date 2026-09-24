import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { FeedbackService } from './feedback.service';
import { ListFeedbackQuery } from './feedback.dto';

@Controller('feedback')
@Roles(Role.ADMIN)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  list(@Query() q: ListFeedbackQuery) {
    return this.feedback.list(q);
  }

  @Post(':id/reanalyze')
  reanalyze(@Param('id', ParseUUIDPipe) id: string) {
    return this.feedback.reanalyze(id);
  }
}
