Подборка материала
==================

Материал для работы (RTSP -> mp4-фрагменты):
- [RFC2326](https://tools.ietf.org/html/rfc2326) RTSP
- [RFC7616](https://tools.ietf.org/html/rfc7616) Digest-авторизация
- [RFC4566](https://tools.ietf.org/html/rfc4566) SDP (Session Description Protocol)
- [RFC3550](https://tools.ietf.org/html/rfc3550) RTP и RTCP
- [Про RTP AVP -RTP Audio Video Profile-](https://en.wikipedia.org/wiki/RTP_audio_video_profile)
[RFC6184](https://tools.ietf.org/html/rfc6184) Особенности передачи H.264 по RTP (про NAL-юниты и прочее),
- Вот здесь и около ребята запаковывают H.264-траффик, приходящий в RTP, в ISO-BMFF(mp4)-фрагменты на лету на javascript’е https://github.com/SpecForge/html5_rtsp_player/blob/master/src/iso-bmff/mp4-generator.js
https://github.com/SpecForge/html5_rtsp_player/blob/master/src/remuxer/h264.js
(не проверял работу, но у них есть рабочее демо в интернете)
- Факультативно: статьи про частый/типичный баг в работе кодеров камер, который неплохо бы учесть в софтине:
https://m.habrahabr.ru/post/213063/
https://m.habrahabr.ru/post/219491/
- Пока предполагаю, что залезать глубоко в H.264 не придётся. Но как оно окажется - непонятно.
Digest-автооризация вот здесь реализована в request:
https://github.com/request/request/blob/473cae3c89683885de2c6b73c2a7c3b4c43ce56a/lib/auth.js

P.S. По предварительному изучению материала по диагонали: действительно, как Артём уже говорил, скорее всего создать “RTSP-мультиплексор” нет никаких проблем. Если клиенты не будут слать экзотические запросы типа PAUSE (0.0001% вероятности) или слать по RTCP отчёты, из которых теоретически сервер должен корректировать выдачу (0.001% вероятности), то траффик условно можно рассылать всем одинаковый.


Заявление Артёма, которое предстоит воспроизвести и подтвердить
===============================================================

Что уже можно, на чистом `js`
1. Брать поток `rtsp`
2. Из `RTSP` брать `SDP`
3. Из `SDP` брать `SPS` и `PPS`
4. Из `RTP` брать `Sequence number`, `Synchronization Source identifier`, `Payload`, `Marker`
5. Из `Payload`  брать `NAL`
6. Из `NAL` брать `NAL Type`
7. Из  `NAL Type`  брать `Frame segmentation`,  `NAL: I P B`,  восстанавливать `NAL`
8.  Получать `Frame` и опять все по кругу с `п. 4`

Итог: можно захватывать поток `RTSP`,  резать нужной длины, резать правильно (`I, P, B Frame`),  получать файл с которым можно работать дальше, на него не ругается  `ffmpeg`,  далее `ffmpeg` может спокойно передать этот файл в `DASH` сегмент или `ISO-BMFF`

ложка дегтя потеря пакетов UDP, из за них видео становиться невозможным для проигрывания
