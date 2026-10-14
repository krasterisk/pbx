import { All, Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TenantContextGuard } from '../integration-credentials/tenant-context.guard';
import type { TenantContextRequest } from '../integration-credentials/tenant-context.guard';
import { SupportService } from './support.service';
@Controller('support/v1')
@UseGuards(TenantContextGuard)
export class SupportController {
  constructor(private readonly support:SupportService) {}
  @Get('capabilities') capabilities(@Req() req:TenantContextRequest) { return this.support.capabilities(req.tenantContext!); }
  @Post('read/:tool') read(@Req() req:TenantContextRequest,@Param('tool') tool:string,@Body() body:{arguments:Record<string,unknown>}) { return this.support.read(req.tenantContext!,tool,body.arguments); }
  @Post('proposals') propose(@Req() req:TenantContextRequest,@Body() body:Record<string,unknown>) { return this.support.propose(req.tenantContext!,body); }
  @Get('proposals/:id') status(@Req() req:TenantContextRequest,@Param('id') id:string) { return this.support.status(req.tenantContext!,id); }
  @Post('proposals/:id/apply') apply(@Req() req:TenantContextRequest,@Param('id') id:string,@Body() body:{hash:string}) { return this.support.apply(req.tenantContext!,id,body.hash); }
  @Post('proposals/:id/reject') reject(@Req() req:TenantContextRequest,@Param('id') id:string,@Body() body:{hash:string}) { return this.support.reject(req.tenantContext!,id,body.hash); }
  @Post('proposals/:id/verify') verify(@Req() req:TenantContextRequest,@Param('id') id:string) { return this.support.verify(req.tenantContext!,id); }
  // Stateless Streamable HTTP: fresh integration authentication on every request.
  @All('mcp') async mcp(@Req() req:Request&TenantContextRequest,@Res() res:Response) {
    if(req.method==='DELETE') {res.status(200).end();return;}
    if(req.method!=='POST'){res.status(405).end();return;}
    const rpc=req.body as any;
    try {
      if(rpc?.jsonrpc!=='2.0')throw new Error('invalid_rpc');
      if(rpc.method==='notifications/initialized'){res.status(202).end();return;}
      let result:unknown;
      if(rpc.method==='initialize')result={protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'krasterisk-support',version:'1.0.0'}};
      else if(rpc.method==='tools/list')result={tools:(await this.support.capabilities(req.tenantContext!)).operations.filter(o=>o.effect==='read').map(o=>({name:o.tool,description:o.description,inputSchema:o.schema}))};
      else if(rpc.method==='tools/call'){const value=await this.support.read(req.tenantContext!,rpc.params?.name,rpc.params?.arguments??{});result={content:[{type:'text',text:JSON.stringify(value)}]};}
      else throw new Error('method_not_found');
      res.json({jsonrpc:'2.0',id:rpc.id,result});
    }catch {res.status(400).json({jsonrpc:'2.0',id:rpc?.id??null,error:{code:-32602,message:'Support operation refused'}});}
  }
}
