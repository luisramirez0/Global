package ar.global.odonto.auditoria;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Detalle de una entrada de auditoria: objeto JSON plano, inmutable y restringido (design D4). Solo admite
 * numeros, booleanos, nombres de enum y codigos breves sin espacios ni acentos, de modo que un nombre, DNI o texto
 * clinico no pasa (regla 5). Los codigos deben salir de constantes del codigo, nunca de input del usuario.
 *
 * <p>
 * Un detalle invalido lanza {@link DetalleAuditoriaInvalidoException} (sin el valor en el mensaje) y la
 * operacion auditada falla (fail-closed, D2).
 */
public final class DetalleAuditoria {

	static final int MAX_CLAVES = 10;
	static final int MAX_JSON = 1000;

	private static final Pattern CLAVE = Pattern.compile("^[a-z][A-Za-z0-9]{0,39}$");
	private static final Pattern CODIGO = Pattern.compile("^[A-Za-z0-9_.:-]{1,40}$");
	private static final ObjectMapper MAPPER = new ObjectMapper();
	private static final DetalleAuditoria VACIO = new DetalleAuditoria(Map.of());

	private final Map<String, Object> valores;

	private DetalleAuditoria(Map<String, Object> valores) {
		this.valores = valores;
	}

	/** Sin detalle: la columna queda {@code NULL}. */
	public static DetalleAuditoria vacio() {
		return VACIO;
	}

	/** Atajo para un detalle de una sola clave con un codigo, p. ej. {@code resultado=ok}. */
	public static DetalleAuditoria codigo(String clave, String codigo) {
		return VACIO.conCodigo(clave, codigo);
	}

	public DetalleAuditoria con(String clave, long valor) {
		return agregar(clave, valor);
	}

	public DetalleAuditoria con(String clave, boolean valor) {
		return agregar(clave, valor);
	}

	/** Guarda el nombre del enum. */
	public DetalleAuditoria con(String clave, Enum<?> valor) {
		if (valor == null) {
			throw new DetalleAuditoriaInvalidoException("Valor de detalle nulo");
		}
		return agregar(clave, valor.name());
	}

	public DetalleAuditoria conCodigo(String clave, String codigo) {
		if (codigo == null || !CODIGO.matcher(codigo).matches()) {
			throw new DetalleAuditoriaInvalidoException("Codigo de detalle invalido");
		}
		return agregar(clave, codigo);
	}

	/** JSON del detalle, o {@code null} si esta vacio. */
	public String json() {
		if (valores.isEmpty()) {
			return null;
		}
		try {
			String json = MAPPER.writeValueAsString(valores);
			verificarTamanio(json);
			return json;
		}
		catch (JsonProcessingException e) {
			throw new DetalleAuditoriaInvalidoException("Detalle no serializable");
		}
	}

	static void verificarTamanio(String json) {
		if (json.length() > MAX_JSON) {
			throw new DetalleAuditoriaInvalidoException("Detalle demasiado grande");
		}
	}

	private DetalleAuditoria agregar(String clave, Object valor) {
		if (clave == null || !CLAVE.matcher(clave).matches()) {
			throw new DetalleAuditoriaInvalidoException("Clave de detalle invalida");
		}
		if (valores.containsKey(clave)) {
			throw new DetalleAuditoriaInvalidoException("Clave de detalle repetida");
		}
		if (valores.size() >= MAX_CLAVES) {
			throw new DetalleAuditoriaInvalidoException("Demasiadas claves en el detalle");
		}
		Map<String, Object> copia = new LinkedHashMap<>(valores);
		copia.put(clave, valor);
		return new DetalleAuditoria(java.util.Collections.unmodifiableMap(copia));
	}

	@Override
	public String toString() {
		return "DetalleAuditoria[claves=" + valores.keySet() + "]";
	}
}
