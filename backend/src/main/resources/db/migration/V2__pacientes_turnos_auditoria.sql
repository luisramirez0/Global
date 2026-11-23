-- V2: pacientes, ficha clinica, consentimiento, turnos, recordatorios y auditoria.
-- Mismas convenciones que V1 (SQL portable H2 MODE=MySQL <-> MySQL 8, FK compuestas por consultorio).
-- Textos largos como TEXT (evita el limite de 65535 bytes por fila de varios VARCHAR grandes).

CREATE TABLE paciente (
    id                BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id    BIGINT       NOT NULL,
    nombre            VARCHAR(100) NOT NULL,
    apellido          VARCHAR(100) NOT NULL,
    dni               VARCHAR(20)  NOT NULL,
    fecha_nacimiento  DATE,
    sexo              VARCHAR(20),
    telefono          VARCHAR(30),
    email             VARCHAR(254),
    direccion         VARCHAR(255),
    obra_social_texto VARCHAR(150),
    activo            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        DATETIME(6)  NOT NULL,
    updated_at        DATETIME(6)  NOT NULL,
    CONSTRAINT pk_paciente PRIMARY KEY (id),
    CONSTRAINT uq_paciente_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT uq_paciente_consultorio_dni UNIQUE (consultorio_id, dni),
    CONSTRAINT fk_paciente_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id)
);

CREATE INDEX ix_paciente_apellido_nombre ON paciente (consultorio_id, apellido, nombre);

CREATE TABLE ficha_clinica (
    id                      BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id          BIGINT      NOT NULL,
    paciente_id             BIGINT      NOT NULL,
    alergias                TEXT,
    medicacion_actual       TEXT,
    antecedentes_medicos    TEXT,
    enfermedades_relevantes TEXT,
    embarazo                BOOLEAN,
    motivo_consulta         TEXT,
    observaciones           TEXT,
    version                 BIGINT      NOT NULL DEFAULT 0,
    created_at              DATETIME(6) NOT NULL,
    updated_at              DATETIME(6) NOT NULL,
    CONSTRAINT pk_ficha_clinica PRIMARY KEY (id),
    CONSTRAINT uq_ficha_clinica_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT uq_ficha_clinica_paciente UNIQUE (paciente_id),
    CONSTRAINT fk_ficha_clinica_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id),
    CONSTRAINT fk_ficha_clinica_paciente FOREIGN KEY (consultorio_id, paciente_id)
        REFERENCES paciente (consultorio_id, id)
);

-- Catalogo global de textos de consentimiento (sin consultorio_id ni updated_at: solo lectura).
CREATE TABLE consentimiento_texto (
    version       VARCHAR(20) NOT NULL,
    contenido     TEXT        NOT NULL,
    vigente_desde DATETIME(6) NOT NULL,
    CONSTRAINT pk_consentimiento_texto PRIMARY KEY (version)
);

INSERT INTO consentimiento_texto (version, contenido, vigente_desde)
VALUES ('v1',
        'CONSENTIMIENTO PARA EL TRATAMIENTO DE DATOS PERSONALES Y DE SALUD. En cumplimiento de la Ley 25.326 de Proteccion de los Datos Personales y la Ley 26.529 de Derechos del Paciente, usted presta su consentimiento libre, expreso e informado para que el consultorio recolecte y trate sus datos personales y de salud con la unica finalidad de brindarle atencion odontologica, gestionar sus turnos y comunicarse con usted por WhatsApp o correo electronico para recordatorios. Sus datos se almacenan con medidas de seguridad, no se ceden a terceros sin su consentimiento salvo obligacion legal, y todo acceso a su historia clinica queda registrado. Usted puede ejercer en cualquier momento los derechos de acceso, rectificacion y supresion, y revocar este consentimiento, solicitandolo al consultorio. Texto provisorio v1: sujeto a revision legal antes de su uso en produccion.',
        '2026-11-23 00:00:00');

CREATE TABLE consentimiento_datos (
    id                         BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id             BIGINT      NOT NULL,
    paciente_id                BIGINT      NOT NULL,
    version_texto              VARCHAR(20) NOT NULL,
    aceptado_en                DATETIME(6) NOT NULL,
    registrado_por_usuario_id  BIGINT      NOT NULL,
    created_at                 DATETIME(6) NOT NULL,
    updated_at                 DATETIME(6) NOT NULL,
    CONSTRAINT pk_consentimiento_datos PRIMARY KEY (id),
    CONSTRAINT uq_consentimiento_datos_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT fk_consentimiento_datos_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id),
    CONSTRAINT fk_consentimiento_datos_paciente FOREIGN KEY (consultorio_id, paciente_id)
        REFERENCES paciente (consultorio_id, id),
    CONSTRAINT fk_consentimiento_datos_texto FOREIGN KEY (version_texto)
        REFERENCES consentimiento_texto (version),
    CONSTRAINT fk_consentimiento_datos_usuario FOREIGN KEY (consultorio_id, registrado_por_usuario_id)
        REFERENCES usuario (consultorio_id, id)
);

