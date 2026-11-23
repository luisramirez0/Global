-- V1: cuenta (consultorio, usuario) y configuracion de agenda.
-- SQL portable H2 (MODE=MySQL) <-> MySQL 8: sin ENGINE/CHARSET, ids BIGINT AUTO_INCREMENT,
-- instantes en DATETIME(6) UTC, enums como VARCHAR + CHECK, FK compuestas (consultorio_id, id).

CREATE TABLE consultorio (
    id           BIGINT AUTO_INCREMENT NOT NULL,
    nombre       VARCHAR(150) NOT NULL,
    cuit         VARCHAR(13),
    telefono     VARCHAR(30),
    email        VARCHAR(254),
    direccion    VARCHAR(255),
    zona_horaria VARCHAR(60)  NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   DATETIME(6)  NOT NULL,
    updated_at   DATETIME(6)  NOT NULL,
    CONSTRAINT pk_consultorio PRIMARY KEY (id)
);

CREATE TABLE usuario (
    id             BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id BIGINT       NOT NULL,
    email          VARCHAR(254) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    nombre         VARCHAR(100) NOT NULL,
    rol            VARCHAR(20)  NOT NULL,
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_login   DATETIME(6),
    created_at     DATETIME(6)  NOT NULL,
    updated_at     DATETIME(6)  NOT NULL,
    CONSTRAINT pk_usuario PRIMARY KEY (id),
    CONSTRAINT uq_usuario_email UNIQUE (email),
    CONSTRAINT uq_usuario_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT fk_usuario_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id),
    CONSTRAINT ck_usuario_rol CHECK (rol IN ('ADMIN', 'PROFESIONAL', 'RECEPCION'))
);

CREATE TABLE profesional (
    id             BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id BIGINT       NOT NULL,
    usuario_id     BIGINT,
    nombre         VARCHAR(100) NOT NULL,
    apellido       VARCHAR(100) NOT NULL,
    matricula      VARCHAR(50),
    color_agenda   VARCHAR(7),
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     DATETIME(6)  NOT NULL,
    updated_at     DATETIME(6)  NOT NULL,
    CONSTRAINT pk_profesional PRIMARY KEY (id),
    CONSTRAINT uq_profesional_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT fk_profesional_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id),
    CONSTRAINT fk_profesional_usuario FOREIGN KEY (consultorio_id, usuario_id)
        REFERENCES usuario (consultorio_id, id)
);

CREATE TABLE sillon (
    id             BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id BIGINT       NOT NULL,
    nombre         VARCHAR(100) NOT NULL,
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     DATETIME(6)  NOT NULL,
    updated_at     DATETIME(6)  NOT NULL,
    CONSTRAINT pk_sillon PRIMARY KEY (id),
    CONSTRAINT uq_sillon_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT fk_sillon_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id)
);

CREATE TABLE prestacion (
    id               BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id   BIGINT       NOT NULL,
    nombre           VARCHAR(150) NOT NULL,
    duracion_minutos INT          NOT NULL,
    activo           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       DATETIME(6)  NOT NULL,
    updated_at       DATETIME(6)  NOT NULL,
    CONSTRAINT pk_prestacion PRIMARY KEY (id),
    CONSTRAINT uq_prestacion_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT fk_prestacion_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id),
    CONSTRAINT ck_prestacion_duracion CHECK (duracion_minutos > 0)
);

CREATE TABLE horario_atencion (
    id             BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id BIGINT      NOT NULL,
    profesional_id BIGINT      NOT NULL,
    dia_semana     INT         NOT NULL,
    hora_desde     TIME        NOT NULL,
    hora_hasta     TIME        NOT NULL,
    created_at     DATETIME(6) NOT NULL,
    updated_at     DATETIME(6) NOT NULL,
    CONSTRAINT pk_horario_atencion PRIMARY KEY (id),
    CONSTRAINT uq_horario_atencion_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT fk_horario_atencion_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id),
    CONSTRAINT fk_horario_atencion_profesional FOREIGN KEY (consultorio_id, profesional_id)
        REFERENCES profesional (consultorio_id, id),
    CONSTRAINT ck_horario_atencion_dia CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT ck_horario_atencion_horas CHECK (hora_hasta > hora_desde)
);

CREATE TABLE bloqueo_agenda (
    id             BIGINT AUTO_INCREMENT NOT NULL,
    consultorio_id BIGINT      NOT NULL,
    profesional_id BIGINT,
    sillon_id      BIGINT,
    inicio         DATETIME(6) NOT NULL,
    fin            DATETIME(6) NOT NULL,
    motivo         VARCHAR(255),
    created_at     DATETIME(6) NOT NULL,
    updated_at     DATETIME(6) NOT NULL,
    CONSTRAINT pk_bloqueo_agenda PRIMARY KEY (id),
    CONSTRAINT uq_bloqueo_agenda_consultorio_id UNIQUE (consultorio_id, id),
    CONSTRAINT fk_bloqueo_agenda_consultorio FOREIGN KEY (consultorio_id) REFERENCES consultorio (id),
    CONSTRAINT fk_bloqueo_agenda_profesional FOREIGN KEY (consultorio_id, profesional_id)
        REFERENCES profesional (consultorio_id, id),
    CONSTRAINT fk_bloqueo_agenda_sillon FOREIGN KEY (consultorio_id, sillon_id)
        REFERENCES sillon (consultorio_id, id),
    CONSTRAINT ck_bloqueo_agenda_rango CHECK (fin > inicio)
);
