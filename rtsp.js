// RTSP lite
// RFC2326 https://tools.ietf.org/html/rfc2326

const debug = require('debug')('rtsp:rtsp');

const net = require('net');
const events = require('events');
const url = require('url');
const crypto = require('crypto');
const caseless = require('caseless');
const uuid = require('node-uuid');

const EventEmitter = events.EventEmitter;

const DEFAULT_RTSP_PORT = 554;
const DEFAULT_USER_AGENT = 'Node.js';

function parseResponse(data) {
  const dataString = data.toString('utf8');
  const firstEnding = dataString.indexOf('\r\n\r\n');

  const lines = dataString
    .slice(0, firstEnding)
    .split('\r\n')
    .filter(line => line) // Фильтр пустых строк
  ;

  const body = dataString.slice(firstEnding + 4);

  const responseHead = lines[0];
  const headerLines = lines.slice(1);

  const status = parseInt(responseHead.slice(9, 12), 10);
  const headers = headerLines.reduce(
    (result, hline) => Object.assign(result, {
      [hline.slice(0, hline.indexOf(':'))]: hline.slice(hline.indexOf(':') + 2),
    }),
    {}
  );

  return {
    responseHead,
    status,
    headers,
    body,
  };
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function ha1Compute(algorithm, user, realm, pass, nonce, cnonce) {
  const ha1 = md5(`${user}:${realm}:${pass}`);

  if (algorithm && algorithm.toLowerCase() === 'md5-sess') {
    return md5(`${ha1}:${nonce}:${cnonce}`);
  }

  return ha1;
}

module.exports = class RtspConnection extends EventEmitter {

  constructor(rtspUrl, options) {
    super();

    debug('Создание RtspConnection для %s', rtspUrl);

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
    this.userAgent = (options && options.userAgent) || DEFAULT_USER_AGENT;

    this.fullUrl = url.format({
      protocol: this.protocol,
      slashes: true,
      hostname: this.hostname,
      port: this.port,
      pathname: urlObject.pathname,
      search: urlObject.search,
    });

    // Проверка
    if (!(this.protocol === 'rtsp:' && this.hostname)) {
      throw new Error('Invalid rtsp url.');
    }

    // Внутреннее состояние
    this.currentCSeq = 0;
    this.requests = {
      // Здесь будут объекты-запросы
    };
  }

  connect() {
    debug('Соединение с %s', this.fullUrl);
    this.socket = net.connect({
      host: this.hostname,
      port: this.port,
    });
    this.socket.on('connect', () => {
      debug('Соединение с %s - успешно.', this.fullUrl);
      this.emit('connect');
    });
    this.socket.on('data', data => {
      debug('Пришли данные от %s: %s', this.fullUrl, data.toString('utf8'));
      this.handleData(data);
    });
    this.socket.on('end', () => {
      debug('socket end');
      this.disconnected = true;
      this.emit('end');
    });
    this.socket.on('error', err => {
      debug('socket error');
      this.emit('error', err);
    });
    // TODO
  }

  // method: OPTIONS/DESCRIBE/...
  // headers: { CSeq: 13, 'User-agent': 'me' }
  sendRequest(method, addPath, headers, body) {
    if (!method) {
      throw new Error('Method should be defined.');
    }

    if (this.disconnected) {
      throw new Error('Попытка послать запрос после рассоединения.');
    }

    const headersToSend = headers || {};

    debug('sending %s request to %s', method, this.fullUrl);

    let reqString = `${method} ${this.fullUrl} RTSP/1.0\r\n`;
    Object.keys(headersToSend).forEach(headerKey => {
      reqString += `${headerKey}: ${headersToSend[headerKey]}\r\n`;
    });
    if (body) { reqString += body; }
    reqString += '\r\n;';

    debug('writing to socket: %s', reqString);

    this.socket.write(reqString);
  }

  request(method, addPath, headers, callback) {
    if (!(method && callback)) {
      throw new Error('Method and callback must be provided.');
    }

    debug('requesting %s from %s', method, this.fullUrl);

    const headersToUse = headers || {};

    this.currentCSeq += 1;
    this.requests[this.currentCSeq] = {
      CSeq: this.currentCSeq,
      method,
      addPath,
      originalHeaders: headersToUse,
      callback,
    };

    const headersToSend = Object.assign({}, headersToUse, {
      CSeq: this.currentCSeq,
      'User-Agent': this.userAgent,
    });

    this.sendRequest(method, addPath, headersToSend);
  }

  handleData(data) {
    debug('Обработка входящих данных');

    const response = parseResponse(data);

    // TODO: Авторизация if (response.status === 401) { ... }

    const c = caseless(response.headers);

    const CSeq = c.get('CSeq');

    if (!CSeq) {
      // TODO
      throw new Error('В ответе отсутствует Cseq');
    }

    const request = this.requests[CSeq];

    if (!request) {
      // TODO: Обработать эту ситуацию более мягко
      throw new Error(`Пришёл ответ с CSeq=${CSeq}, на который не ожидается ответ`);
    }

    delete this.requests[CSeq];

    if (response.status === 401) {
      // Требуется авторизация
      // ref https://github.com/request/request/blob/473cae3c89683885de2c6b73c2a7c3b4c43ce56a/lib/auth.js#L51

      this.needAuth = true;
      this.responseAuthHeader = c.get('www-authenticate');

      const authVerb = this.responseAuthHeader &&
        this.responseAuthHeader.split(' ')[0].toLowerCase()
      ;
      if (authVerb !== 'digest') {
        throw new Error(`Авторизация ${authVerb} не поддерживается.`);
      }

      return this.request(
        request.method,
        request.addPath,
        Object.assign({}, request.originalHeaders, {
          Authorization: this.calcDigestAuth(
            request.method, request.addPath, this.responseAuthHeader
          ),
        }),
        request.callback
      );
    }

    return request.callback(null, response);
  }

  calcDigestAuth(method, addPath, authHeader) {
    const challenge = {};
    const re = /([a-z0-9_-]+)=(?:"([^"]+)"|([a-z0-9_-]+))/gi;
    for (;;) {
      const match = re.exec(authHeader);
      if (!match) { break; }
      challenge[match[1]] = match[2] || match[3];
    }

    const qop = /(^|,)\s*auth\s*($|,)/.test(challenge.qop) && 'auth';
    const nc = qop && '00000001';
    const cnonce = qop && uuid().replace(/-/g, '');
    const ha1 = ha1Compute(
      challenge.algorithm, this.username, challenge.realm,
      this.password, challenge.nonce, cnonce
    );
    const ha2 = md5(`${method}:${this.fullUrl + addPath}`);
    const digestResponse = qop ?
      md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`) :
      md5(`${ha1}:${challenge.nonce}:${ha2}`)
    ;
    const authValues = {
      username: this.username,
      realm: challenge.realm,
      nonce: challenge.nonce,
      uri: this.fullUrl + addPath,
      qop,
      response: digestResponse,
      nc,
      cnonce,
      algorithm: challenge.algorithm,
      opaque: challenge.opaque,
    };

    const authParts = Object.keys(authValues).reduce(
      (result, k) => {
        if (authValues[k]) {
          if (k === 'qop' || k === 'nc' || k === 'algorith') {
            return result.concat([`${k}=${authValues[k]}`]);
          }
          return result.concat([`${k}="${authValues[k]}"`]);
        }
        return result;
      },
      []
    );

    return `Digest ${authParts.join(', ')}`;
  }

};
