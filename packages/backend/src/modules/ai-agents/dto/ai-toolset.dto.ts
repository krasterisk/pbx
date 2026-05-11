import { IsString, IsOptional, IsArray, MaxLength } from 'class-validator';

export class CreateAiToolsetDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  tools: any[];
}

export class UpdateAiToolsetDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  tools?: any[];
}