CREATE TABLE turno (
    id                 BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id     BIGINT       NOT NULL,
    paciente_id        BIGINT       NOT NULL,
    profesional_id     BIGINT       NOT NULL,
    sillon_id          BIGINT       NOT NULL,
    prestacion_id      BIGINT       NOT NULL,
    inicio             DATETIME(6)  NOT NULL,
    fin                DATETIME(6)  NOT NULL,
    estado             VARCHAR(20)  NOT NULL,
    es_sobreturno      BOOLEAN      NOT NULL DEFAULT FALSE,
    motivo_cancelacion VARCHAR(255),
    notas              TEXT,
    version            BIGINT       NOT NULL DEFAULT 0,
    created_at         DATETIME(6)  NOT NULL,
    updated_at         DATETIME(6)  NOT NULL,
    CONSTRAINT pk_turno PRIMARY KEY (id),
    CONSTRAINT uq_turno_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT fk_turno_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id),
    CONSTRAINT fk_turno_paciente FOREIGN KEY (consultorio_id, paciente_id)
        REFERENCES paciente (consultorio_id, id),
    CONSTRAINT fk_turno_profesional FOREIGN KEY (consultorio_id, profesional_id)
        REFERENCES profesional (consultorio_id, id),
    CONSTRAINT fk_turno_sillon FOREIGN KEY (consultorio_id, sillon_id)
        REFERENCES sillon (consultorio_id, id),
    CONSTRAINT fk_turno_prestacion FOREIGN KEY (consultorio_id, prestacion_id)
        REFERENCES prestacion (consultorio_id, id),
    CONSTRAINT ck_turno_estado CHECK (estado IN ('PROGRAMADO', 'CONFIRMADO', 'CANCELADO', 'ASISTIO', 'AUSENTE')),
    CONSTRAINT ck_turno_rango CHECK (fin > inicio)
);

CREATE INDEX ix_turno_sillon_inicio ON turno (sillon_id, inicio);
CREATE INDEX ix_turno_profesional_inicio ON turno (profesional_id, inicio);
CREATE INDEX ix_turno_consultorio_inicio ON turno (consultorio_id, inicio);
CREATE INDEX ix_turno_paciente ON turno (paciente_id);

CREATE TABLE nota_clinica (
    id             BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id BIGINT      NOT NULL,
    paciente_id    BIGINT      NOT NULL,
    profesional_id BIGINT      NOT NULL,
    turno_id       BIGINT,
    fecha          DATETIME(6) NOT NULL,
    texto          TEXT        NOT NULL,
    created_at     DATETIME(6) NOT NULL,
    updated_at     DATETIME(6) NOT NULL,
    CONSTRAINT pk_nota_clinica PRIMARY KEY (id),
    CONSTRAINT uq_nota_clinica_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT fk_nota_clinica_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id),
    CONSTRAINT fk_nota_clinica_paciente FOREIGN KEY (consultorio_id, paciente_id)
        REFERENCES paciente (consultorio_id, id),
    CONSTRAINT fk_nota_clinica_profesional FOREIGN KEY (consultorio_id, profesional_id)
        REFERENCES profesional (consultorio_id, id),
    CONSTRAINT fk_nota_clinica_turno FOREIGN KEY (consultorio_id, turno_id)
        REFERENCES turno (consultorio_id, id)
);

CREATE TABLE recordatorio (
    id             BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id BIGINT       NOT NULL,
    turno_id       BIGINT       NOT NULL,
    canal          VARCHAR(20)  NOT NULL,
    generado_en    DATETIME(6)  NOT NULL,
    enviado_en     DATETIME(6),
    estado         VARCHAR(20)  NOT NULL,
    detalle_error  VARCHAR(500),
    created_at     DATETIME(6)  NOT NULL,
    updated_at     DATETIME(6)  NOT NULL,
    CONSTRAINT pk_recordatorio PRIMARY KEY (id),
    CONSTRAINT uq_recordatorio_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT fk_recordatorio_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id),
    CONSTRAINT fk_recordatorio_turno FOREIGN KEY (consultorio_id, turno_id)
        REFERENCES turno (consultorio_id, id),
    CONSTRAINT ck_recordatorio_canal CHECK (canal IN ('WHATSAPP_LINK', 'EMAIL')),
    CONSTRAINT ck_recordatorio_estado CHECK (estado IN ('GENERADO', 'ENVIADO', 'ERROR'))
);

-- Insert-only: sin updated_at (design D3). El guard real en MySQL es de permisos (GRANT SELECT, INSERT), C-16.
CREATE TABLE audit_log (
    id             BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id BIGINT       NOT NULL,
    usuario_id     BIGINT,
    accion         VARCHAR(20)  NOT NULL,
    entidad        VARCHAR(100) NOT NULL,
    entidad_id     BIGINT,
    detalle        TEXT,
    ip             VARCHAR(45),
    created_at     DATETIME(6)  NOT NULL,
    CONSTRAINT pk_audit_log PRIMARY KEY (id),
    CONSTRAINT fk_audit_log_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id),
    CONSTRAINT fk_audit_log_usuario FOREIGN KEY (consultorio_id, usuario_id)
        REFERENCES usuario (consultorio_id, id),
    CONSTRAINT ck_audit_log_accion CHECK (accion IN ('READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN'))
);

CREATE INDEX ix_audit_log_consultorio_created ON audit_log (consultorio_id, created_at);
