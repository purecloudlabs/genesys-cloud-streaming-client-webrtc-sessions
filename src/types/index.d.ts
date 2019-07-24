declare module 'wildemitter' {
  export default class WildEmitter {
    constructor ();
    on (event: string, handler?: any, details?: any): void;
    emit (event: string, message?: any, details?: any, fourth?: any): void;
    off (event: string, handler?: any): void;
  }
}
