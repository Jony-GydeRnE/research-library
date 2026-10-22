/* Shared SSE reader: network chunks are bytes, not event boundaries. */
(function (root) {
  'use strict';
  async function readJSONEvents(response, onEvent) {
    if (!response.ok) throw new Error('Request failed (HTTP ' + response.status + ')');
    if (!response.body) throw new Error('Response has no stream');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', dataLines = [], terminal = false;

    async function line(text) {
      if (text.endsWith('\r')) text = text.slice(0, -1);
      if (text === '') {
        if (!dataLines.length) return;
        const event = JSON.parse(dataLines.join('\n'));
        dataLines = [];
        await onEvent(event);
        if (event.type === 'done' || event.type === 'error') terminal = true;
      } else if (text.startsWith('data:')) {
        dataLines.push(text.slice(5).replace(/^ /, ''));
      }
    }
    try {
      while (!terminal) {
        const { value, done } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        let end;
        while (!terminal && (end = buffer.indexOf('\n')) !== -1) {
          const current = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          await line(current);
        }
        if (done) {
          if (!terminal && buffer) await line(buffer);
          if (!terminal) await line('');
          if (!terminal) throw new Error('Connection ended before the reply was saved');
          break;
        }
      }
    } finally {
      // The terminal event is sufficient; release the connection even if
      // the server has not yet closed it. Never mask the original error.
      try { await reader.cancel(); } catch (_) {}
      reader.releaseLock();
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { readJSONEvents };
  else root.GydeSSE = { readJSONEvents };
})(typeof window !== 'undefined' ? window : globalThis);
