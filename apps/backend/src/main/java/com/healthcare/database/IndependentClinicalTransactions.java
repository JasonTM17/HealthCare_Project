package com.healthcare.database;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.SQLException;
import java.util.function.Consumer;

@Component
public final class IndependentClinicalTransactions implements DisposableBean {

    private final HikariDataSource pool;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;

    public IndependentClinicalTransactions(DataSource source) throws SQLException {
        HikariDataSource main = source.unwrap(HikariDataSource.class);
        HikariDataSource own = new HikariDataSource();
        main.copyStateTo(own);
        own.setPoolName((main.getPoolName() == null ? "healthcare" : main.getPoolName())
                + "-clinical-effects");
        own.setMaximumPoolSize(2);
        own.setMinimumIdle(0);
        own.setConnectionTimeout(5000);
        own.setIdleTimeout(10000);
        own.setReadOnly(false);
        own.setRegisterMbeans(false);
        own.setScheduledExecutor(null);
        own.setThreadFactory(null);
        if (own.getMetricRegistry() != null) {
            own.setMetricRegistry(null);
        }
        if (own.getMetricsTrackerFactory() != null) {
            own.setMetricsTrackerFactory(null);
        }
        own.setHealthCheckRegistry(null);
        this.pool = own;
        this.jdbc = new JdbcTemplate(own);
        this.transactions = new TransactionTemplate(new DataSourceTransactionManager(own));
        this.transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void write(Consumer<JdbcTemplate> action) {
        transactions.executeWithoutResult(status -> action.accept(jdbc));
    }

    @Override
    public void destroy() {
        pool.close();
    }
}
