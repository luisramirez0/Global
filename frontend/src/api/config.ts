const DEFAULT_API_BASE_URL = 'http://localhost:8080/api';

export function resolveApiBaseUrl(raw: string | undefined): string {
  if (raw === undefined || raw === '') {
    return DEFAULT_API_BASE_URL;
  }
  return raw.replace(/\/+$/, '');
}

export const API_BASE_URL: string = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL as string | undefined,
);
