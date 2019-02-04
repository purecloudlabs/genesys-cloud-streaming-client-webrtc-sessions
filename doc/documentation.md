# PureCloud Streaming Client WebRTC Sessions Extension

This extension for the streaming client supports receiving inbound and outbound
WebRTC Softphone audio sessions. The API is used in conjunction with the public
API for call controls.

When initiating a conversation that will use a WebRTC session, the call is placed
via the Public API, and an incoming request will be evented via the extension.

It is up to the consuming application to link the outbound session returned from
the API request and push notification events to the WebRTC session by comparing
`conversationId` properties. The incoming session will include a `conversationId`
attribute with the associated `conversationId`.

## Session Flow

WebRTC Softphone sessions use an initiation/discovery flow before media is
established so that a user can decide which client (i.e., device or
browser tab) will be used to establish the session media.

The two primary differences for incoming calls and outbound calls are:

1. Outbound placed calls should be automatically accepted on the client that
requested the outbound call, or by a client designed to handle all outbound calls.
2. Outbound calls require an initial REST request to the public API to initiate.

```text
Outbound

Alice                       Public API         webrtcSessions
   |                            |                     |
   |    make new call (1)       |                     |    1. POST to api/v2/conversation/calls
   +--------------------------->|                     |
   |                            |                     |
   |   return conversationId*   |                     |
   |<---------------------------+                     |
   |                            |    propose* (2)     |    2. Event on webrtcSessions (see events below)
   |<-------------------------------------------------+
   |                            |                     |
   |    proceed (3)             |                     |    3. Sent by accepting the proposed session
   +------------------------------------------------->|
   |                            |                     |
   |                            |    initiate (4)     |    4. Full session details in an event on webrtcSessions
   |<-------------------------------------------------|
   |     accept (5)             |                     |    5. Sent by accepting the session
   +------------------------------------------------->|       (programmatically, or automatically based on config)
   |                            |                     |
```

```text
Inbound

Alice                     PubSub Extension    webrtcSessions
   |                            |                  |
   |      notification* (1)     |                  |    1. A pub sub notification pushed to client via Notifications
   |<---------------------------+                  |       API websocket with incoming call details^
   |                            |   propose* (2)   |    2. Event on webrtcSessions (see events below)
   |<----------------------------------------------+
   |                            |                  |
   |       proceed (3)          |                  |    3. Sent by accepting the proposed session
   +---------------------------------------------->|        on a single client
   |                            |                  |
   |                            |  initiate (4)    |    4. Full session details in an event on webrtcSessions
   |<----------------------------------------------|
   |     accept (5)             |                  |    5. Sent by accepting the session
   +---------------------------------------------->|       (programmatically, or automatically based on config)
   |                            |                  |
```
\* denotes asynchronous events/responses and order is not guaranteed.

\^ denotes events used with the pubsub extension of the streaming-client

## Usage

After creating an instance of the streaming client, your client can add event handlers for
incoming sessions (for inbound or outbound calls). `requestIncomingRtcSession` is an example
of an webrtcSessions event. You can answer and control sessions via the methods documented
below. Most call control actions, however, should be done via the PureCloud Public
API (or the Public API javascript SDK).

Once the client has a session, it can add event handlers for lower level control
over sessions. `terminated` is an example of a session event; all session events
are detailed below.

## API

###### Behavior notes

- By default, the streaming client will keep all active sessions active if the
WebSocket disconnects. It is the consuming application's responsibility to end
all pending or active sessions after a disconnect in the event that it doesn't
recover. This behavior can be disabled by providing
`rtcSessionSurvivability: false` in the streaming client constructor options.
When this is set to false and the WebSocket connection drops, all active WebRTC
connections will be disconnected.

- In the case of an outbound call, the application initiating the call should
automatically accept the pending session, which should have a conversationId
that matches the conversationId in the response to the request to place the call.
Alternatively, a client designed to handle all outbound call connections can
immediately accept pending sessions for outbound calls. If two such applications
are running simultaneously, there will be a race condition for which instance
actually connects the call audio.

