import { AuditLog } from '@backend/lib/models/audit_log';
import * as c from 'ansi-colors'

export enum LogLevel {
  DEBUG = 1,
  INFO = 2,
  WARNING = 3,
  ERROR = 4,
  AUDIT = 5
}
const LogLevelName: {[key: number]: string} = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARNING]: 'warning',
  [LogLevel.ERROR]: 'error',
  [LogLevel.AUDIT]: 'audit'
}

export interface LogLine {
  date: Date;
  level: LogLevel;
  env: string;
  msg: string | AuditLog;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: any;
  traceId?: string;
  error?: Error;
}

let timeSinceLastLog: number | null = null;
function logLine (line: LogLine) {
  if (process.env.TESTING_LOCAL === 'true') {
    let timeDiff = null;
    if (!timeSinceLastLog) { timeSinceLastLog = new Date().getTime(); } else {
      timeDiff = Math.ceil((line.date.getTime() - timeSinceLastLog));
      timeSinceLastLog = line.date.getTime();
    }

    const timeTaken = timeDiff ? c.gray(' +' + timeDiff.toString() + 'ms') : '';
    if (line.level === LogLevel.AUDIT) {
      const auditLog = <AuditLog>line.msg;
      if (auditLog.success) {
        console.log((c.green.bold('✔ AUDIT LOG')) + timeTaken);
        console.log(c.green(JSON.stringify(auditLog, null, 4)));
      } else {
        console.log((c.red.bold('✖ AUDIT LOG')) + timeTaken);
        console.log(c.red(JSON.stringify(auditLog, null, 4)));
      }
    } else {
      const msgWithStartMarker = c.underline((String(line.msg)).charAt(0)) + (String(line.msg)).slice(1);
      switch (line.level) {
        case LogLevel.DEBUG:
          console.log(c.blue(msgWithStartMarker) + timeTaken);
          break;
        case LogLevel.INFO:
          console.log(c.magenta(msgWithStartMarker) + timeTaken);
          break;
        case LogLevel.WARNING:
          console.log(c.yellow(msgWithStartMarker) + timeTaken);
          break;
        case LogLevel.ERROR:
          console.log(c.red(msgWithStartMarker) + timeTaken);
          if (line.error) { console.error(line.error); }
          break;
      }

      if (line.args && line.args.length > 0) {
        console.log(c.white(JSON.stringify(line.args, null, 4)
          .split('\n').map(line => '\t' + line).join('\n')));
      }
    }
  } else { process.stdout.write(JSON.stringify({ ...line, level: LogLevelName[line.level] }) + '\n'); } /* Override number level with string level */

  return line;
}

export class LambdaLog {
  // eslint-disable-next-line no-use-before-define
  private static instance: LambdaLog = new LambdaLog();
  private static isInitialized = false;
  private env: string;
  private traceId?: string;

  /* Log all lines if an LogLevel.ERROR occurred but only after the AUDIT line.
     Will be logged as an INFO line with the buffer in the args */
  private logBufferedLinesOnError: boolean;
  private errorOccurred: boolean;
  private bufferedLines: LogLine[];

  private logLevel: LogLevel;

  constructor () {
    return LambdaLog.instance;
  }

  public init (env: string) {
    if (LambdaLog.isInitialized && process.env.TESTING_LOCAL_RE_INIT !== 'true') { throw new Error('LambdaLog has been initialized, just call the constructor to get an instance'); }

    this.env = env;
    this.logLevel = LogLevel.DEBUG;
    this.logBufferedLinesOnError = !process.env.TESTING_LOCAL;
    this.errorOccurred = false;
    this.bufferedLines = [];
    LambdaLog.isInitialized = true;
    LambdaLog.instance = this;
  }

  public getIsInitialized () {
    return LambdaLog.isInitialized;
  }

  public clearErrorBufferState () {
    this.errorOccurred = false;
    this.bufferedLines = [];
  }

  public setTraceId (traceId: string) {
    this.traceId = traceId;
  }

  public getTraceId () {
    return this.traceId;
  }

  stringToLevel (str: string) {
    switch (str) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARNING;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'AUDIT':
        return LogLevel.AUDIT;
      default:
        return null;
    }
  }

  public setLogLevelString (logLevelStr: string) {
    let level = this.stringToLevel(logLevelStr);

    if (level === null || level === undefined) {
      /* Defaults to everything if nothing passed in, like if ENV variable evaluates to empty */
      this.logLevel = level = LogLevel.DEBUG;
      this.info('Log level not set, defaulting to DEBUG');
    }

    /* Protect that IF passed in and is unsupported level, won't happen but extra safety */
    if (level < LogLevel.DEBUG && level > LogLevel.AUDIT) { throw new Error('Invalid Log Level'); }

    this.logLevel = level;
  }

  public setLogLevel (logLevel: LogLevel) {
    /* Protect that IF passed in and is unsupported level, won't happen but extra safety */
    if (logLevel < LogLevel.DEBUG && logLevel > LogLevel.AUDIT) { throw new Error('Invalid Log Level'); }

    this.logLevel = logLevel;
  }

  public getLogLevel () {
    return this.logLevel;
  }

  public start (logLevelStr: string, traceId: string) {
    this.setLogLevelString(logLevelStr)
    this.setTraceId(traceId);
    this.clearErrorBufferState();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private log (logLevel: LogLevel, message: string | Error | AuditLog, optionalParams: any[]) {
    let line: LogLine;
    const date = new Date();
    if (message instanceof Error) {
      line = {
        date,
        level: LogLevel.ERROR,
        env: this.env,
        msg: message.message,
        args: message.stack?.toString(),
        traceId: this.traceId,
        error: message
      };
    } else {
      line = {
        date,
        level: logLevel,
        env: this.env,
        msg: message,
        args: optionalParams,
        traceId: this.traceId
      };
    }

    this.bufferedLines.push(line);

    if (this.logLevel <= logLevel) { logLine(line); }

    if (logLevel === LogLevel.ERROR) {
      this.errorOccurred = true;
    } else if (logLevel === LogLevel.AUDIT && this.errorOccurred && this.logBufferedLinesOnError) {
      logLine(line = {
        date,
        level: LogLevel.INFO,
        env: this.env,
        msg: 'BUFFERED LOGS',
        args: this.bufferedLines.map(line => ({ ...line, level: LogLevelName[line.level] })),
        traceId: this.traceId
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public debug (message: string, ...optionalParams: any[]) {
    this.log(LogLevel.DEBUG, message, optionalParams);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public info (message: string, ...optionalParams: any[]) {
    this.log(LogLevel.INFO, message, optionalParams);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public audit (auditLog: AuditLog) {
    this.log(LogLevel.AUDIT, auditLog, []);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public warning (message: string | Error, ...optionalParams: any[]) {
    this.log(LogLevel.WARNING, message, optionalParams);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public error (message: string | Error, ...optionalParams: any[]) {
    this.log(LogLevel.ERROR, message, optionalParams);
  }
}
