import { JwtService } from '@nestjs/jwt';
import { DashboardGateway } from './dashboard.gateway';
const secret='fixture-dashboard-jwt-secret-at-least-32-characters';
const user={sub:42,login:'fixture',name:'Fixture',level:2,role:7,vpbx_user_uid:91};
const socket=(data:Record<string,unknown>={})=>({handshake:{auth:{}},data,emit:jest.fn(),disconnect:jest.fn()});
describe('Dashboard authorized version notifications',()=>{
  const config:any={get:()=>secret};
  const access:any={resolve:jest.fn()};
  const store:any={nodeId:'fixture-node',select:jest.fn()};
  beforeEach(()=>{jest.clearAllMocks();access.resolve.mockResolvedValue({permissionVersion:'rights1'});store.select.mockResolvedValue([{updated_at:123}]);});
  it('coalesces 100 viewers into one version read and emits only actual changes',async()=>{
    const sockets=Array.from({length:100},()=>socket({dashboardUser:user,permissions:'rights1',checkedAt:Date.now()}));
    const gateway:any=new DashboardGateway(config,access,store);gateway.server={sockets:new Map(sockets.map((value,i)=>[String(i),value]))};
    await gateway.tick();expect(store.select).toHaveBeenCalledTimes(1);
    for(const value of sockets)expect(value.emit).toHaveBeenCalledWith('dashboard.version',{version:'123:rights1'});
    await gateway.tick();for(const value of sockets)expect(value.emit).toHaveBeenCalledTimes(1);
    store.select.mockResolvedValue([{updated_at:124}]);await gateway.tick();for(const value of sockets)expect(value.emit).toHaveBeenCalledTimes(2);
  });
  it('disconnects expired JWT or revoked current rights without notifying',async()=>{
    const expired=socket({dashboardUser:{...user,exp:1},checkedAt:Date.now()});
    const revoked=socket({dashboardUser:user,checkedAt:0});access.resolve.mockRejectedValue(new Error('revoked'));
    const gateway:any=new DashboardGateway(config,access,store);gateway.server={sockets:new Map([['expired',expired],['revoked',revoked]])};
    await gateway.tick();expect(expired.disconnect).toHaveBeenCalledWith(true);expect(revoked.disconnect).toHaveBeenCalledWith(true);expect(expired.emit).not.toHaveBeenCalled();expect(revoked.emit).not.toHaveBeenCalled();
  });
  it('keeps the last source version on SQL failure and does not fabricate changes',async()=>{
    const client=socket({dashboardUser:user,permissions:'rights1',checkedAt:Date.now()});
    const gateway:any=new DashboardGateway(config,access,store);gateway.server={sockets:new Map([['client',client]])};await gateway.tick();
    store.select.mockRejectedValue(new Error('database unavailable'));await gateway.tick();expect(client.emit).toHaveBeenCalledTimes(1);
  });
  it('validates signature, issuer, audience and fresh tenant access at handshake',async()=>{
    const jwt=new JwtService();const valid:any=socket();valid.handshake.auth.token=jwt.sign(user,{secret,issuer:'krasterisk-v4',audience:'krasterisk-v4-client'});
    const gateway=new DashboardGateway(config,access,store);await gateway.handleConnection(valid);expect(valid.disconnect).not.toHaveBeenCalled();expect(access.resolve).toHaveBeenCalledWith(expect.objectContaining({sub:42,vpbx_user_uid:91}));
    const wrong:any=socket();wrong.handshake.auth.token=jwt.sign(user,{secret,issuer:'other',audience:'krasterisk-v4-client'});await gateway.handleConnection(wrong);expect(wrong.disconnect).toHaveBeenCalledWith(true);
  });
});
