import { decodeLogin, decodeMe, decodeRegistro } from './decoders';
import type { HttpClient } from './http';
import type { LoginRequest, LoginResponse, MeResponse, RegistroRequest, RegistroResponse } from './types';

/** Endpoints de autenticación de C-03. */
export interface AuthApi {
  register(request: RegistroRequest): Promise<RegistroResponse>;
  login(request: LoginRequest): Promise<LoginResponse>;
  me(): Promise<MeResponse>;
}

export function createAuthApi(http: HttpClient): AuthApi {
  return {
    register(request) {
      const { matricula, ...rest } = request;
      const body = matricula === undefined || matricula === '' ? rest : { ...rest, matricula };
      return http.request('POST', '/auth/register', { auth: false, body, decode: decodeRegistro });
    },
    login(request) {
      return http.request('POST', '/auth/login', { auth: false, body: request, decode: decodeLogin });
    },
    me() {
      return http.request('GET', '/auth/me', { decode: decodeMe });
    },
  };
}
