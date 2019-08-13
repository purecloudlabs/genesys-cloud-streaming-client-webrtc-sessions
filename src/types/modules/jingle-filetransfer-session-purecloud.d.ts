declare module 'jingle-filetransfer-session-purecloud' {
  import MediaSession, { MediaSessionOptions } from 'jingle-media-session-purecloud';
  import BaseSession from 'jingle-session';

  export default class MediaFileTransferSession extends BaseSession {

    readonly channels: { [key: string]: RTCDataChannel };

    constructor (options: MediaSessionOptions);

    start (offerOptions: any, next?: (() => void)): void;
    sendDirectly (channel: RTCDataChannel, messageType: string, creator: any, payload: any): boolean;
    getDataChannel (name: string, opts: any): RTCDataChannel;
    handleDataChannelAdded (channel: RTCDataChannel): void;
    _observeDataChannel (channel: RTCDataChannel): void;
  }
}
