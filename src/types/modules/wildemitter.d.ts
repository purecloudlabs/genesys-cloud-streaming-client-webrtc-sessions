declare module 'wildemitter' {
  export default class WildEmitter {
    constructor ();
    on (event: string, groupName: string, callback?: (...args: any[]) => void): void;
    on (event: string, callback: (...args: any[]) => void): void;
    once (event: string, groupName: string, callback?: (...args: any[]) => void): void;
    once (event: string, callback: (...args: any[]) => void): void;
    releaseGroup (groupName: string): void;
    off (event: string, callback?: (...args: any[]) => void): void;
    emit (event: string, ...args: any[]): void;
  }
}
