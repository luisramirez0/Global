import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './config';

describe('resolveApiBaseUrl', () => {
  it('quita la barra final', () => {
    expect(resolveApiBaseUrl('https://api.ejemplo.test/api/')).toBe('https://api.ejemplo.test/api');
  });

  it('usa el default local cuando no hay valor', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('http://localhost:8080/api');
  });

  it('usa el default local con cadena vacia', () => {
    expect(resolveApiBaseUrl('')).toBe('http://localhost:8080/api');
  });

  it('deja igual una URL sin barra final', () => {
    expect(resolveApiBaseUrl('https://api.ejemplo.test/api')).toBe('https://api.ejemplo.test/api');
  });
});
