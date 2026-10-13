import { ConflictException } from '@nestjs/common';
import { SupportRuntimeVerifier } from './support-runtime-verifier';
describe('Support route target boundary',()=>{
 const existing={id:8,raw_dialplan:'',actions:[{id:'normal',type:'toexten',params:{extension:'583'},condition:{variable:'NEW',equals:'1'}},{id:'forward',type:'totrunk',params:{trunk_uid:9,number:'79138480431'}}]};
 let routes:any,service:SupportRuntimeVerifier;
 beforeEach(()=>{routes={findOne:jest.fn(async()=>structuredClone(existing))};service=new SupportRuntimeVerifier(routes,{} as any,{} as any,{} as any);});
 it('permits exact step removal and attaching a scoped calendar',async()=>{
  await expect(service.assertRouteParameters({id:8,actions:[{...existing.actions[0],condition:{...existing.actions[0].condition,time_group_uid:7}}]},29)).resolves.toBeUndefined();
  expect(routes.findOne).toHaveBeenCalledWith(8,29);
 });
 it.each([
  [{id:'normal',type:'toexten',params:{extension:'999'}}],
  [{id:'new',type:'toexten',params:{extension:'583'}}],
  [{...existing.actions[0],condition:{variable:'OTHER',equals:'1'}}],
 ])('refuses changed targets, injected steps or unrelated conditions',async(actions)=>{
  await expect(service.assertRouteParameters({id:8,actions:[actions]},29)).rejects.toBeInstanceOf(ConflictException);
 });
 it('refuses duplicate/reordered steps and hidden activation changes',async()=>{
  for(const actions of [[existing.actions[0],existing.actions[0]],[existing.actions[1],existing.actions[0]],[{...existing.actions[0],enabled:true}]])await expect(service.assertRouteParameters({id:8,actions},29)).rejects.toBeInstanceOf(ConflictException);
 });
 it('refuses raw routes before proposing changes',async()=>{
  routes.findOne.mockResolvedValue({...existing,raw_dialplan:'exten => s,1,NoOp()'});
  await expect(service.assertRouteParameters({id:8},29)).rejects.toThrow('support_raw_route_requires_owner');
 });
});
