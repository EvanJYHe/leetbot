type LogContext = Record<string, unknown>;

function withContext(message: string, context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return message;
  }

  return `${message} ${JSON.stringify(context)}`;
}

export const logger = {
  info(message: string, context?: LogContext): void {
    console.info(withContext(message, context));
  },
  warn(message: string, context?: LogContext): void {
    console.warn(withContext(message, context));
  },
  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(withContext(message, context), error);
  }
};
