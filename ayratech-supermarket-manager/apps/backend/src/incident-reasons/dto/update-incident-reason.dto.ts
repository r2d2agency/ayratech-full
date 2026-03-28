import { PartialType } from '@nestjs/mapped-types';
import { CreateIncidentReasonDto } from './create-incident-reason.dto';

export class UpdateIncidentReasonDto extends PartialType(CreateIncidentReasonDto) {}