- When a client sends a POST to conversations/calls (from her desired client)
for a conversation to the Public API, asynchronously, she will receive a pending
session event from the streaming clinet and a response from the public API with
the `conversationId` for the conversation. If only handling outbound calls
placed by your client, these can be correlated by conversationId together, and
should not be expected to arrive in a guaranteed order.

#### Setup

See the [API](https://github.com/purecloudlabs/purecloud-streaming-client/blob/master/doc/documentation.md#constructor) for creating an instance of the streaming client.

After creating an instance of the streaming client, the following APIs are available on the
`client.webrtcSessions` object. For example, `client.webrtcSessions.setIceServers(iceServers)`

#### Methods

`setIceServers(iceServers) : void` - Set the ICE servers to use in call negotiation

- arguments
    - `Array iceServer` - See [mdn reference](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer)

`getIceServers() : Array iceServers` - Get the ICE servers currently available

`on(event, handler) : void` - Create event handlers

`off(event, handler) : void` - Remove event handlers

`endRtcSessions(options, reason, callback)` - End matching sessions

- arguments
    - `Object options` with properties:
        - `String jid` - when provided, only sessions with matching remote peers will be ended
    - `String reason` - allows setting a reason for ending the session. Defaults to `success`
        available options defined in https://xmpp.org/extensions/xep-0166.html#def-reason

`acceptRtcSession(sessionId)`

- arguments
    - `String sessionId` - the id of the session to accept

`rejectRtcSession(sessionId)`

- arguments
    - `String sessionId` - the id of the session to reject

#### Events

`on('requestIncomingRtcSession', (sessionInfo) => {})` - a call session is being
initiated for an outbound or inbound call

- arguments
    - `Object SessionInfo` with properties:
        - `String sessionId`: the unique Id for the session proposal; used to accept or
     reject the proposal
        - `Boolean autoAnswer`: whether or not the client should auto answer the session
            - `true` for all outbound calls
            - `false` for inbound calls, unless Auto Answer is configured for the user by an admin
     public api request and/or push notifications
        - `String fromJid`: the address of the caller in xmpp format
        - `string conversationId`: id for the associated conversation object (used in
            platform API requests)

`on('cancelIncomingRtcSession', (sessionId) => {})` - the call has been canceled
due to remote disconnect or answer timeout

- arguments
    - `String sessionId`: the id of the session proposed and canceled

`on('handledIncomingRtcSession', () => {})` - another client belonging to this user
  has handled the pending session; used to stop ringing

- arguments
    - `String sessionId`: the id of the session proposed and handled

`on('rtcIceServers', (iceServers) => {})`

- arguments
    - `Array iceServers`: the array of ICE servers provided by PureCloud for use in
call negotiation

`on('incomingRtcSession', (session) => {})` - emitted when negotiation for media
on the has started; before the session has connected

- arugments
    - `Session session`: the session object used to access media streams and perform
  actions

`on('rtcSessionError', (error, details) => {})`

- arguments
    - `Error error` - the error that occurred
    - `Object details` - the details about the error

`on('traceRtcSession', (level, message, details) => {})` - get trace, debug, log, warn, and error
messages for the session manager

- arguments
    - `String level` - the log level of the message [trace|debug|log|warn|error]
    - `String message` - the log message
    - `Object details` - details about the log message


##### Session level events.

Session level events are events emitted from the `session` objects themselves,
not the streaming client or extension. These can be used if you want lower level access
and control.

`session.on('terminated', (session, reason) => {})` - the session was terminated

- arguments
    - `Session session` - the session that triggered the event
    - `string reason` - the reason that the session was terminated; valid values
  are found [here](http://xmpp.org/extensions/xep-0166.html#def-reason)

`session.on('change:connectionState', (session, connectionState) => {})` - the session's connection
state has changed

- arguments
    - `Session session` - the session that triggered the event
    - `string connectionState`

`session.on('change:interrupted', (session, interrupted) => {})` - the session's interrupted state
has changed

- arguments
     - `Session session` - the session that triggered the event
     - `Boolean interrupted` - the new interrupted state of the session

`session.on('change:active', (session, active) => {})` - the session's active state
has changed

- arguments
     - `session` - the session that triggered the event
     - `Boolean active` - the new active state of the session

`session.on('endOfCandidates' () => {})` - signals the end of candidate gathering; used to check for
potential connection issues
