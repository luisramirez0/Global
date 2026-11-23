package ar.global.odonto.security;

import ar.global.odonto.usuario.Usuario;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * ZONA DE RIESGO (regla 12). Limite de logins fallidos en memoria por IP+email con ventana deslizante (design
 * D7): {@value #MAX_FALLOS} fallos en 15 minutos bloquean esa combinacion. Una sola instancia; se resetea al
 * reiniciar. Las claves contienen el email: nunca se loguean (regla 5).
 */
@Component
public class LoginRateLimiter {

	static final int MAX_FALLOS = 5;
	static final Duration VENTANA = Duration.ofMinutes(15);

	private final Map<String, Deque<Instant>> fallos = new ConcurrentHashMap<>();
	private final Clock clock;

	public LoginRateLimiter(Clock clock) {
		this.clock = clock;
	}

	public static String clave(String ip, String email) {
		return ip + "|" + Usuario.normalizeEmail(email);
	}

	/** Lanza {@link DemasiadosIntentosException} si la clave alcanzo el maximo dentro de la ventana. */
	public void verificar(String clave) {
		Deque<Instant> intentos = fallos.get(clave);
		if (intentos == null) {
			return;
		}
		Instant now = clock.instant();
		synchronized (intentos) {
			descartarVencidos(intentos, now);
			if (intentos.size() >= MAX_FALLOS) {
				Duration espera = Duration.between(now, intentos.peekFirst().plus(VENTANA));
				throw new DemasiadosIntentosException(Math.max(1, ceilSeconds(espera)));
			}
		}
	}

	public void registrarFallo(String clave) {
		Instant now = clock.instant();
		purgar(now);
		Deque<Instant> intentos = fallos.computeIfAbsent(clave, k -> new ArrayDeque<>());
		synchronized (intentos) {
			descartarVencidos(intentos, now);
			intentos.addLast(now);
		}
	}

	public void reset(String clave) {
		fallos.remove(clave);
	}

	int clavesActivas() {
		return fallos.size();
	}

	private void purgar(Instant now) {
		fallos.entrySet().removeIf(e -> {
			synchronized (e.getValue()) {
				descartarVencidos(e.getValue(), now);
				return e.getValue().isEmpty();
			}
		});
	}

	private static void descartarVencidos(Deque<Instant> intentos, Instant now) {
		Instant limite = now.minus(VENTANA);
		while (!intentos.isEmpty() && !intentos.peekFirst().isAfter(limite)) {
			intentos.pollFirst();
		}
	}

	private static long ceilSeconds(Duration d) {
		long s = d.getSeconds();
		return d.getNano() > 0 ? s + 1 : s;
	}
}
