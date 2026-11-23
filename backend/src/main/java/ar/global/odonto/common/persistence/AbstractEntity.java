package ar.global.odonto.common.persistence;

import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import java.util.Objects;
import org.hibernate.Hibernate;

/**
 * Base de entidades: id {@code BIGINT} autoincremental, igualdad por id (segura con proxies) y
 * {@code toString} que muestra solo clase e id (regla 5: sin PII en logs; no sobreescribir en subclases).
 */
@MappedSuperclass
public abstract class AbstractEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	public Long getId() {
		return id;
	}

	@Override
	public boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		if (other == null || Hibernate.getClass(this) != Hibernate.getClass(other)) {
			return false;
		}
		Long otherId = ((AbstractEntity) other).getId();
		return id != null && Objects.equals(id, otherId);
	}

	@Override
	public int hashCode() {
		return Hibernate.getClass(this).hashCode();
	}

	@Override
	public String toString() {
		return Hibernate.getClass(this).getSimpleName() + "#" + id;
	}
}
