import {
  allBuiltinScaleMetrics,
  builtinScaleMetric,
  defaultSaProjectConfig,
  type SaIndustryTemplateId,
  type SaProjectConfigV1,
  type SaProjectMetric,
  type SaDefaultScaleId,
} from './speech-analytics.types';

export type SaIndustryTemplate = {
  id: SaIndustryTemplateId;
  name: string;
  description: string;
  systemPrompt: string;
  customMetrics: SaProjectMetric[];
  visibleScales: SaDefaultScaleId[];
};

function boolMetric(id: string, name: string, description: string): SaProjectMetric {
  return { id, name, type: 'boolean', description, polarity: 'positive', sourceScaleId: null };
}

function enumMetric(id: string, name: string, description: string, enumValues: string[]): SaProjectMetric {
  return { id, name, type: 'enum', description, enumValues, polarity: 'neutral', sourceScaleId: null };
}

export const SA_INDUSTRY_TEMPLATE_CATALOG: SaIndustryTemplate[] = [
  {
    id: 'real_estate',
    name: 'Недвижимость',
    description: 'Анализ звонков агентств недвижимости',
    systemPrompt: 'Контекст: агентство недвижимости. Операторы обрабатывают входящие звонки от потенциальных покупателей и арендаторов.',
    customMetrics: [
      boolMetric('property_match', 'Подбор объекта', 'Предложил ли оператор подходящий объект недвижимости'),
      boolMetric('viewing_scheduled', 'Просмотр назначен', 'Был ли назначен просмотр объекта'),
    ],
    visibleScales: ['greeting_quality', 'objection_handling', 'closing_quality', 'product_knowledge'],
  },
  {
    id: 'delivery',
    name: 'Доставка',
    description: 'Анализ звонков служб доставки',
    systemPrompt: 'Контекст: служба доставки. Операторы обрабатывают заказы и решают проблемы с доставкой.',
    customMetrics: [
      boolMetric('upsell_attempt', 'Попытка апселла', 'Предложил ли оператор дополнительные товары или услуги'),
      boolMetric('delivery_issue_resolved', 'Проблема решена', 'Была ли решена проблема с доставкой'),
    ],
    visibleScales: ['greeting_quality', 'problem_resolution', 'active_listening', 'politeness_empathy'],
  },
  {
    id: 'tech_support',
    name: 'Техподдержка',
    description: 'Анализ звонков технической поддержки',
    systemPrompt: 'Контекст: техническая поддержка. Операторы помогают пользователям решить технические проблемы.',
    customMetrics: [
      enumMetric('issue_category', 'Категория проблемы', 'Категория технической проблемы', ['Софт', 'Железо', 'Сеть', 'Другое']),
      boolMetric('first_call_resolution', 'Решено с первого звонка', 'Была ли проблема решена за один звонок'),
    ],
    visibleScales: ['problem_resolution', 'product_knowledge', 'active_listening', 'speech_clarity_pace'],
  },
  {
    id: 'banking',
    name: 'Банки',
    description: 'Анализ звонков банковских контакт-центров',
    systemPrompt: 'Контекст: банковский контакт-центр. Операторы консультируют клиентов по продуктам и услугам банка.',
    customMetrics: [
      boolMetric('product_offered', 'Продукт предложен', 'Был ли предложен банковский продукт клиенту'),
      boolMetric('compliance_check', 'Комплаенс', 'Соблюдал ли оператор требования комплаенса'),
    ],
    visibleScales: ['script_compliance', 'politeness_empathy', 'product_knowledge', 'closing_quality'],
  },
  {
    id: 'medicine',
    name: 'Медицина',
    description: 'Анализ звонков медицинских центров и клиник',
    systemPrompt: 'Контекст: медицинский центр. Операторы записывают пациентов на приём, консультируют по услугам и обрабатывают обращения.',
    customMetrics: [
      boolMetric('appointment_booked', 'Запись на приём', 'Была ли успешно оформлена запись пациента на приём'),
      boolMetric('urgency_assessed', 'Оценка срочности', 'Оценил ли оператор срочность обращения пациента'),
    ],
    visibleScales: ['greeting_quality', 'active_listening', 'politeness_empathy', 'problem_resolution'],
  },
  {
    id: 'food',
    name: 'Еда',
    description: 'Анализ звонков ресторанов и доставки еды',
    systemPrompt: 'Контекст: ресторан или сервис доставки еды. Операторы принимают заказы, обрабатывают жалобы и бронируют столики.',
    customMetrics: [
      boolMetric('order_taken', 'Заказ принят', 'Был ли корректно принят заказ клиента'),
      boolMetric('upsell_suggested', 'Допродажа', 'Предложил ли оператор дополнительные позиции'),
    ],
    visibleScales: ['greeting_quality', 'politeness_empathy', 'closing_quality', 'speech_clarity_pace'],
  },
  {
    id: 'auto_service',
    name: 'Автосервис',
    description: 'Анализ звонков автосервисов и дилерских центров',
    systemPrompt: 'Контекст: автосервис или дилерский центр. Операторы принимают заявки на ремонт и ТО, консультируют по работам и запчастям, записывают клиентов на визит.',
    customMetrics: [
      boolMetric('service_booked', 'Запись на сервис', 'Была ли оформлена запись клиента на ремонт, диагностику или ТО'),
      boolMetric('diagnostics_offered', 'Диагностика предложена', 'Предложил ли оператор диагностику или осмотр при неясной жалобе на авто'),
      boolMetric('parts_availability_checked', 'Наличие запчастей', 'Уточнил ли оператор наличие запчастей или сроки поставки, если это важно для клиента'),
    ],
    visibleScales: ['greeting_quality', 'product_knowledge', 'problem_resolution', 'closing_quality'],
  },
  {
    id: 'insurance',
    name: 'Страхование',
    description: 'Анализ звонков страховых компаний и брокеров',
    systemPrompt: 'Контекст: страховая компания или брокер. Операторы консультируют по полисам, оформляют заявки, принимают обращения по страховым случаям и пролонгации.',
    customMetrics: [
      boolMetric('policy_needs_clarified', 'Потребность выявлена', 'Выяснил ли оператор, какой риск или продукт интересует клиента'),
      boolMetric('quote_or_application', 'Расчёт или заявка', 'Был ли сделан расчёт стоимости или оформлена заявка на полис'),
      boolMetric('claim_next_steps', 'Дальнейшие шаги по убытку', 'При страховом случае оператор объяснил документы и следующие шаги урегулирования'),
    ],
    visibleScales: ['script_compliance', 'active_listening', 'product_knowledge', 'politeness_empathy'],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Анализ звонков интернет-магазинов и маркетплейсов',
    systemPrompt: 'Контекст: интернет-магазин или маркетплейс. Операторы помогают с заказами, статусом доставки, возвратами, обменом и консультацией по товарам.',
    customMetrics: [
      boolMetric('order_status_explained', 'Статус заказа', 'Дал ли оператор понятный статус заказа или доставки и сроки'),
      boolMetric('return_or_exchange_handled', 'Возврат или обмен', 'Корректно ли обработан запрос на возврат, обмен или отмену заказа'),
      boolMetric('cross_sell_or_alternative', 'Альтернатива или допродажа', 'Предложил ли оператор аналог или дополнительную позицию'),
    ],
    visibleScales: ['greeting_quality', 'problem_resolution', 'objection_handling', 'closing_quality'],
  },
  {
    id: 'custom',
    name: 'Свой',
    description: 'Собрать набор метрик самостоятельно',
    systemPrompt: '',
    customMetrics: [],
    visibleScales: [...allBuiltinScaleMetrics().map((m) => m.sourceScaleId!)],
  },
];

export function applyIndustryTemplate(
  templateId: SaIndustryTemplateId,
  base: SaProjectConfigV1 = defaultSaProjectConfig(),
): SaProjectConfigV1 {
  const template = SA_INDUSTRY_TEMPLATE_CATALOG.find((row) => row.id === templateId)
    ?? SA_INDUSTRY_TEMPLATE_CATALOG[SA_INDUSTRY_TEMPLATE_CATALOG.length - 1];
  const scales = template.visibleScales.map((id) => builtinScaleMetric(id));
  const metrics = [...scales, ...template.customMetrics];
  const hidden = allBuiltinScaleMetrics()
    .map((m) => m.id)
    .filter((id) => !template.visibleScales.includes(id as SaDefaultScaleId));
  return {
    ...base,
    templateId: template.id,
    systemPrompt: template.systemPrompt,
    metrics,
    customMetrics: template.customMetrics
      .filter((m) => !m.sourceScaleId && m.type !== 'string')
      .map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type as 'boolean' | 'number' | 'enum',
        description: m.description,
        enumValues: m.enumValues,
        polarity: m.polarity,
      })),
    hiddenDefaultScales: hidden,
  };
}
