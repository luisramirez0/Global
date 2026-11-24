# frontend-agenda-config Specification

## Purpose

Pantallas y cliente del frontend para configurar la agenda del consultorio (sillones, prestaciones, horarios de atención y bloqueos) sobre la API de C-04, con permisos por rol en la UI y bloqueos en la hora del consultorio (C-11, US-002, US-013).

## Requirements

### Requirement: Cliente tipado de configuración de agenda
El frontend SHALL exponer un cliente tipado para `/sillones`, `/prestaciones`, `/horarios-atencion` y `/bloqueos` (listar, crear, editar y borrar) que use el cliente HTTP autenticado de la aplicación y MUST validar cada respuesta con un decodificador; una respuesta con forma inesperada MUST producir un error `unexpected`. Los ids de ruta MUST ser enteros positivos.

#### Scenario: Listado de sillones con inactivos
- **WHEN** se listan los sillones incluyendo inactivos
- **THEN** se envía `GET /sillones?incluirInactivos=true` con el token y se obtienen los sillones decodificados

#### Scenario: Respuesta con forma inesperada
- **WHEN** la API responde un sillón sin `activo`
- **THEN** el cliente rechaza con un error `unexpected`

#### Scenario: Borrado sin contenido
- **WHEN** se borra un bloqueo y la API responde `204`
- **THEN** la operación se resuelve sin valor

### Requirement: Pantallas de configuración
La aplicación SHALL ofrecer las rutas protegidas `#/config/sillones`, `#/config/prestaciones`, `#/config/horarios` y `#/config/bloqueos`, cada una con un `h1`, una navegación secundaria etiquetada que marque la sección actual con `aria-current="page"`, el listado del recurso y, si el rol lo permite, un formulario de alta y edición. Todo dato de la API MUST mostrarse como texto literal.

#### Scenario: Listado de sillones
- **GIVEN** la API devuelve los sillones `Sillón 1` y `Sillón 2`
- **WHEN** se abre `#/config/sillones`
- **THEN** se listan ambos con su estado

#### Scenario: Nombre malicioso
- **GIVEN** una prestación llamada `<img src=x onerror=alert(1)>`
- **WHEN** se muestra el listado
- **THEN** se ve el texto literal y el documento no contiene elementos `img`

#### Scenario: Error al cargar
- **WHEN** el listado falla por red
- **THEN** se muestra un mensaje de conexión y un botón "Reintentar"

### Requirement: Alta, edición y baja
El formulario SHALL crear con `POST` y, tras "Editar", reemplazar con `PUT`. La edición de sillones y prestaciones MUST omitir `activo`. Borrar MUST pedir una confirmación en la misma fila antes de llamar a la API. Tras una operación exitosa se MUST recargar el listado y anunciar el resultado en una región de estado.

#### Scenario: Alta de prestación
- **WHEN** se envía `Limpieza` con 30 minutos
- **THEN** se llama a crear con `{nombre: "Limpieza", duracionMinutos: 30}` y el listado se recarga

#### Scenario: Confirmación de baja
- **WHEN** se pulsa "Dar de baja" en un sillón
- **THEN** no se llama a la API hasta pulsar "Confirmar", y "Cancelar" restituye la fila

#### Scenario: Reactivación
- **GIVEN** se muestran los sillones inactivos
- **WHEN** se pulsa "Reactivar" en `Sillón 2`
- **THEN** se envía `PUT` con `{nombre: "Sillón 2", activo: true}`

### Requirement: Validación de formularios de configuración
Antes de enviar, el frontend SHALL validar con las mismas reglas que el backend: nombre obligatorio (100 caracteres en sillones, 150 en prestaciones), duración entera positiva múltiplo de la grilla, día 1..7, horas `HH:mm` alineadas a la grilla con desde < hasta, inicio y fin de bloqueo obligatorios con fin posterior al inicio y motivo de hasta 255 bytes UTF-8. Un dato inválido MUST marcarse en su campo (`aria-invalid` y mensaje enlazado) sin llamar a la API. Los errores por campo de un `400` MUST mostrarse en el campo correspondiente.

