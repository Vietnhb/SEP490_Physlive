package com.example.backend.system.operations.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.simulation.repository.SimulationRunRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.query.QueryUtils;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ValidationFiltersTest {
    private final SimulationRunRepository runs = mock(SimulationRunRepository.class);
    private final AdminOperationsService service = new AdminOperationsService(null, runs, null, null, null, null, null);

    @Test void filtersAreAppliedBeforePaginationAndEndDateIncludesTheEntireVietnameseDay() {
        when(runs.readValidationPage(anyString(), anyString(), any(), any(), any())).thenAnswer(call -> Page.empty(call.getArgument(4, Pageable.class)));
        service.validationPage(2, 25, " KINEMATICS ", "fail", LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 19));
        verify(runs).readValidationPage(eq("KINEMATICS"), eq("FAIL"), eq(Instant.parse("2026-10-31T17:00:00Z")),
                eq(Instant.parse("2026-11-19T17:00:00Z")), argThat(page -> page.getPageNumber() == 2 && page.getPageSize() == 25));
    }

    @Test void defaultRequestKeepsAllTopicsAndStatuses() {
        when(runs.readValidationPage(anyString(), anyString(), any(), any(), any())).thenReturn(Page.empty());
        service.validationPage(0, 10);
        verify(runs).readValidationPage(eq(""), eq("ALL"), any(), any(), any());
    }

    @Test void rejectsInvalidDateRangeAndStatusWithoutReadingRuns() {
        assertThrows(ApiException.class, () -> service.validationPage(0, 10, null, "UNKNOWN", null, null));
        assertThrows(ApiException.class, () -> service.validationPage(0, 10, null, "ALL", LocalDate.of(2026, 11, 20), LocalDate.of(2026, 11, 19)));
        verifyNoInteractions(runs);
    }

    @Test void projectionCountAndTopicQueriesCompileAgainstTheEntityMappings() throws Exception {
        var factory = new LocalContainerEntityManagerFactoryBean();
        factory.setPersistenceUnitName("validation-filter-query");
        factory.setPackagesToScan("com.example.backend");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect", "hibernate.boot.allow_jdbc_metadata_access", "false", "hibernate.hbm2ddl.auto", "none"));
        try {
            factory.afterPropertiesSet();
            var emf = factory.getObject(); assertNotNull(emf);
            try (var em = emf.createEntityManager()) {
                String jpql = SimulationRunRepository.class.getMethod("readValidationPage", String.class, String.class, Instant.class, Instant.class, Pageable.class).getAnnotation(Query.class).value();
                var query = em.createQuery(jpql);
                for (String name : new String[] { "topic", "status", "from", "until" }) assertNotNull(query.getParameter(name));
                assertNotNull(em.createQuery(QueryUtils.createCountQueryFor(jpql)));
                assertNotNull(em.createQuery(SimulationRunRepository.class.getMethod("validationTopics").getAnnotation(Query.class).value()));
            }
        } finally { factory.destroy(); }
    }
}
