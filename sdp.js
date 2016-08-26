const debug = require('debug')('rtsp:sdp');

const sdpTransform = require('sdp-transform');

function parseFmtpConfig(str) {
  const elements = str.split('; ');
  const nameValues = elements.map(e => {
    const re = /^(.+?)=(.+)/;
    const matches = re.exec(e);
    return {
      name: matches[1],
      value: matches[2],
    };
  });
  const result = nameValues.reduce(
    (res, nv) => {
      let parsedValue;
      if (nv.name === 'sprop-parameter-sets') {
        parsedValue = nv.value.split(',').map(sv => Buffer.from(sv, 'base64'));
      } else {
        parsedValue = nv.value;
      }
      return Object.assign(res, {
        [nv.name]: parsedValue,
      });
    },
    {}
  );
  return result;
}

module.exports.getVideoData = function getVideoData(sdpText) {
  debug('Обработка SDP: %s', sdpText);
  const parsedSdp = sdpTransform.parse(sdpText);

  const videoMedias = parsedSdp.media.filter(m => m.type.toLowerCase() === 'video');
  if (!videoMedias.length) {
    throw new Error('В sdp-описании нет ни одного видеотрека');
  }

  debug('Видео-трек найден.');

  const vmedia = videoMedias[0];
  const payload = vmedia.fmtp[0].payload;
  const track = vmedia.control;
  const protocol = vmedia.protocol;
  const codec = vmedia.rtp[0].codec;
  const fmtp = parseFmtpConfig(vmedia.fmtp[0].config);

  return {
    originalParsedSdp: parsedSdp,
    payload,
    track,
    protocol,
    codec,
    fmtp,
  };
};
