import { IsString, IsOptional, IsArray, IsEnum, IsNumber, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export type ChatChannelTypeDto = 'direct' | 'group' | 'broadcast_all' | 'broadcast_queue';

export class SendChatMessageDto {
  @IsEnum(['direct', 'group', 'broadcast_all', 'broadcast_queue'])
  channelType: ChatChannelTypeDto;

  @IsString()
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  targetUserId?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  groupUid?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  queue?: string;
}

export class CreateChatChannelDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsArray()
  @IsNumber({}, { each: true })
  memberUserIds: number[];
}

export class GetHistoryQueryDto {
  @IsString()
  @MaxLength(128)
  channelKey: string;

  @IsOptional()
  @IsString()
  before?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}
