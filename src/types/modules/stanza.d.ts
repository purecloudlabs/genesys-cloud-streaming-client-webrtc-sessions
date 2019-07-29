
declare module 'jingle-stanza/stanzas/jingleMessage' {
  export default function jingleMessage (stanza: Stanza): void;
}

interface Stanza { }

interface StanzaDefinition {
  name: string;
  element: string;
  namespace?: string;
  tags?: string[];
  fields?: {
    id?: string;
    [key: string]: any;
  };
}
interface Stanzas {
  utils: any;
  withDefinition (type: string, feature: string, cb: ((content) => void)): void;
  define (stanzaDef: StanzaDefinition): Stanza;
  extend (baseStanza: Stanza, newStanza: Stanza, name?: string): Stanza;
  extendPresence (stanza: any): Stanza;
  use (stanza: Stanza): void;
}
interface StanzaHandlers {
  jingle: (stanza: any) => void;
  jingleMessageInit: (stanza: any, raw?: any) => any;
  jingleMessageRetract: (stanza: any) => boolean;
  jingleMessageAccept: (stanza: any) => void;
  jingleMessageProceed: (stanza: any) => any;
  jingleMessageReject: (stanza: any) => void;
}
