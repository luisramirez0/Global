# Global (SaaS de turnos odontológicos) — Base de Conocimiento

Base de conocimiento generada a partir de `discovery/discovery.md`, `discovery/sources/*.md`, la sección `discovery` del estado de fundación y las decisiones confirmadas por el usuario el 2026-11-23. Fuente `docs/consigna.txt` **ausente** (ver IN-01).

## Índice de Archivos

| Archivo | Contenido |
|---------|-----------|
| [01_vision_y_objetivos.md](01_vision_y_objetivos.md) | Propósito, segmento, alcance MVP y fuera de alcance |
| [02_descripcion_general.md](02_descripcion_general.md) | Stack fijo, arquitectura, integraciones, API |
| [03_actores_y_roles.md](03_actores_y_roles.md) | Actores, RBAC, rutas públicas |
| [04_modelo_de_datos.md](04_modelo_de_datos.md) | Entidades, ERD, seed |
| [05_reglas_de_negocio.md](05_reglas_de_negocio.md) | Reglas RN-XX |
| [06_funcionalidades.md](06_funcionalidades.md) | Épicas e historias |
| [07_flujos_principales.md](07_flujos_principales.md) | Flujos extremo a extremo |
| [08_arquitectura_propuesta.md](08_arquitectura_propuesta.md) | Patrones, directorios, seguridad, env vars |
| [09_decisiones_y_supuestos.md](09_decisiones_y_supuestos.md) | DD-xx y SU-xx |
| [10_preguntas_abiertas.md](10_preguntas_abiertas.md) | Riesgos, inconsistencias, preguntas |

## Quick Start para Desarrolladores

1. Dominio -> [01](01_vision_y_objetivos.md), [03](03_actores_y_roles.md)
2. Datos -> [04](04_modelo_de_datos.md)
3. Reglas -> [05](05_reglas_de_negocio.md)
4. Arquitectura -> [02](02_descripcion_general.md), [08](08_arquitectura_propuesta.md)
5. Implementar -> [07](07_flujos_principales.md), [06](06_funcionalidades.md)
6. Antes de codificar -> [10](10_preguntas_abiertas.md)

## Resumen Ejecutivo

SaaS comercial argentino de agenda odontológica para **odontólogo independiente** (1–2 sillones), construido con TypeScript vanilla + Spring Boot/MySQL, con presupuesto cero (recordatorios por wa.me y SMTP gratuito). MVP: turnos sin solapamiento + ficha básica de paciente + auditoría. Riesgo principal: plazo del 25/11/2026 para el trabajo completo.
