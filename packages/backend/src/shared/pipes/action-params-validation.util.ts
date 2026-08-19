import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import type { ActionType } from '@krasterisk/shared';
import { ActionTypesList } from '../../modules/routes/dto/route-action.dto';
import { resolveParamsDto } from '../../modules/routes/dto/dialplan-params';

export type ActionParamsError = {
  actionId: string | null;
  path: string;
  message: string;
};

function flattenErrors(
  errors: ValidationError[],
  actionId: string | null,
  prefix = '',
): ActionParamsError[] {
  const out: ActionParamsError[] = [];
  for (const err of errors) {
    const path = prefix ? `${prefix}.${err.property}` : err.property;
    if (err.constraints) {
      for (const message of Object.values(err.constraints)) {
        out.push({ actionId, path, message });
      }
    }
    if (err.children?.length) {
      out.push(...flattenErrors(err.children, actionId, path));
    }
  }
  return out;
}

function actionIdOf(action: { id?: unknown }, index: number): string {
  return typeof action.id === 'string' && action.id ? action.id : `index:${index}`;
}

function validateOne(action: Record<string, unknown>, index: number): ActionParamsError[] {
  const actionId = actionIdOf(action, index);
  if (!action.type) {
    return [{ actionId, path: 'type', message: `action ${actionId} has empty type` }];
  }
  const type = String(action.type);
  if (!(ActionTypesList as readonly string[]).includes(type)) {
    return [{ actionId, path: 'type', message: `unknown action type: ${type}` }];
  }
  const Dto = resolveParamsDto(type as ActionType);
  const params = action.params;
  if (Dto === null) {
    if (params != null && (typeof params !== 'object' || Array.isArray(params))) {
      return [{ actionId, path: 'params', message: 'params must be an object' }];
    }
    return [];
  }
  if (params == null || typeof params !== 'object' || Array.isArray(params)) {
    return [{ actionId, path: 'params', message: 'params must be an object' }];
  }
  const instance = plainToInstance(Dto, params);
  const errors = validateSync(instance, { whitelist: true });
  return flattenErrors(errors, actionId);
}

export function validateActionParams(actions: unknown[]): ActionParamsError[] {
  if (!Array.isArray(actions)) {
    return [{ actionId: null, path: 'actions', message: 'actions must be an array' }];
  }
  const out: ActionParamsError[] = [];
  actions.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      out.push({ actionId: `index:${index}`, path: 'type', message: `action index:${index} is invalid` });
      return;
    }
    out.push(...validateOne(item as Record<string, unknown>, index));
  });
  return out.sort((a, b) => {
    const id = (a.actionId || '').localeCompare(b.actionId || '');
    return id !== 0 ? id : a.path.localeCompare(b.path);
  });
}

export function assertValidActionParams(actions: unknown[]): void {
  const errors = validateActionParams(actions);
  if (errors.length) {
    throw new BadRequestException({ errors });
  }
}

export function collectHostActionErrors(body: unknown): ActionParamsError[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const record = body as Record<string, unknown>;
  const errors: ActionParamsError[] = [];
  if (record.name === '') {
    errors.push({ actionId: null, path: 'name', message: 'name must be a non-empty string' });
  }
  errors.push(...validateActionParams(collectNestedActionChains(record)));
  return errors;
}

export function throwIfInvalidActionPayload(body: unknown): void {
  const errors = collectHostActionErrors(body);
  if (errors.length) {
    throw new BadRequestException({ errors });
  }
}

export function collectNestedActionChains(body: Record<string, unknown>): unknown[] {
  const chains: unknown[] = [];
  if (Array.isArray(body.actions)) chains.push(...body.actions);
  if (body.fallback_action) chains.push(body.fallback_action);
  if (body.max_retries_action) chains.push(body.max_retries_action);
  if (Array.isArray(body.bindings)) {
    for (const binding of body.bindings as Array<{ actions?: unknown[] }>) {
      if (Array.isArray(binding?.actions)) chains.push(...binding.actions);
    }
  }
  if (Array.isArray(body.menu_items)) {
    for (const item of body.menu_items as Array<{ actions?: unknown[] }>) {
      if (Array.isArray(item?.actions)) chains.push(...item.actions);
    }
  }
  if (Array.isArray(body.keywords)) {
    for (const kw of body.keywords as Array<{ actions?: unknown[] }>) {
      if (Array.isArray(kw?.actions)) chains.push(...kw.actions);
    }
  }
  if (Array.isArray(body.keyword_groups)) {
    for (const group of body.keyword_groups as Array<{ keywords?: Array<{ actions?: unknown[] }> }>) {
      for (const kw of group?.keywords ?? []) {
        if (Array.isArray(kw?.actions)) chains.push(...kw.actions);
      }
    }
  }
  return chains;
}
