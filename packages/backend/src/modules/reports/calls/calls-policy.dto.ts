import { IsInt, Min, Max } from 'class-validator';
export class CallsPolicyDto {
  @IsInt() @Min(1) @Max(168) windowHours!: number;
}
