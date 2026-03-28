import { PartialType } from '@nestjs/mapped-types';
import { CreateTimeClockEventDto } from './create-time-clock.dto';

export class UpdateTimeClockEventDto extends PartialType(CreateTimeClockEventDto) {}
