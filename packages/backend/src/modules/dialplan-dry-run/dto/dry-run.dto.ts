import { Allow, IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import type {
  WalkAction,
  WalkBreadcrumb,
  WalkHostKind,
  WalkIvrInputs,
  WalkMenuItem,
  WalkOutcome,
  WalkSegment,
} from '@krasterisk/shared';

export class DryRunRequestDto {
  @IsIn(['route', 'ivr'])
  host!: WalkHostKind;

  @IsOptional()
  @IsArray()
  @Allow()
  actions?: WalkAction[];

  @IsOptional()
  @IsArray()
  @Allow()
  menu_items?: WalkMenuItem[];

  @IsOptional()
  @IsString()
  callerNumber?: string;

  @IsOptional()
  @IsObject()
  @Allow()
  scenario?: Record<string, string>;

  @IsOptional()
  @IsString()
  ivrChoice?: string;
}

export class DryRunReaskDto {
  source!: string;
  keys!: string[];
  askedAfterRun!: true;
  label?: string;
}

export class DryRunResultDto {
  segments!: WalkSegment[];
  breadcrumbs!: WalkBreadcrumb[];
  hopsUsed!: number;
  hopLimit!: number;
  outcome!: WalkOutcome;
  reask?: DryRunReaskDto;
  ivrInputs?: WalkIvrInputs;
}
