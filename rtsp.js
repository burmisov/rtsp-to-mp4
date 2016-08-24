// RTSP lite
// RFC2326 https://tools.ietf.org/html/rfc2326

const net = require('net');
const events = require('events');
const url = require('url');

const EventEmitter = events.EventEmitter;

const DEFAULT_RTSP_PORT = 554;

module.exports = class RtspConnection extends EventEmitter {

  constructor(rtspUrl) {
    super();

    // Парсинг rtsp url
    const urlObject = url.parse(rtspUrl);
    this.protocol = urlObject.protocol;
    this.hostname = urlObject.hostname;
    this.port = urlObject.port || DEFAULT_RTSP_PORT;
    this.path = urlObject.path;
    if (urlObject.auth) {
      // username[:password]
      const colonIndex = urlObject.auth.indexOf(':');
      if (colonIndex > -1) {
        // username:password
        this.username = urlObject.auth.slice(0, colonIndex);
        this.password = urlObject.auth.slice(colonIndex + 1);
      } else {
        // username
        this.username = urlObject.auth;
      }
    }

    // Проверка
    if (!(this.protocol === 'rtsp:' && this.hostname)) {
      throw new Error('Invalid rtsp url.');
    }
  }

  connect() {
    // TODO
    this.socket = net.connect({
      host: this.hostname,
      port: this.port,
    });
    this.socket.on('connect', () => {
      console.log('connected!');
    });
  }

};
