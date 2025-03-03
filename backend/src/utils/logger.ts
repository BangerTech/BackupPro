import winston from 'winston';
import { TransformableInfo } from 'logform';

const { combine, timestamp, printf } = winston.format;

const logFormat = printf((info: TransformableInfo) => {
  const { timestamp, level, message, ...rest } = info;
  const metadata = Object.keys(rest).length ? JSON.stringify(rest) : '';
  return `${timestamp} [${level}]: ${message} ${metadata}`;
});

export const logger = winston.createLogger({
  format: combine(
    timestamp(),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }),
  ],
}); 