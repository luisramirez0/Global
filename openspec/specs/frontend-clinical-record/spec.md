# frontend-clinical-record Specification

## Purpose

Mostrar la historia clínica básica del paciente (consentimiento previo, anamnesis con control de versión y notas inmutables) solo a `ADMIN` y `PROFESIONAL`, sin crearla ni pedirla antes del consentimiento, en solo lectura para pacientes dados de baja y sin persistir ni filtrar datos de salud en el navegador.

## Requirements

### Requirement: Cliente de historia clínica tipado
El frontend SHALL ofrecer un cliente tipado para `GET`/`POST /api/pacientes/{id}/consentimientos`, `GET /api/consentimientos/texto-vigente`, `GET`/`PUT /api/pacientes/{id}/ficha` y `GET`/`POST /api/pacientes/{id}/notas`, con decodificadores para cada respuesta. Los campos clínicos `null` MUST conservarse como `null`, y `embarazo` MUST ser booleano o `null`.

#### Scenario: Ficha no cargada
- **WHEN** la API responde la ficha con todos los campos, `version` y `actualizadaEn` en `null`
- **THEN** el cliente devuelve una ficha vacía con `version = null`

#### Scenario: Forma inesperada
- **WHEN** la API responde `embarazo: "si"`
- **THEN** la operación falla con `kind = unexpected`

### Requirement: Consentimiento previo con aceptación explícita
Al abrir `#/pacientes/:id/ficha`, la UI SHALL consultar los consentimientos del paciente. Si no hay ninguno, MUST mostrar el texto vigente como texto literal con su versión, una casilla obligatoria de aceptación y el botón "Registrar consentimiento", y MUST enviar la versión recibida del servidor. Mientras no haya consentimiento, las secciones de anamnesis y notas MUST NOT existir en el DOM y MUST NOT pedirse la ficha ni las notas. Ante `409 CONSENTIMIENTO_REQUERIDO` en cualquier llamada, la UI MUST volver a ese estado y descartar los datos clínicos mostrados.

#### Scenario: Paciente sin consentimiento
- **GIVEN** la lista de consentimientos está vacía
- **WHEN** se abre la ficha
- **THEN** se muestra el texto vigente y la casilla; no hay formulario de anamnesis ni lista de notas, y no se pidió `GET /ficha` ni `GET /notas`

#### Scenario: Registrar sin marcar la casilla
- **WHEN** se intenta registrar sin marcar la casilla
- **THEN** no se envía ninguna request y la casilla muestra un error

#### Scenario: Registro exitoso
- **WHEN** se marca la casilla y se registra con el texto versión `v1`
- **THEN** se envía `POST /consentimientos` con `{versionTexto: "v1"}`, y luego se cargan la ficha y las notas

#### Scenario: Consentimiento existente
- **GIVEN** el paciente tiene un consentimiento
- **WHEN** se abre la ficha
- **THEN** se muestra la fecha y la versión del más reciente, y no se pide el texto vigente

### Requirement: Anamnesis con control de versión
Con consentimiento, la UI SHALL mostrar la anamnesis en un formulario (alergias, medicación actual, antecedentes médicos, enfermedades relevantes, embarazo de tres estados, motivo de consulta, observaciones; máximo 4000 caracteres por campo) y MUST guardar con `PUT` enviando la `version` recibida (`null` si no estaba cargada) y los campos en blanco como `null`. Ante `409 FICHA_DESACTUALIZADA`, MUST informar que otra persona la modificó, MUST conservar lo escrito sin cambiar la `version` y SHALL ofrecer "Cargar la versión actual", que recién con confirmación reemplaza el formulario.

#### Scenario: Primera carga
- **GIVEN** la ficha no estaba cargada
- **WHEN** se completa alergias y se guarda
- **THEN** se envía `PUT` con `version: null` y el resto de los campos en `null`, y el formulario toma la `version` de la respuesta

#### Scenario: Conflicto de versión
- **GIVEN** la ficha se leyó con `version: 3`
- **WHEN** se guarda y la API responde `409` con `codigo: "FICHA_DESACTUALIZADA"`
- **THEN** se muestra el aviso, el formulario conserva lo escrito y un nuevo guardado vuelve a enviar `version: 3`

