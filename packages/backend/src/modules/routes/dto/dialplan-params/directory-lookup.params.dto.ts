import {
  IsArray,
  IsIn,
  IsInt,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { IDirectoryLookupParams } from '@krasterisk/shared';
import { validateAction } from '../../../../shared/utils/directory-lookup-dialplan.util';
import { CallValueSourceDto } from './value-source.dto';

export { validateAction } from '../../../../shared/utils/directory-lookup-dialplan.util';

@ValidatorConstraint({ name: 'isSafeTargetVariable', async: false })
class IsSafeTargetVariableConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && validateAction({ targetVariable: value }).length === 0;
  }

  defaultMessage(): string {
    return 'targetVariable must be an upper-case channel variable and must not be reserved';
  }
}

export class DirectoryLookupOutputDto {
  @IsInt()
  @Min(1)
  fieldUid: number;

  @Validate(IsSafeTargetVariableConstraint)
  targetVariable: string;
}

export class DirectoryLookupParamsDto implements IDirectoryLookupParams {
  @IsInt()
  @Min(1)
  directoryUid: number;

  @ValidateNested()
  @Type(() => CallValueSourceDto)
  keySource: CallValueSourceDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectoryLookupOutputDto)
  outputs: DirectoryLookupOutputDto[];

  @IsIn(['keep', 'empty'])
  onMissing: 'keep' | 'empty';
}
