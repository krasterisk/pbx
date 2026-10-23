import { expect, it } from 'vitest';
import { phoneSessionErrorKey } from './phoneSessionError';
import { phoneNumberRu, phoneNumberEn } from '@/shared/config/locales/phone';

it.each([
  [{status:401,data:{message:'Unauthorized'}},'authorizationRequired'],
  [{status:403,data:{message:'Telephone access denied'}},'accessDenied'],
  [{status:409,data:{message:'Telephone has an active call'}},'activeCall'],
  [{status:503,data:{message:'Desk telephone is not registered or its availability cannot be verified'}},'deskUnavailable'],
  [{status:400,data:{message:'Browser telephone is not configured'}},'browserNotConfigured'],
  [{status:400,data:{message:'Invalid telephone number'}},'invalidNumber'],
  [{status:'FETCH_ERROR'},'serverUnavailable'],
  [{status:500,data:{message:'Private diagnostic details'}},'serverUnavailable'],
  [null,'operationFailed'],
] as const)('translates the phone failure %j', (reason, expected)=>{
  const key=phoneSessionErrorKey(reason);
  expect(key).toBe(`phoneNumber.${expected}`);
  expect(phoneNumberRu[expected]).toBeTruthy();
  expect(phoneNumberEn[expected]).toBeTruthy();
  expect(phoneNumberRu[expected]).not.toContain('Unauthorized');
});
