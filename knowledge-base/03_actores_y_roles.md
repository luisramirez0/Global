# Actores y Roles

## Actores del sistema

| Actor | Descripción | Cómo interactúa | Etapa |
|---|---|---|---|
| Odontólogo (rol `PROFESIONAL`, dueño del consultorio) | Profesional independiente, 1–2 sillones | Usa la SPA: agenda, pacientes, ficha, recordatorios | MVP |
| Administrador del consultorio (`ADMIN`) | En el independiente coincide con el odontólogo | Configura consultorio, prestaciones, usuarios | MVP (mismo usuario) |
| Recepcionista/secretaria (`RECEPCION`) | Gestiona agenda y pacientes, sin acceso clínico completo | SPA | Posterior (el modelo ya lo contempla) |
| Paciente | Recibe recordatorios, confirma/cancela | MVP: por WhatsApp/email, sin cuenta. Posterior: enlace público de reserva | MVP parcial |
| Equipo/operador de plataforma (`SUPERADMIN`) | Soporte del SaaS | Solo uso interno | Posterior |

Nota: Clínica con varios profesionales y administrador/dueño de clínica quedan para etapas posteriores; el modelo de datos los admite (DD-01, DD-02).

## RBAC — Matriz de permisos (propuesta)

C=crear, R=leer, U=actualizar, D=eliminar/anular, —=sin acceso.

| Recurso | ADMIN/PROFESIONAL | RECEPCION |
|---|---|---|
| Consultorio, prestaciones, sillones | CRUD | R |
| Usuarios del consultorio | CRUD | — |
| Pacientes (datos de contacto) | CRUD | CRU |
| Ficha clínica / anamnesis / notas | CRU | — (a confirmar, ver PA-07) |
| Turnos | CRUD | CRUD |
| Bloqueos de agenda | CRUD | CRU |
| Recordatorios | enviar | enviar |
| Auditoría | R | — |
| Exportación de datos | R | — |

Todo acceso queda filtrado por `consultorio_id` del usuario autenticado (RN-MT-01).

## Rutas públicas (sin autenticación)

- Login y registro de consultorio/odontólogo.
- Páginas estáticas del frontend (landing, términos y política de privacidad).
- (Posterior) enlace público de reserva/confirmación/cancelación con token firmado y de un solo uso por turno.
