import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PatientsService } from './patients.service';
import { ObservationsService } from './observations.service';
import { CreatePatientDto, DischargeDto, ListPatientsQuery, UpdatePatientDto } from './dto/patient.dto';
import { CreateObservationDto } from './dto/observation.dto';

@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patients: PatientsService,
    private readonly observations: ObservationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListPatientsQuery) {
    return this.patients.list(user, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePatientDto) {
    return this.patients.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.patients.get(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePatientDto) {
    return this.patients.update(user, id, dto);
  }

  @Post(':id/discharge')
  @Roles(Role.ADMIN, Role.DOCTOR)
  discharge(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DischargeDto) {
    return this.patients.discharge(user, id, dto);
  }

  @Post(':id/observations')
  @Roles(Role.DOCTOR, Role.NURSE)
  async addObservation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateObservationDto,
  ) {
    const { observation, risk } = await this.observations.record(user, id, dto);
    return { ...observation, risk };
  }
}