#### Scenario: Cargar la versión actual
- **GIVEN** el aviso de conflicto
- **WHEN** se pulsa "Cargar la versión actual" y se confirma
- **THEN** se pide `GET /ficha` y el formulario muestra los datos y la `version` nuevos

### Requirement: Notas clínicas inmutables en la UI
La UI SHALL listar las notas paginadas, de la más reciente a la más antigua, con "Ver más". Mostrará fecha, autor ("Profesional #id") y texto literal. Permitirá agregar una nota (obligatoria, máximo 10000 caracteres). MUST NOT ofrecer editar ni borrar notas. Ante `422 PROFESIONAL_NO_VINCULADO`, MUST mostrar un mensaje fijo y conservar lo escrito.

#### Scenario: Nota nueva
- **WHEN** se agrega una nota
- **THEN** se envía `POST /notas` con `{texto}` sin `turnoId` y la nota aparece primera

#### Scenario: Profesional no vinculado
- **WHEN** la API responde `422` con `codigo: "PROFESIONAL_NO_VINCULADO"`
- **THEN** se muestra el mensaje fijo y el texto escrito sigue en el formulario

#### Scenario: Sin edición
- **WHEN** se muestra la lista de notas
- **THEN** ninguna nota tiene botones de editar ni de borrar

### Requirement: Paciente dado de baja en solo lectura
Si el paciente está inactivo, la UI SHALL mostrar la ficha, los consentimientos y las notas en solo lectura, con un aviso. MUST NOT crear el formulario de anamnesis, el de nota ni el registro de consentimiento. Un `409 PACIENTE_INACTIVO` en una escritura MUST pasar la página a ese modo.

#### Scenario: Paciente inactivo con consentimiento
- **GIVEN** un paciente inactivo con consentimiento
- **WHEN** se abre la ficha
- **THEN** se ven la anamnesis y las notas como texto, sin formularios

#### Scenario: Baja concurrente
- **WHEN** guardar la ficha responde `409 PACIENTE_INACTIVO`
- **THEN** la página pasa a solo lectura con el aviso

### Requirement: Ficha restringida por rol en la UI
La ficha SHALL estar disponible solo para `ADMIN` y `PROFESIONAL`. Para `RECEPCION` (o sin perfil), `#/pacientes/:id/ficha` MUST mostrar un aviso fijo de falta de permiso y MUST NOT enviar ninguna request: ni paciente, ni consentimientos, ni ficha, ni notas. Un `403` del backend MUST mostrarse con un mensaje fijo.

#### Scenario: Recepción entra directo
- **GIVEN** el rol `RECEPCION`
- **WHEN** se navega a `#/pacientes/5/ficha`
- **THEN** se ve el aviso de falta de permiso y no se llamó a ninguna API

#### Scenario: Profesional entra
- **GIVEN** el rol `PROFESIONAL`
- **WHEN** se navega a `#/pacientes/5/ficha`
- **THEN** se piden el paciente y sus consentimientos

### Requirement: Datos de salud seguros en el navegador
Todo dato clínico (texto de consentimiento, campos de la anamnesis, notas) MUST mostrarse como texto literal. MUST NOT escribirse en `localStorage`, `sessionStorage`, la consola, la URL, `document.title` ni avisos `flash`. Los mensajes de error MUST ser fijos, sin `title`, `detail` ni el `codigo` crudo. Al salir de la página, sus datos MUST liberarse y MUST ignorarse las respuestas tardías.

#### Scenario: Contenido clínico malicioso
- **GIVEN** alergias, una nota y el texto de consentimiento contienen `<img src=x onerror=alert(1)>` y `<script>`
- **WHEN** se muestran
- **THEN** se ve el texto literal y la página no contiene elementos `img` ni `script`

#### Scenario: Sin persistencia
- **WHEN** se carga y guarda la ficha
- **THEN** `localStorage` queda vacío, `sessionStorage` solo contiene la sesión de C-10, `console` no fue llamada y el título es "Ficha clínica · …"

#### Scenario: Respuesta tardía
- **GIVEN** la ficha pendiente de carga
- **WHEN** se sale de la página y luego llega la respuesta
- **THEN** no se renderiza nada en el contenedor anterior
