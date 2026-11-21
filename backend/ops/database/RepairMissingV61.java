import com.example.backend.config.DatabaseConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationState;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.support.ResourcePropertySource;

/** One-off recovery for the confirmed missing support-claim migration. Run manually only. */
public class RepairMissingV61 {
    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("Expected backend directory");
        Path backend = Path.of(args[0]).toAbsolutePath().normalize();
        Path migrations = backend.resolve("src/main/resources/db/migration");
        if (!Files.isRegularFile(migrations.resolve("V62__account_administration_audit.sql")))
            throw new IllegalStateException("V62 audit migration is missing; stop.");
        try (var files = Files.list(migrations)) {
            if (files.anyMatch(p -> p.getFileName().toString().startsWith("V61__")))
                throw new IllegalStateException("A local V61 exists. Restore/compare it instead of repairing.");
        }
        var env = new StandardEnvironment();
        // Match Spring's UTF-8 .properties env imports; process environment retains priority.
        for (String name : new String[]{".env.local", ".env"}) {
            Path file = backend.resolve(name);
            if (Files.isRegularFile(file)) env.getPropertySources().addLast(
                new ResourcePropertySource(name, new org.springframework.core.io.support.EncodedResource(
                    new org.springframework.core.io.FileSystemResource(file), java.nio.charset.StandardCharsets.UTF_8)));
        }
        try (var ds = (HikariDataSource) new DatabaseConfig().dataSource(env)) {
            var flyway = Flyway.configure().dataSource(ds).schemas("public")
                .locations("filesystem:" + migrations.toString().replace('\\', '/'))
                .ignoreMigrationPatterns("*:pending").load();
            var candidates = java.util.Arrays.stream(flyway.info().all())
                .filter(m -> m.getVersion() != null && "61".equals(m.getVersion().toString())).toList();
            if (candidates.size() != 1) throw new IllegalStateException("Expected exactly one V61 history entry.");
            var v61 = candidates.get(0);
            if (v61.getState() == MigrationState.DELETED) {
                if (!flyway.validateWithResult().validationSuccessful)
                    throw new IllegalStateException("V61 was already repaired, but other validation errors remain.");
                System.out.println("V61 already repaired. Start the backend normally.");
                return;
            }
            if (v61.getState() != MigrationState.MISSING_SUCCESS
                    || !"V61__support_complaint_claim.sql".equals(v61.getScript())
                    || !Integer.valueOf(-963007125).equals(v61.getChecksum()))
                throw new IllegalStateException("V61 differs from the confirmed screenshot. No repair performed.");
            var validation = flyway.validateWithResult();
            if (validation.validationSuccessful || validation.invalidMigrations.size() != 1)
                throw new IllegalStateException("Expected only the missing V61 error. No repair performed.");
            var error = validation.invalidMigrations.get(0);
            if (!"61".equals(error.version) || !"APPLIED_VERSIONED_MIGRATION_NOT_RESOLVED".equals(
                    error.errorDetails.errorCode.toString()))
                throw new IllegalStateException("Unexpected Flyway validation error. No repair performed.");
            // All other migrations have passed checksum/type/description validation.
            var repaired = flyway.repair();
            if (!repaired.migrationsAligned.isEmpty() || !repaired.migrationsRemoved.isEmpty()
                    || repaired.migrationsDeleted.size() != 1)
                throw new IllegalStateException("Unexpected repair result. Inspect history before starting.");
            if (!flyway.validateWithResult().validationSuccessful)
                throw new IllegalStateException("Validation still fails after repair; inspect history.");
            System.out.println("Missing V61 marked deleted in Flyway history. Existing tables/data retained.");
            System.out.println("Start the backend normally to apply pending V62.");
        }
    }
}
