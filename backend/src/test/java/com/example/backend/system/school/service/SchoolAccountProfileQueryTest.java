package com.example.backend.system.school.service;

import com.example.backend.system.school.repository.SchoolClassRepository;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import static org.junit.jupiter.api.Assertions.*;

/** Validate the new JPQL against the mapped entities without connecting to any database. */
class SchoolAccountProfileQueryTest {
    @Test void bothProfileQueriesCompileWithSchoolAndUserParameters() throws Exception {
        var factory = new LocalContainerEntityManagerFactoryBean();
        factory.setPersistenceUnitName("profile-query-validation");
        factory.setPackagesToScan("com.example.backend");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setJpaPropertyMap(Map.of("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect",
                "hibernate.boot.allow_jdbc_metadata_access", "false", "hibernate.hbm2ddl.auto", "none"));
        try {
            factory.afterPropertiesSet();
            var emf = factory.getObject(); assertNotNull(emf);
            try (var em = emf.createEntityManager()) {
                for (String method : new String[] { "profileTeacherClasses", "profileStudentClasses" }) {
                    String jpql = SchoolClassRepository.class.getMethod(method, UUID.class, Integer.class).getAnnotation(Query.class).value();
                    var query = em.createQuery(jpql);
                    assertNotNull(query.getParameter("schoolId")); assertNotNull(query.getParameter("userId"));
                }
                var teacherNames = com.example.backend.system.school.repository.ClassTeacherAssignmentRepository.class
                        .getMethod("activeTeacherNames", java.util.Collection.class).getAnnotation(Query.class).value();
                assertNotNull(em.createQuery(teacherNames).getParameter("classIds"));
            }
        } finally { factory.destroy(); }
    }
}
