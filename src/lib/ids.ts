/**
 * Creates RFC 4122-shaped identifiers without requiring a network connection.
 * Expo provides crypto.getRandomValues on supported native and web runtimes;
 * the fallback keeps local development and tests functional as well.
 */
export function createUuid(): string {
  const randomValues = new Uint8Array(16);
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.getRandomValues) {
    cryptoObject.getRandomValues(randomValues);
  } else {
    for (let index = 0; index < randomValues.length; index += 1) {
      randomValues[index] = Math.floor(Math.random() * 256);
    }
  }
  randomValues[6] = (randomValues[6] & 0x0f) | 0x40;
  randomValues[8] = (randomValues[8] & 0x3f) | 0x80;
  const hex = [...randomValues].map((value) => value.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

/** Produces a stable UUID for pre-v0.5 records while preserving their app IDs. */
export function deterministicUuid(namespace: string, id: string): string {
  const input = `${namespace}:${id}`;
  const words = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    let hash = words[wordIndex] >>> 0;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index) + wordIndex * 31;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    words[wordIndex] = hash;
  }
  const hex = words.map((word) => word.toString(16).padStart(8, '0')).join('').split('');
  hex[12] = '4';
  const variant = Number.parseInt(hex[16], 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

