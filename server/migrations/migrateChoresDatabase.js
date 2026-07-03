// Creates the chore scheduling tables. Hearthboard installs start on the
// schedule-based chore model, so there is no legacy single-table conversion.
async function migrateChoresDatabase(db) {
    try {
        const migrationVersionRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('chores_migration_version');
        const currentVersion = migrationVersionRow ? parseInt(migrationVersionRow.value, 10) : 0;

        if (currentVersion >= 1) {
            return;
        }

        db.exec(`
      CREATE TABLE IF NOT EXISTS chore_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chore_id INTEGER NOT NULL,
        user_id INTEGER NULL,
        crontab TEXT NULL,
        visible INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_chore_schedules_chore_id ON chore_schedules(chore_id);
      CREATE INDEX IF NOT EXISTS idx_chore_schedules_user_id ON chore_schedules(user_id);
      CREATE INDEX IF NOT EXISTS idx_chore_schedules_visible ON chore_schedules(visible);

      CREATE TABLE IF NOT EXISTS chore_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        chore_schedule_id INTEGER NULL,
        date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chore_schedule_id) REFERENCES chore_schedules(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chore_history_user_id ON chore_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_chore_history_date ON chore_history(date);
      CREATE INDEX IF NOT EXISTS idx_chore_history_user_date ON chore_history(user_id, date);
    `);

        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('chores_migration_version', '1');
    } catch (error) {
        console.error('=== Chore table setup failed ===');
        console.error('Error:', error);
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('migration_error', error.message);
        throw error;
    }
}

module.exports = migrateChoresDatabase;
