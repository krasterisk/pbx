import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CallCenterCardsService } from './callcenter-cards.service';
import { ccConfigMutation, requireCcSupervisor } from './callcenter-ai-config.util';
import { CARD_FIELD_TYPES } from './dto/callcenter-cards.dto';

const id = z.number().int().positive();
export const cardFieldSchema = z.strictObject({
  field_key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/), field_type: z.enum(CARD_FIELD_TYPES), label: z.string().min(1).max(128),
  placeholder: z.string().max(256).optional(), is_required: z.boolean().optional(), default_value: z.string().max(256).optional(),
  options: z.union([z.array(z.string()), z.strictObject({ source: z.literal('directory'), directoryUid: id, valueFieldUid: id, labelFieldUid: id })]).optional().describe('Ручные варианты или привязка к универсальному справочнику; UID колонок из list_directories'),
  depends_on: z.string().max(64).optional(), depends_values: z.array(z.string()).optional(), sort_order: z.number().int().optional(), width: z.enum(['full', 'half']).optional(),
  auto_populate: z.enum(['caller_id', 'queue', 'phonebook.name']).optional(),
});
const templateSchema = z.strictObject({
  name: z.string().min(1).max(128), description: z.string().optional(), is_active: z.boolean().optional(), auto_open_on: z.enum(['answer', 'ring', 'manual']).optional(),
  auto_save_on_timeout: z.boolean().optional(), queue_names: z.array(z.string()).optional().describe('Имена очередей из list_queues; [] — все очереди'),
  webhook_integration_uid: id.nullable().optional(), webhook_field_map: z.record(z.string(), z.string()).nullable().optional(), fields: z.array(cardFieldSchema).max(100).describe('Полный состав полей; при изменении заменяет весь список. Для правки описания не передавайте fields.'),
});

@Injectable()
export class CallCenterCardsAiTools  {
  constructor(private readonly cards: CallCenterCardsService) {}
  getKnowledgeBlock() {
    return `## Конструктор карточек звонка
- Прочитать cc_list_card_templates/cc_get_card_template, затем создать/изменить через предложение. auto_open_on=answer открывает при ответе, ring при вызове, manual вручную. queue_names=[] означает все очереди.
- fields задаёт ПОЛНЫЙ упорядоченный список полей. При изменении сохраняйте поля, которые пользователь не просил удалить, и прежние field_key: они связывают исторические ответы. Не переименовывайте ключ при смене подписи.
- Простые типы: text/textarea/phone/email/number/date/checkbox; select/multi_select для выбора; heading/divider для разделов. width=half размещает рядом, full на всю строку. depends_on/depends_values условно показывают поле.
- Источник рекламы, тема, результат, услуга — примеры пользовательских списков, не фиксированные сущности БД. Используйте универсальные справочники: list_directories/list_directory_records; для нового create_directory (key_normalization=none для произвольных кодов). Затем options={source:directory,directoryUid,valueFieldUid,labelFieldUid}. Не угадывайте UID. Колонка значения уникальна; подпись непустая. Старые ответы хранят подпись на момент выбора.
- Ручной небольшой список допустим options=[строки]. Не подменяйте существующую привязку статическим списком. Обязательные поля is_required=true, placeholder — подсказка, default_value — ответ по умолчанию.
- Сначала согласуйте содержание карточки и очереди. Не включайте webhook без явного запроса: сохранение карточки отправляет данные в интеграцию. Секреты/URL интеграции не задаются в шаблоне.
- Запись шаблонов разрешена супервизору/администратору, проверяется повторно при подтверждении. Редактирование шаблона не удаляет историю карточек.`;
  }
  getTools() {
    return [
      { name: 'cc_list_card_templates', description: 'Шаблоны карточек КЦ с полями и привязками очередей', inputSchema: {}, entityType: 'callcenter_card_template', handler: async (_a: any, tenant: number) => ({ templates: await this.cards.findTemplates(tenant) }) },
      { name: 'cc_get_card_template', description: 'Прочитать полный шаблон карточки перед изменением', inputSchema: { id: { type: 'integer', minimum: 1 } }, entityType: 'callcenter_card_template', handler: async (a: any, tenant: number) => ({ template: await this.cards.findTemplate(id.parse(a.id), tenant) }) },
      ccConfigMutation({ name: 'cc_create_card_template', description: 'Создать шаблон карточки звонка из описания', schema: templateSchema,
        read: async (a, c) => { await this.cards.validateTemplateFields(a.fields, c.vpbxUserUid); return this.cards.findTemplates(c.vpbxUserUid); },
        write: (a, c) => this.cards.createTemplate(a, c.vpbxUserUid) }),
      ccConfigMutation({ name: 'cc_update_card_template', description: 'Изменить шаблон карточки звонка', schema: z.strictObject({ id, patch: templateSchema.partial() }),
        read: async (a, c) => { if (a.patch.fields) await this.cards.validateTemplateFields(a.patch.fields, c.vpbxUserUid); return this.cards.findTemplate(a.id, c.vpbxUserUid); },
        write: (a, c) => this.cards.updateTemplate(a.id, a.patch, c.vpbxUserUid), preview: (a, before) => ({ ...before, ...a.patch }) }),
      ccConfigMutation({ name: 'cc_delete_card_template', description: 'Удалить шаблон карточки звонка', destructive: true, schema: z.strictObject({ id }),
        read: (a, c) => this.cards.findTemplate(a.id, c.vpbxUserUid), write: (a, c) => this.cards.removeTemplate(a.id, c.vpbxUserUid), authorize: (_a, c) => requireCcSupervisor(c) }),
    ];
  }
}
