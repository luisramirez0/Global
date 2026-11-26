# Spec Delta

## MODIFIED Requirements

### Requirement: Perfiles dev y test
El backend SHALL ofrecer un perfil `dev` que usa MySQL vía variables de entorno y un perfil `test` que usa H2 en memoria en modo MySQL; en todos los perfiles el esquema MUST gestionarse solo con Flyway y Hibernate MUST validar sin modificar el esquema. La configuración MUST NOT declarar un perfil por defecto ni activo: el perfil lo fija quien arranca la aplicación.

#### Scenario: Perfil de test autocontenido
- **WHEN** se ejecutan los tests sin ninguna variable de entorno definida
- **THEN** la aplicación arranca con el perfil `test` y la base H2

#### Scenario: Hibernate no altera el esquema
- **WHEN** la aplicación arranca en cualquier perfil
- **THEN** Hibernate está configurado en `validate` o `none` y no crea ni altera tablas

#### Scenario: Sin perfil por defecto
- **WHEN** se lee `application.yml`
- **THEN** no define `spring.profiles.default` ni `spring.profiles.active`, así que un arranque sin `SPRING_PROFILES_ACTIVE` no activa el seed de desarrollo

### Requirement: Entorno local reproducible
El repositorio SHALL incluir un `docker-compose.yml` que define MySQL 8, el backend y el frontend estático, con el backend esperando a que MySQL esté sano, leyendo su configuración de `.env` y arrancando con `SPRING_PROFILES_ACTIVE: dev`. MySQL MUST publicarse solo en `127.0.0.1`, y el frontend SHALL servir `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: no-referrer`.

#### Scenario: Definición de Compose válida
- **GIVEN** existe `.env` copiado de `.env.example`
- **WHEN** se ejecuta `docker compose config`
- **THEN** el comando termina sin errores y lista los servicios `mysql`, `backend` y `frontend`

#### Scenario: Perfil dev desde Compose
- **WHEN** se lee `docker-compose.yml`
- **THEN** el servicio `backend` define `SPRING_PROFILES_ACTIVE: dev`

#### Scenario: MySQL solo local
- **WHEN** se levanta el stack
- **THEN** el puerto 3306 de MySQL está publicado en `127.0.0.1` y no en todas las interfaces

#### Scenario: Headers de seguridad del frontend
- **WHEN** se pide `GET /` al frontend servido por nginx
- **THEN** la respuesta incluye `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: no-referrer`
