import { LoggerService, LogLevel } from '@nestjs/common';

/**
 * Emits one JSON object per line instead of Nest's default colorized text
 * output, so a log line can be grepped/parsed by field (e.g. eventId)
 * rather than by message substring.
 *
 * Call sites that just pass a string (`this.logger.log('...')`) keep
 * working unchanged — it lands under `message`. Passing an object instead
 * (`this.logger.log({ message: '...', eventId, type })`) adds those fields
 * to the same JSON line for correlation.
 */
export class JsonLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]) {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.write('verbose', message, optionalParams);
  }

  private write(level: LogLevel, message: unknown, optionalParams: unknown[]) {
    const last = optionalParams[optionalParams.length - 1];
    const context = typeof last === 'string' ? last : undefined;

    const fields =
      typeof message === 'object' && message !== null
        ? (message as Record<string, unknown>)
        : { message };

    const entry = {
      level,
      timestamp: new Date().toISOString(),
      context,
      ...fields,
    };

    const line = JSON.stringify(entry);
    if (level === 'error') process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
  }
}
