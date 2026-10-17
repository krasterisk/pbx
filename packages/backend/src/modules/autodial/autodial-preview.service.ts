import { BadRequestException, Injectable } from '@nestjs/common';
import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';
import { AutodialCampaignsService } from './autodial-campaigns.service';
import { AutodialBasesService } from './autodial-bases.service';
import { IvrTtsService } from '../ivrs/ivr-tts.service';
import { autodialTtsRuntimeTemplate, generateAutodialCampaignDialplan } from './autodial-dialplan.util';
import { autodialContactVariables } from './autodial-contact-variables.util';

@Injectable()
export class AutodialPreviewService {
  constructor(private readonly campaigns: AutodialCampaignsService, private readonly bases: AutodialBasesService,
    private readonly tts: IvrTtsService) {}

  async preview(userUid: number, campaignUid: number, contactUid?: number) {
    const campaign = await this.campaigns.findOne(userUid, campaignUid);
    const base = await this.bases.findOne(userUid, campaign.base_uid);
    const contact = contactUid === undefined ? null : await this.bases.findContact(userUid, campaign.base_uid, contactUid);
    const variables = base.fields.map((field) => ({ name: field.var_name, label: field.label, type: field.type,
      value: contact ? String(field.is_phone || field.type === 'phone' ? contact.phones[0]?.normalized ?? '' : contact.values[field.key] ?? '') : null }));
    const values = new Map(variables.map((variable) => [variable.name, variable.value]));
    if (contact) {
      const stored = Object.fromEntries(base.fields.map((field) => [String(field.uid), contact.values[field.key]]).filter(([, value]) => value !== undefined));
      const runtime = autodialContactVariables(base.fields, stored, contact.phones[0]?.normalized ?? '', true);
      for (const [key, value] of Object.entries(runtime)) values.set(key.slice(2), value);
    }
    const steps = campaign.scenario_actions.filter((action) => action.enabled !== false).map((action) => {
      const template = action.type === 'text2speech' ? autodialTtsRuntimeTemplate(action.params.text) : null;
      const missing = template?.vars.filter((name) => !values.get(name)) ?? [];
      const text = template?.template.replace(/\$\{(AC_[A-Z0-9_]+)\}/g, (_token, name: string) => values.get(name) ?? `{${name}}`);
      return { id: action.id, type: action.type, ...(template ? { text, missing, engine_uid: Number(action.params.engine) || null } : {}) };
    });
    // Compiler payloads include the internal credential. It must never leave the server.
    const dialplan = generateAutodialCampaignDialplan(campaign, userUid).lines
      .map((line) => line.replace(/([?&]api_key=)[^&\s,)]+/g, '$1[redacted]')).join('\n');
    return { campaign_uid: campaignUid, revision: campaign.revision, base_uid: base.uid, contact_uid: contact?.uid ?? null,
      variables, steps, dialplan };
  }

  async audio(userUid: number, campaignUid: number, contactUid: number, stepId: string): Promise<Buffer> {
    const campaign = await this.campaigns.findOne(userUid, campaignUid);
    const action = campaign.scenario_actions.find((step) => step.id === stepId && step.enabled !== false && step.type === 'text2speech');
    if (!action) throw new BadRequestException({ code: 'AC_PREVIEW_STEP', message: 'Choose a saved TTS step' });
    const preview = await this.preview(userUid, campaignUid, contactUid);
    const step = preview.steps.find((item) => item.id === stepId);
    if (!step?.text?.trim() || step.missing?.length) throw new BadRequestException({ code: 'AC_PREVIEW_VARIABLES', message: 'Fill all referenced customer fields before preview' });
    if (step.text.length > 10000) throw new BadRequestException({ code: 'AC_PREVIEW_TEXT_TOO_LONG' });
    const engine = await this.tts.loadEngine(Number(action.params.engine), userUid);
    return this.tts.synthesizeToBuffer(engine, step.text, action.params.settings as IIvrPhraseTtsSettings | undefined);
  }
}
