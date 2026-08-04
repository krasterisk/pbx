import { AsyncLocalStorage } from 'node:async_hooks';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace';

export interface ScenarioContext {
  scenarioId: string;
  tags: string[];
}

export const scenarioContext = new AsyncLocalStorage<ScenarioContext>();

let sdk: NodeSDK | null = null;
let initialized = false;

export function initTracing(): void {
  if (initialized) return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const traceExporter = endpoint
    ? new OTLPTraceExporter({ url: endpoint })
    : new ConsoleSpanExporter();

  sdk = new NodeSDK({
    serviceName: 'krasterisk-harness',
    traceExporter,
  });

  sdk.start();
  initialized = true;
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
  initialized = false;
}

export async function withScenarioSpan<T>(
  scenarioId: string,
  tags: string[],
  fn: () => T | Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer('krasterisk-harness');

  return scenarioContext.run({ scenarioId, tags }, () =>
    tracer.startActiveSpan(`scenario.${scenarioId}`, async (span) => {
      span.setAttribute('scenario.id', scenarioId);
      span.setAttribute('scenario.tags', tags.join(','));

      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        span.end();
      }
    }),
  );
}

export function getActiveTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;
  const { traceId } = span.spanContext();
  return traceId && traceId !== '00000000000000000000000000000000' ? traceId : undefined;
}
