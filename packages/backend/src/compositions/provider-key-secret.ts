import { Logger } from '@nestjs/common';

export const PROVIDER_KEY_SECRET_VAR = 'CC_AI_KEY_SECRET';

export function assertProviderKeySecret(
  env: NodeJS.Dict<string> = process.env,
  logger: { warn(message: string): void } = new Logger('AppModule'),
): void {
  if (env.CC_AI_KEY_SECRET) return;
  if (env.NODE_ENV === 'development') {
    logger.warn(
      `${PROVIDER_KEY_SECRET_VAR} is not set — continuing with the development fallback`,
    );
    return;
  }
  throw new Error(`${PROVIDER_KEY_SECRET_VAR} is not set`);
}
