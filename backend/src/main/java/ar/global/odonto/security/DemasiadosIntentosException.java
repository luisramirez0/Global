package ar.global.odonto.security;

/** Login bloqueado por el rate limiter (429); lleva los segundos para {@code Retry-After} (design D7). */
public class DemasiadosIntentosException extends RuntimeException {

	private final long retryAfterSeconds;

	public DemasiadosIntentosException(long retryAfterSeconds) {
		super("Demasiados intentos de inicio de sesión.");
		this.retryAfterSeconds = retryAfterSeconds;
	}

	public long getRetryAfterSeconds() {
		return retryAfterSeconds;
	}
}
