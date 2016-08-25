RTSP
====

Пока наивная реализация.

Известные косяки:
- Нет авторизации.
- Плохо обрабатываются пограничные случаи.

Как пользоваться:

```js
const RtspConnection = require('./rtsp');

const rtspCon = new RtspConnection('rtsp://host.name/sdp-path');

rtspCon.on('end', () => {
  console.log('Рассоединение!');
});

rtspCon.on('connect', () => {
  const headers = {
    'User-Agent': 'here I am',
  };

  rtspCon.request('OPTIONS', '/addPath', {}, response => {
    console.log(response);
  });
});

/*
  {
    responseHead: 'RTSP/1.0 200 OK',
    status: 200,
    headers: {
      CSeq: 1,
      Date: 'Thu, Aug 25 2016 11:30:38 GMT',
      Public: 'OPTIONS, DESCRIBE, SETUP, TEARDOWN, PLAY, PAUSE'
    }
  }
*/

```