#### Scenario: Duración fuera de la grilla
- **WHEN** se envía una prestación de 20 minutos
- **THEN** el campo duración indica que debe ser múltiplo de 15 y no hay request

#### Scenario: Franja invertida
- **WHEN** se envía un horario de 12:00 a 09:00
- **THEN** el campo hasta muestra un error y no hay request

#### Scenario: Error de campo del servidor
- **WHEN** la API responde `400` con `errores[{campo: "nombre"}]`
- **THEN** el campo nombre muestra el mensaje del servidor

### Requirement: Mensajes de conflicto y error
Los errores de la API SHALL mostrarse con mensajes fijos según el contexto, nunca con el `detail` del servidor: `409` en alta o reactivación de sillón → límite de sillones activos; `409` en baja o desactivación de sillón → debe quedar al menos uno activo; `409` en horarios → franja superpuesta; `404` → el registro ya no existe (y se recarga el listado); `403` → sin permiso; `422` en horarios → no se pudo asignar el profesional.

#### Scenario: Tercer sillón
- **WHEN** el alta de un sillón responde `409`
- **THEN** se muestra que el máximo es de 2 sillones activos

#### Scenario: Último sillón activo
- **WHEN** la baja de un sillón responde `409`
- **THEN** se muestra que debe quedar al menos un sillón activo

### Requirement: Permisos por rol en la configuración
Con rol `ADMIN` o `PROFESIONAL` la UI SHALL ofrecer todas las acciones. Con rol `RECEPCION`, en sillones, prestaciones y horarios la página MUST NOT renderizar el formulario de alta y edición ni las acciones de fila, y MUST indicar que es de solo lectura; en bloqueos MUST ofrecer alta y edición pero MUST NOT ofrecer "Eliminar". Sin perfil cargado la página MUST comportarse como de solo lectura.

#### Scenario: Recepción en prestaciones
- **GIVEN** una sesión con rol `RECEPCION`
- **WHEN** se abre `#/config/prestaciones`
- **THEN** se lista el recurso y el documento no contiene ningún `form` ni botones "Editar" o "Dar de baja"

#### Scenario: Recepción en bloqueos
- **GIVEN** una sesión con rol `RECEPCION`
- **WHEN** se abre `#/config/bloqueos`
- **THEN** hay formulario y botón "Editar", y no hay botón "Eliminar"

### Requirement: Bloqueos en la hora del consultorio
Los bloqueos SHALL ingresarse y mostrarse en la hora de `America/Argentina/Buenos_Aires` y MUST enviarse y recibirse en UTC (ISO-8601). La conversión MUST dar el mismo resultado cualquiera sea la zona horaria del entorno de ejecución. El listado MUST filtrar por defecto desde las 00:00 del día actual en Argentina; "Hasta" es inclusivo. El alcance SHALL elegirse entre todo el consultorio o un sillón, y un `profesionalId` existente MUST conservarse al editar.

#### Scenario: Noche en Argentina
- **WHEN** se crea un bloqueo con inicio `2026-11-24 21:00` y fin `2026-11-24 23:59` (hora de Argentina)
- **THEN** se envían `inicio` `2026-11-25T00:00:00Z` y `fin` `2026-11-25T02:59:00Z`

#### Scenario: Independencia de la zona del entorno
- **GIVEN** el proceso corre con `TZ=Asia/Tokyo`
- **WHEN** se convierte `2026-11-24 23:30` de Argentina a UTC
- **THEN** el resultado es `2026-11-25T02:30:00Z`

#### Scenario: Hoy en Argentina
- **GIVEN** el reloj marca `2026-11-25T02:30:00Z` (23:30 del 24 en Argentina)
- **WHEN** se abre `#/config/bloqueos`
- **THEN** el filtro "Desde" es `2026-11-24` y se listan bloqueos desde `2026-11-24T03:00:00Z`

#### Scenario: Profesional conservado
- **GIVEN** un bloqueo con `profesionalId` 7
- **WHEN** se edita su motivo
- **THEN** el `PUT` envía `profesionalId` 7
