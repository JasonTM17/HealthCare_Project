package com.healthcare.config;

import java.time.LocalTime;
import org.hibernate.boot.model.TypeContributions;
import org.hibernate.boot.model.TypeContributor;
import org.hibernate.service.ServiceRegistry;
import org.hibernate.type.descriptor.java.LocalTimeJavaType;
import org.hibernate.type.descriptor.jdbc.JdbcType;
import org.hibernate.type.descriptor.jdbc.JdbcTypeIndicators;
import org.hibernate.type.descriptor.jdbc.LocalTimeJdbcType;
import org.hibernate.type.internal.BasicTypeImpl;

/** Keeps SQL TIME wall-clock values consistent in attributes and query parameters. */
public final class LocalTimeTypeContributor implements TypeContributor {
    @Override
    public void contribute(TypeContributions contributions, ServiceRegistry serviceRegistry) {
        LocalTimeJavaType javaType = new LocalTimeJavaType() {
            @Override
            public JdbcType getRecommendedJdbcType(JdbcTypeIndicators indicators) {
                return LocalTimeJdbcType.INSTANCE;
            }
        };
        // An attribute annotation alone leaves JPQL parameters registered as
        // java.sql.Time, shifting comparisons when the JVM and JDBC zones differ.
        contributions.contributeJavaType(javaType);
        contributions.contributeType(
            new BasicTypeImpl<>(javaType, LocalTimeJdbcType.INSTANCE),
            "LocalTime", LocalTime.class.getName());
    }
}
