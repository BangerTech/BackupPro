import winston from 'winston';
import { TransformableInfo } from 'logform';

const { combine, timestamp, printf } = winston.format;

// Funktion zur Formatierung des Timestamps mit lokaler Zeitzone
const timestampWithTimezone = winston.format((info) => {
  const date = new Date();
  // Format: YYYY-MM-DD HH:MM:SS +TIMEZONE
  info.timestamp = date.toLocaleString('de-DE', { 
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }) + ' ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
  return info;
});

const logFormat = printf((info: TransformableInfo) => {
  const { timestamp, level, message, ...rest } = info;
  const metadata = Object.keys(rest).length ? JSON.stringify(rest) : '';
  return `${timestamp} [${level}]: ${message} ${metadata}`;
});

export const logger = winston.createLogger({
  format: combine(
    timestampWithTimezone(),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }),
  ],
}); 