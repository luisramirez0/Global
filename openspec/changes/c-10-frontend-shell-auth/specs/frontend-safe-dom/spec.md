## ADDED Requirements

### Requirement: Creación segura de nodos
El frontend SHALL proveer en `src/utils/` un helper para crear elementos que inserte todo contenido textual como nodos de texto y registre eventos solo como listeners. El helper MUST rechazar atributos de evento como texto (`on*`), `style` como texto y `href` con esquemas distintos de `#`, `http:`, `https:` y `mailto:`.

#### Scenario: Texto malicioso como hijo
- **WHEN** se crea un párrafo con el hijo `<img src=x onerror=alert(1)>`
- **THEN** su `textContent` es el texto literal y no contiene elementos

#### Scenario: href con javascript:
- **WHEN** se crea un enlace con `href` `javascript:alert(1)`
- **THEN** el helper lanza un error y no se crea el enlace

#### Scenario: Atributo de evento como texto
- **WHEN** se crea un elemento con el atributo `onclick` como texto
- **THEN** el helper lanza un error

### Requirement: APIs que interpretan HTML prohibidas
El linter MUST rechazar en el código de `src/` (excluidos los tests) el uso de `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `DOMParser`, `createContextualFragment`, `eval` y `new Function`.

#### Scenario: innerHTML en código de producción
- **WHEN** un archivo de `src/` que no es test asigna `innerHTML`
- **THEN** `npm run lint` termina con error

#### Scenario: Fixture en un test
- **WHEN** un archivo `*.test.ts` usa `innerHTML` para preparar el documento
- **THEN** `npm run lint` no reporta error por ese uso
