---
name: callcenter
description: Снимок очередей и статусы агентов; KPI только за сегодня; live pause/unpause.
domains: ["callcenter"]
intents: ["configure_callcenter"]
aliases: ["колл-центр", "callcenter"]
related: ["queues"]
risk: high
---
# Колл-центр

Агент = SIP-интерфейс (если PJSIP — `e{exten}_{tenant}`) плюс статус: `OFFLINE` | `READY` | `IN_CALL` | `RINGING` | `PAUSED` | `WRAPUP`. Очередь = `name` + strategy + waiting/talking. Активный звонок = `uniqueid` + queue + agent + `callerChannel`. История — `cc_queue_calls`. AI-агент как оператор очереди не поддерживается.

## Снимок очереди и состояние агента

`cc_get_queue_snapshot` даёт waiting/talking, агентов (total/available/paused), SLA и счётчики. `cc_get_agents` — статусы, причину паузы и очереди. Это live in-memory состояние тенанта, не исторический отчёт.

## Live-операции супервизора

`cc_force_pause_agent` и `cc_force_unpause_agent` — живые supervisor-операции. Их вызывает dispatch, это не draft и не proposal. Остальные мутации АТС идут через proposal.

## KPI только за текущий день

`cc_get_today_kpi` и цифры SLA/answered/abandoned/avgWait/avgTalk на снимке очереди — аккумуляторы с полуночи текущих суток. Не экстраполировать их на неделю, месяц или прошлые дни.
