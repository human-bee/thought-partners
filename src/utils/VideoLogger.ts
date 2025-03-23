/**
 * VideoLogger - Utility for consistent logging in VideoConference components
 */
export class VideoLogger {
  private static PREFIX = '[VideoConference]';
  
  /**
   * Log informational messages
   */
  public static info(message: string, ...args: any[]): void {
    console.info(`${this.PREFIX} ${message}`, ...args);
  }
  
  /**
   * Log warning messages
   */
  public static warn(message: string, ...args: any[]): void {
    console.warn(`${this.PREFIX} ${message}`, ...args);
  }
  
  /**
   * Log error messages
   */
  public static error(message: string, ...args: any[]): void {
    console.error(`${this.PREFIX} ${message}`, ...args);
  }
  
  /**
   * Log debug messages (only in development)
   */
  public static debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`${this.PREFIX} ${message}`, ...args);
    }
  }
} 