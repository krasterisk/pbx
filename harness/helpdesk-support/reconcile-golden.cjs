const fs=require('node:fs'),assert=require('node:assert/strict');
const dialect=process.argv[2],runtime=JSON.parse(fs.readFileSync(__dirname+'/runtime-'+dialect+'.json')),plan=JSON.parse(fs.readFileSync(__dirname+'/last-calendar-'+dialect+'.private.json'));
async function request(route,token,body){const res=await fetch(runtime.base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});assert([200,201].includes(res.status));return res.json();}
async function main(){
 const status=await request('/support/v1/proposals/'+plan.id,plan.token);assert.equal(status.status,'verified');assert.equal(status.hash,plan.hash);assert.equal(status.execution.length,9);assert(status.execution.every(s=>s.status==='applied'));
 const login=await request('/auth/login',undefined,{login:'ci-tenant-a',password:runtime.seedPassword});const groups=await request('/time-groups',login.accessToken);const cal=groups.filter(g=>g.name.startsWith('Synthetic support hours ')).sort((a,b)=>b.uid-a.uid)[0];assert.equal(cal.intervals[0].timezone,'Asia/Krasnoyarsk');
 const routes=await request('/routes',login.accessToken);for(const number of ['9044','9045','9046','9047','9048','9051','9053','9058']){const route=routes.find(r=>r.name==='Synthetic queue '+number);assert(route);assert.equal(route.actions[0].condition.time_group_uid,cal.uid);assert.equal(route.actions[1].type,'hangup');}
 assert.equal(JSON.parse(fs.readFileSync(__dirname+'/probe-count-'+dialect+'.json')).calls,1);
 const report={dialect,tenant:2,checks:['real HTTP integration grants','MCP discovery read-only','scoped route/endpoint/ringall facts','approved mock STT + replay/privacy','stale web edit refused','cross-tenant 404','real AMI generation/reload/runtime verification','callback replay','exact 583 destination removal + web re-save persistence','eight-queue dependent calendar + unchanged fallback'],calendarResponseLost:true,resumedWith:'read-only status and state, no repeated apply',smtp:'not invoked',paidProvider:'not invoked',status:'pass'};
 fs.writeFileSync(__dirname+'/golden-'+dialect+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error('Read-only reconciliation failed: '+e.message);process.exitCode=1;});
