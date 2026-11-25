/**
 * Grilla de la agenda (design D5, D6 y D12 de C-13): una columna por sillón o por día, filas según la franja,
 * bloques de turnos como botones, bloqueos sombreados y navegación por teclado con *roving tabindex* (una sola
 * parada de Tab; las flechas recorren los turnos con `siguienteTurno`). Las celdas vacías no son enfocables:
 * el clic en un hueco es solo conveniencia de puntero.
 */
import type { ColumnaAgenda } from '../../pages/agenda/dominio/columnas';
import { minutosAHora } from '../../pages/agenda/dominio/formato';
import { asignarCarriles, calcularPosicion, type TramoDia } from '../../pages/agenda/dominio/posicion';
import { siguienteTurno, type EntradaTeclado, type TeclaNavegacion } from '../../pages/agenda/dominio/teclado';
import { h } from '../../utils/dom';
import { crearBloqueTurno } from './bloqueTurno';

export interface DatosGrilla {
  /** Nombre accesible del grupo ("Agenda del 24/11"). */
  etiqueta: string;
  columnas: readonly ColumnaAgenda[];
  franja: TramoDia;
  minutosGrilla: number;
  /** Vista semanal: cada bloque muestra el nombre de su sillón. */
  mostrarSillon: boolean;
  nombreSillon(id: number): string;
}

export interface Hueco {
  fecha: string;
  hora: string;
  sillonId: number | null;
}

export interface OpcionesGrilla {
  alAbrirAcciones(turnoId: number, opener: HTMLElement): void;
  alElegirHueco(hueco: Hueco): void;
  /** El usuario enfocó un turno (alimenta la precarga del alta). */
  alEnfocarTurno(turnoId: number): void;
}

export interface Grilla {
  /** `role="group"` con `tabindex="-1"`: destino de foco con la vista vacía. */
  readonly element: HTMLElement;
  /** `activoId` es el destino que indicó `focoTrasCambio`; recibe el `tabindex="0"`. */
  renderizar(datos: DatosGrilla, opciones?: { activoId?: number | null }): void;
  /** Enfoca el bloque del turno; `false` si no está renderizado. */
  enfocar(turnoId: number): boolean;
  /** Turno con la parada de Tab, o `null` sin turnos. */
  turnoActivoId(): number | null;
}

interface BloqueRenderizado {
  turnoId: number;
  columna: number;
  inicioMin: number;
  carril: number;
  orden: string;
  el: HTMLButtonElement;
}

const TECLAS: ReadonlySet<string> = new Set<TeclaNavegacion>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);
const MSG_INSTRUCCION = 'Usá las flechas para moverte entre turnos y Enter para ver sus acciones.';
let secuencia = 0;

function esTecla(key: string): key is TeclaNavegacion {
  return TECLAS.has(key);
}

