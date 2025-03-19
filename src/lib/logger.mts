import { debuglog, format } from "node:util";

export type LogFunction = (message: string, ...optionalParams: unknown[]) => void;

export default class Logger {
  verbose: LogFunction;

  constructor(public name: string) {
    this.verbose = debuglog(name, (debug) => {
      this.verbose = debug;
    });
  }

  info(message: string, ...optionalParams: unknown[]): void {
    console.log(message, ...optionalParams);
  }
  
  warn(message: string, ...optionalParams: unknown[]): void {
    console.error('Warning: %s', format(message, ...optionalParams));
  }

  error(message: string, ...optionalParams: unknown[]): void {
    console.error('ERROR: %s', format(message, ...optionalParams));
  }
}