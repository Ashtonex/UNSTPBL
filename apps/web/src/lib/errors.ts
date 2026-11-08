/**
 * The request never got an answer: the device is offline, the server could not be reached, or it
 * took too long. Callers use `instanceof NetworkError` to decide to queue work for later, rather
 * than matching on error message text (which breaks the moment a message is reworded).
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}
