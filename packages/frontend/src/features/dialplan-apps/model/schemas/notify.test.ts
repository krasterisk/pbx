import { notifyFieldErrors } from './notify';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';
import { describe,it,expect } from 'vitest';
describe('Notify form validation',()=>{
 it('accepts legacy message and still requires explicit canonical text',()=>{
  expect(notifyFieldErrors({integration_uid:'1',message:'Звонок завершён'})).toEqual({});
  expect(notifyFieldErrors({integration_uid:'1',message:'old',body:''})).toEqual({body:'notify-body-required'});
  expect(notifyFieldErrors({integration_uid:'1',body:'bad;command'})).toEqual({body:'notify-body-invalid'});
 });
 it('has human-readable RU/EN explanations for every notification error',()=>{
  for(const locale of [ru,en])for(const key of ['bodyRequired','bodyInvalid','integrationRequired'] as const)expect(locale.routes.chain.notify[key].length).toBeGreaterThan(8);
 });
});