export function crearGrilla(opciones: OpcionesGrilla): Grilla {
  secuencia += 1;
  const idInstruccion = `grilla-instruccion-${secuencia}`;
  const instruccion = h('p', { id: idInstruccion, className: 'grilla-instruccion' }, MSG_INSTRUCCION);
  const tabla = h('div', { className: 'grilla-tabla' });
  const element = h(
    'div',
    { className: 'grilla', attrs: { role: 'group', 'aria-label': '', 'aria-describedby': idInstruccion, tabindex: '-1' } },
    instruccion,
    tabla,
  );

  let bloques: BloqueRenderizado[] = [];
  let activo: number | null = null; // índice en `bloques`

  function marcarActivo(indice: number | null): void {
    activo = indice;
    bloques.forEach((b, i) => b.el.setAttribute('tabindex', i === indice ? '0' : '-1'));
  }

  function indiceDe(el: EventTarget | null): number {
    if (!(el instanceof Element)) return -1;
    const bloque = el.closest('[data-turno-id]');
    return bloques.findIndex((b) => b.el === bloque);
  }

  element.addEventListener('focusin', (event) => {
    const indice = indiceDe(event.target);
    if (indice < 0) return;
    marcarActivo(indice);
    const bloque = bloques[indice];
    if (bloque !== undefined) opciones.alEnfocarTurno(bloque.turnoId);
  });

  element.addEventListener('keydown', (event) => {
    if (!esTecla(event.key)) return;
    const actual = indiceDe(event.target);
    if (actual < 0) return;
    event.preventDefault();
    const mapa: EntradaTeclado[] = bloques.map((b, i) => ({ id: i, columna: b.columna, inicioMin: b.inicioMin, carril: b.carril }));
    const destino = siguienteTurno(mapa, actual, event.key);
    if (destino !== null && destino !== actual) bloques[destino]?.el.focus();
  });

  function celdasDeColumna(columna: ColumnaAgenda, datos: DatosGrilla, filas: number): HTMLElement[] {
    const celdas: HTMLElement[] = [];
    for (let i = 0; i < filas; i += 1) {
      const minutos = datos.franja.inicioMin + i * datos.minutosGrilla;
      const hora = minutosAHora(minutos);
      const celda = h('div', {
        className: 'celda',
        attrs: { 'data-hora': hora, 'data-fecha': columna.fecha, 'data-sillon-id': columna.sillonId === null ? '' : String(columna.sillonId) },
        on: { click: () => opciones.alElegirHueco({ fecha: columna.fecha, hora, sillonId: columna.sillonId }) },
      });
      celda.style.gridRow = `${i + 1} / span 1`;
      celda.style.gridColumn = '1 / -1';
      celdas.push(celda);
    }
    return celdas;
  }

  function renderizar(datos: DatosGrilla, opcionesRender: { activoId?: number | null } = {}): void {
    const anterior = activo === null ? null : (bloques[activo]?.turnoId ?? null);
    element.setAttribute('aria-label', datos.etiqueta);
    const filas = Math.max(1, Math.ceil((datos.franja.finMin - datos.franja.inicioMin) / datos.minutosGrilla));
    const nuevos: BloqueRenderizado[] = [];

    const eje = h('div', { className: 'grilla-eje', attrs: { 'aria-hidden': 'true' } }, h('div', { className: 'grilla-eje-titulo' }, ''));
    const ejeCuerpo = h('div', { className: 'grilla-cuerpo' });
    ejeCuerpo.style.gridTemplateRows = `repeat(${filas}, var(--alto-fila, 1.5rem))`;
    for (let i = 0; i < filas; i += 1) {
      const minutos = datos.franja.inicioMin + i * datos.minutosGrilla;
      if (minutos % 60 !== 0) continue;
      const etiqueta = h('span', { className: 'grilla-hora' }, minutosAHora(minutos));
      etiqueta.style.gridRow = `${i + 1} / span 1`;
      ejeCuerpo.append(etiqueta);
    }
    eje.append(ejeCuerpo);

    const columnasEl = datos.columnas.map((columna, indiceColumna) => {
      const carriles = asignarCarriles(columna.turnos.map((t) => t.segmento));
      const ancho = Math.max(1, ...carriles.map((c) => c.carriles));
      const cuerpo = h('div', { className: 'grilla-cuerpo' });
      cuerpo.style.gridTemplateRows = `repeat(${filas}, var(--alto-fila, 1.5rem))`;
      cuerpo.style.gridTemplateColumns = `repeat(${ancho}, minmax(0, 1fr))`;
      cuerpo.append(...celdasDeColumna(columna, datos, filas));

      for (const tramo of columna.bloqueos) {
        const inicioMin = Math.max(tramo.inicioMin, datos.franja.inicioMin);
        const finMin = Math.min(tramo.finMin, datos.franja.finMin);
        if (finMin <= inicioMin) continue;
        const pos = calcularPosicion({ inicioMin, finMin }, { franjaInicioMin: datos.franja.inicioMin, minutosGrilla: datos.minutosGrilla });
        const sombra = h('div', { className: 'bloqueo' }, h('span', {}, 'Bloqueado'));
        sombra.style.gridRow = `${pos.fila} / span ${pos.filas}`;
        sombra.style.gridColumn = '1 / -1';
        cuerpo.append(sombra);
      }

      columna.turnos.forEach(({ turno, segmento }, i) => {
        const carril = carriles[i] ?? { carril: 0, carriles: 1 };
        const posicion = calcularPosicion(segmento, { franjaInicioMin: datos.franja.inicioMin, minutosGrilla: datos.minutosGrilla });
        const el = crearBloqueTurno({
          turno,
          segmento,
          posicion,
          carril,
          ...(datos.mostrarSillon ? { nombreSillon: datos.nombreSillon(turno.sillonId) } : {}),
        });
        el.setAttribute('tabindex', '-1');
        el.addEventListener('click', () => opciones.alAbrirAcciones(turno.id, el));
        cuerpo.append(el);
        nuevos.push({
          turnoId: turno.id,
          columna: indiceColumna,
          inicioMin: segmento.inicioMin,
          carril: carril.carril,
          orden: `${columna.fecha} ${String(segmento.inicioMin).padStart(4, '0')} ${String(indiceColumna).padStart(3, '0')}`,
          el,
        });
      });

      return h(
        'div',
        { className: 'grilla-columna', attrs: { 'data-clave': columna.clave } },
        h('h3', { className: 'grilla-titulo' }, columna.titulo),
        cuerpo,
      );
    });

    tabla.style.gridTemplateColumns = `auto repeat(${Math.max(1, datos.columnas.length)}, minmax(9rem, 1fr))`;
    tabla.replaceChildren(eje, ...columnasEl);
    bloques = nuevos;

    const primero = bloques.reduce<number | null>((mejor, b, i) => (mejor === null || b.orden < (bloques[mejor]?.orden ?? '') ? i : mejor), null);
    const preferido = opcionesRender.activoId ?? anterior;
    const conservado = preferido === null ? -1 : bloques.findIndex((b) => b.turnoId === preferido);
    marcarActivo(conservado >= 0 ? conservado : primero);
  }

  return {
    element,
    renderizar,
    enfocar(turnoId) {
      const bloque = bloques.find((b) => b.turnoId === turnoId);
      if (bloque === undefined) return false;
      bloque.el.focus();
      return true;
    },
    turnoActivoId: () => (activo === null ? null : (bloques[activo]?.turnoId ?? null)),
  };
}
