import '@testing-library/jest-dom';

// jsdom's Blob.slice() returns a Blob whose .arrayBuffer() is not implemented.
// This polyfill covers detectMime and processFiles, which slice a small header
// and then call .arrayBuffer() on it.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('loadend', () => resolve(reader.result as ArrayBuffer));
      reader.addEventListener('error', () => reject(reader.error));
      reader.readAsArrayBuffer(this);
    });
  };
}
