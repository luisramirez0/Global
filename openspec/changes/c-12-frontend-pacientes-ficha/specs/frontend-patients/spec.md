## ADDED Requirements

### Requirement: Cliente de pacientes tipado
El frontend SHALL ofrecer un cliente tipado sobre el `HttpClient` autenticado para `GET /api/pacientes` (`q`, `incluirInactivos`, `page`, `size`), `GET /api/pacientes/{id}`, `POST /api/pacientes`, `PUT /api/pacientes/{id}`, `DELETE /api/pacientes/{id}` y `POST /api/pacientes/{id}/reactivar`. Cada respuesta MUST validarse con un decodificador (incluido `Pagina<T>`). Un id que no sea entero positivo MUST rechazarse sin hacer la request.

#### Scenario: Búsqueda con parámetros
- **WHEN** se busca `q = "pér"` con inactivos en la página 1
- **THEN** se envía `GET /api/pacientes?q=p%C3%A9r&incluirInactivos=true&page=1&size=20` con el token

#### Scenario: Respuesta con forma inesperada
- **WHEN** la API responde un paciente sin `activo` booleano
- **THEN** la operación falla con `kind = unexpected`

#### Scenario: Id inválido
- **WHEN** se pide el paciente con id `0` o `1.5`
- **THEN** la operación falla sin enviar ninguna request

### Requirement: Lista y búsqueda de pacientes
La pantalla `#/pacientes` SHALL listar los pacientes en una tabla (apellido y nombre, DNI, teléfono, estado) con búsqueda por nombre o DNI al enviar el formulario, una casilla para incluir dados de baja y paginación anterior/siguiente. MUST mostrar estados de carga, vacío y error con "Reintentar", y MUST descartar respuestas de búsquedas anteriores. El término buscado MUST NOT aparecer en la URL.

#### Scenario: Búsqueda por DNI
- **WHEN** se busca `30.111`
- **THEN** se pide `q=30.111` y se muestran los resultados de la API

#### Scenario: Respuesta vieja descartada
- **GIVEN** una búsqueda `a` todavía pendiente
- **WHEN** se busca `b` y la respuesta de `a` llega después
- **THEN** la tabla muestra solo los resultados de `b`

#### Scenario: Sin resultados
- **WHEN** la API devuelve una página vacía
- **THEN** se muestra "No se encontraron pacientes"

### Requirement: Alta y edición de pacientes
Las pantallas `#/pacientes/nuevo` y `#/pacientes/:id` SHALL permitir cargar y editar nombre, apellido, DNI, fecha de nacimiento, sexo, teléfono, email, dirección y obra social. La validación local MUST replicar las reglas del backend (nombre y apellido obligatorios, DNI de 7–8 dígitos tras quitar separadores, teléfono E.164 opcional con ayuda de formato, email, fecha no futura, largos máximos). Los errores por campo del servidor MUST mostrarse en sus campos aunque la validación local los haya dejado pasar. Un `404` MUST mostrar "Paciente no encontrado".

#### Scenario: Validación local
- **WHEN** se envía el alta con DNI `123`
- **THEN** no se hace la request y el campo DNI muestra un error

#### Scenario: Error del servidor que la validación local deja pasar
- **GIVEN** un formulario válido según el cliente
- **WHEN** la API responde `400` con `errores: [{campo: "telefono", ...}]`
- **THEN** el campo teléfono muestra el error y lo escrito se conserva

#### Scenario: Paciente inexistente
- **WHEN** se abre `#/pacientes/999` y la API responde `404`
- **THEN** se muestra "Paciente no encontrado" sin formulario

### Requirement: DNI duplicado
Ante un `409` con `pacienteId` en alta o edición, traiga o no `codigo`, la UI SHALL marcar el campo DNI con "Ya existe un paciente con ese DNI" y ofrecer el enlace "Ver paciente existente" a `#/pacientes/<pacienteId>`. Un `409` sin `pacienteId` MUST NOT tratarse como DNI duplicado: MUST mostrar el mensaje genérico fijo de conflicto, sin marcar el DNI ni ofrecer el enlace.

#### Scenario: Duplicado con id
- **WHEN** el alta responde `409` con `pacienteId: 7`
- **THEN** se muestra el aviso y un enlace a `#/pacientes/7`

#### Scenario: Duplicado con id y código
- **WHEN** el alta responde `409` con `pacienteId: 3` y `codigo: "DNI_DUPLICADO"`
- **THEN** se muestra el aviso en el DNI y un enlace a `#/pacientes/3`, sin el código

#### Scenario: Conflicto sin id
- **WHEN** el alta o la edición responden `409` sin `pacienteId`
- **THEN** se muestra el mensaje genérico de conflicto, sin aviso en el DNI ni enlace

### Requirement: Baja y reactivación
La baja SHALL pedir confirmación en dos pasos en la fila y enviar `DELETE`. Un paciente inactivo SHALL ofrecer "Reactivar". Después de cualquiera de las dos, la lista MUST recargarse. Un `404` MUST informar que el paciente ya no existe y recargar.

#### Scenario: Baja confirmada
- **WHEN** se pulsa "Dar de baja" y luego "Confirmar"
- **THEN** se envía `DELETE /api/pacientes/{id}` y la lista se recarga

#### Scenario: Baja cancelada
- **WHEN** se pulsa "Dar de baja" y luego "Cancelar"
- **THEN** no se envía ninguna request

### Requirement: Permisos de pacientes en la UI
Los tres roles SHALL buscar, crear y editar pacientes. Para `RECEPCION`, la UI MUST NOT crear los botones "Dar de baja" y "Reactivar" ni el enlace "Ficha". El backend sigue autorizando: un `403` MUST mostrarse con un mensaje fijo.

#### Scenario: Recepción en la lista
- **GIVEN** el rol `RECEPCION`
- **WHEN** se muestra la lista con un paciente activo y uno inactivo
- **THEN** no hay botones "Dar de baja" ni "Reactivar" ni enlaces "Ficha", y sí "Editar"

#### Scenario: Profesional en la lista
- **GIVEN** el rol `PROFESIONAL`
- **WHEN** se muestra la misma lista
- **THEN** hay "Dar de baja" en el activo, "Reactivar" en el inactivo y "Ficha" en ambos

### Requirement: Datos personales mostrados como texto
Nombre, apellido, DNI, teléfono, email, dirección y obra social MUST mostrarse como texto literal, y MUST NOT guardarse en `localStorage`, `sessionStorage`, la consola, la URL ni `document.title`.

#### Scenario: Nombre malicioso
- **GIVEN** un paciente llamado `<img src=x onerror=alert(1)>`
- **WHEN** se muestra en la lista y en la edición
- **THEN** se ve el texto literal y la página no contiene elementos `img`
