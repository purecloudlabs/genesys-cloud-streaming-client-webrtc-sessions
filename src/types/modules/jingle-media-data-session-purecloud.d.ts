declare module 'jingle-media-data-session-purecloud' {
  import MediaSession, { PCMediaSessionConstructOptions } from 'jingle-media-session-purecloud';
  import jingleMessage from 'jingle-stanza/stanzas/jingleMessage';

  export default class MediaDataSession extends MediaSession {
    readonly channels: { [key: string]: RTCDataChannel };
    constructor (options: PCMediaSessionConstructOptions);
    start (offerOptions: any, next?: (() => void)): void;
    sendDirectly (channel: RTCDataChannel, messageType: string, creator: any, payload: any): boolean;
    getDataChannel (name: string, opts: any): RTCDataChannel; // opts: this.pc.createDataChannel(name, opts);
    handleDataChannelAdded (channel: RTCDataChannel): void;
    _observeDataChannel (channel: RTCDataChannel): void;
  }
}
