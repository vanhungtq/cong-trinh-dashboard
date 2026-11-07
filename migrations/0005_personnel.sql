CREATE TABLE personnel_snapshots (
  day TEXT NOT NULL,
  task_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  assignee_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(day,task_id)
);
CREATE INDEX personnel_snapshots_day ON personnel_snapshots(day);
CREATE TABLE personnel_days (
  day TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL
);
CREATE TABLE personnel_logs (
  day TEXT NOT NULL,
  task_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  project_id TEXT NOT NULL,
  hours REAL NOT NULL CHECK(hours >= 0 AND hours <= 24),
  data TEXT NOT NULL,
  PRIMARY KEY(day,task_id,member_id)
);
CREATE INDEX personnel_logs_day ON personnel_logs(day);
CREATE TRIGGER personnel_hours_insert BEFORE INSERT ON personnel_logs
WHEN NEW.hours + COALESCE((SELECT SUM(hours) FROM personnel_logs WHERE day=NEW.day AND member_id=NEW.member_id AND task_id<>NEW.task_id),0) > 24
BEGIN SELECT RAISE(ABORT, 'daily hours exceeds 24'); END;
CREATE TRIGGER personnel_hours_update BEFORE UPDATE ON personnel_logs
WHEN NEW.hours + COALESCE((SELECT SUM(hours) FROM personnel_logs WHERE day=NEW.day AND member_id=NEW.member_id AND task_id<>NEW.task_id),0) > 24
BEGIN SELECT RAISE(ABORT, 'daily hours exceeds 24'); END;
