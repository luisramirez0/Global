## MODIFIED Requirements

### Requirement: Montaje de la aplicación
Al cargar `index.html`, el frontend SHALL montar dentro del contenedor raíz el layout de la aplicación, con el nombre del producto como texto del encabezado, restaurar la sesión y arrancar el router renderizando la ruta inicial, construyendo los nodos con APIs DOM y sin interpretar texto como HTML.

#### Scenario: Montaje en el contenedor raíz
- **GIVEN** un documento con un elemento contenedor raíz vacío y sin sesión guardada
- **WHEN** se ejecuta el arranque de la aplicación
- **THEN** el contenedor contiene el encabezado con el nombre del producto y la página de login en la región principal

#### Scenario: Texto tratado como texto
- **GIVEN** el nombre del producto a mostrar contiene `<img src=x onerror=alert(1)>`
- **WHEN** se monta la aplicación con ese nombre
- **THEN** el encabezado muestra el texto literal y el documento no contiene ningún elemento `img`

#### Scenario: Contenedor raíz ausente
- **WHEN** se ejecuta el arranque y no existe el contenedor raíz
- **THEN** el arranque lanza un error descriptivo en lugar de fallar silenciosamente
