const http = require('http');

const originalWriteHead = http.ServerResponse.prototype.writeHead;

http.ServerResponse.prototype.writeHead = function (statusCode, statusMessage, headers) {
  if (typeof statusMessage === 'object' && statusMessage != null) {
    headers = statusMessage;
    statusMessage = undefined;
  }
  const isolated = {
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  if (statusMessage) {
    return originalWriteHead.call(this, statusCode, statusMessage, { ...headers, ...isolated });
  }
  return originalWriteHead.call(this, statusCode, { ...headers, ...isolated });
};
