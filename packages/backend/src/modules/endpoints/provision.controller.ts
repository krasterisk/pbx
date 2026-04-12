import { Controller, Get, Param, Request, Res, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Response } from 'express';
import { PsEndpoint } from './ps-endpoint.model';
import { ProvisionTemplate } from './provision-template.model';
import { PsAuth } from './ps-auth.model';

@Controller('provision')
export class ProvisionController {
  constructor(
    @InjectModel(PsEndpoint) private readonly endpointModel: typeof PsEndpoint,
    @InjectModel(ProvisionTemplate) private readonly templateModel: typeof ProvisionTemplate,
    @InjectModel(PsAuth) private readonly authModel: typeof PsAuth,
  ) {}

  @Get(':filename')
  async getProvisioningFile(
    @Param('filename') filename: string,
    @Request() req: any,
    @Res() res: Response
  ) {
    if (!filename) throw new NotFoundException('Filename missing');

    // Extract exact 12 hexadecimal characters from the filename to strip vendor prefixes like 'SEP' or 'cfg'
    const macMatch = filename.replace(/[:-]/g, '').match(/[0-9a-f]{12}/i);
    if (!macMatch) {
      throw new NotFoundException('MAC address format not recognized in filename');
    }
    const cleanMac = macMatch[0].toLowerCase();

    // Find endpoint by MAC
    const endpoint = await this.endpointModel.findOne({
      where: { mac_address: cleanMac },
      attributes: ['id', 'mac_address', 'provision_enabled', 'provision_template_id', 'pv_vars', 'callerid']
    });

    if (!endpoint || !endpoint.provision_enabled || !endpoint.provision_template_id) {
      throw new NotFoundException('Provisioning not configured for this MAC');
    }

    const template = await this.templateModel.findByPk(endpoint.provision_template_id);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const auth = await this.authModel.findByPk(endpoint.id, {
      attributes: ['id', 'password', 'username']
    });

    // Dynamic Variables (System vars prefix $)
    const baseVars = {
      '$sip_server': process.env.SIP_DOMAIN || req.headers.host?.split(':')[0] || 'localhost',
      '$sip_port': process.env.SIP_PORT || '5060',
      '$extension': endpoint.id.match(/^e(.+)_\d+$/)?.[1] || endpoint.id,
      '$username': auth?.username || endpoint.id,
      '$password': auth?.password || '',
      '$display_name': endpoint.callerid?.replace(/"/g, '') || endpoint.id,
    };

    // User defined pv_vars parsing (format key=value per line)
    const customVars: Record<string, string> = {};
    if (endpoint.pv_vars) {
      for (const line of endpoint.pv_vars.split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length) {
          customVars[k.trim()] = v.join('=').trim();
        }
      }
    }

    const allVars = { ...baseVars, ...customVars };

    let renderedContent = template.content || '';
    
    // Replace all variables
    for (const [key, val] of Object.entries(allVars)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      renderedContent = renderedContent.replace(new RegExp(escapedKey, 'g'), val);
    }

    // Return appropriate content type based on extension
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'xml') {
      res.setHeader('Content-Type', 'application/xml');
    } else {
      res.setHeader('Content-Type', 'text/plain');
    }

    res.status(200).send(renderedContent);
  }
}
