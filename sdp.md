SDP
====

Пока наивная реализация, на базе модуля `sdp-transform`.

Известные косяки:
- Ищет только первый видеотрек, если его нет - throw.
- Возможно, извлекаются не все нужные данные.

Как пользоваться:

```js
const sdp = require('./sdp');

const sdpText = 'v=.........'; // Сюда реальное тело SDP

const videoData = sdp.getVideoData(sdpText);

/*
  {
    payload: 96,
    track: 'track1',
    protocol: 'RTP/AVP',
    codec: 'H264',
    fmtp: {
      'packetization-mode': '1',
      'profile-level-id': '640029',
      'sprop-parameter-sets': [
        Buffer1,
        Buffer2, ...
      ]
    },
    originalParsedSdp: { весь исходный sdp в JSON },
  }
*/
```
