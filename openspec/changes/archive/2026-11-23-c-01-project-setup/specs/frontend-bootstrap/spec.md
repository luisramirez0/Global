# Spec Delta

## Purpose

Define el arranque mínimo del frontend TypeScript vanilla: montar la aplicación en la página y resolver la URL base de la API que usará el cliente tipado de las fichas siguientes.

## ADDED Requirements

### Requirement: Montaje de la aplicación
Al cargar `index.html`, el frontend SHALL montar la aplicación dentro del contenedor raíz mostrando el nombre del producto como encabezado principal, construyendo los nodos con APIs DOM y sin interpretar texto como HTML.

#### Scenario: Montaje en el contenedor raíz
- **GIVEN** un documento con un elemento contenedor raíz vacío
- **WHEN** se ejecuta el arranque de la aplicación
- **THEN** el contenedor contiene un encabezado de nivel 1 con el nombre del producto

#### Scenario: Texto tratado como texto
- **GIVEN** el título a mostrar contiene `<img src=x onerror=alert(1)>`
- **WHEN** se monta la aplicación con ese título
- **THEN** el encabezado muestra el texto literal y el documento no contiene ningún elemento `img`

#### Scenario: Contenedor raíz ausente
- **WHEN** se ejecuta el arranque y no existe el contenedor raíz
- **THEN** el arranque lanza un error descriptivo en lugar de fallar silenciosamente

### Requirement: Resolución de la URL base de la API
El frontend SHALL obtener la URL base de la API desde la variable de build `VITE_API_BASE_URL`; si no está definida o está vacía MUST usar `http://localhost:8080/api`, y la URL resultante MUST no terminar en `/`.

#### Scenario: Variable definida con barra final
- **GIVEN** `VITE_API_BASE_URL` es `https://api.ejemplo.test/api/`
- **WHEN** se resuelve la URL base
- **THEN** el resultado es `https://api.ejemplo.test/api`

#### Scenario: Variable ausente o vacía
- **GIVEN** `VITE_API_BASE_URL` no está definida o es una cadena vacía
- **WHEN** se resuelve la URL base
- **THEN** el resultado es `http://localhost:8080/api`

### Requirement: Calidad de tipos en el frontend
El código del frontend MUST compilar con TypeScript en modo `strict` y el linter MUST rechazar el uso de `any` explícito.

#### Scenario: any rechazado
- **WHEN** un archivo de `src/` declara un valor con tipo `any`
- **THEN** `npm run lint` termina con error

#### Scenario: Chequeo de tipos
- **WHEN** se ejecuta `npm run typecheck`
- **THEN** `tsc --noEmit` termina sin errores sobre el código del esqueleto
