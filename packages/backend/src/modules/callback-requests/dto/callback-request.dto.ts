import { IsIn, IsOptional } from 'class-validator';

export const CALLBACK_LIST_STATUSES = ['active', 'completed'] as const;
export type CallbackListStatus = (typeof CALLBACK_LIST_STATUSES)[number];

export class ListCallbackRequestsQueryDto {
  @IsOptional()
  @IsIn(CALLBACK_LIST_STATUSES)
  status?: CallbackListStatus;
}
