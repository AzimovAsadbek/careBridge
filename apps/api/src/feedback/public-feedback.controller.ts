import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { FeedbackService } from './feedback.service';
import { PublicFeedbackDto } from './feedback.dto';

/** Unauthenticated QR endpoints. Strictly rate limited; expose no patient or internal data. */
@Public()
@Controller('public')
export class PublicFeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('facilities/:code')
  facility(@Param('code') code: string) {
    return this.feedback.publicFacility(code.toUpperCase().slice(0, 20));
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('feedback')
  submit(@Body() dto: PublicFeedbackDto) {
    return this.feedback.submit(dto);
  }
}
