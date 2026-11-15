-- =============================================================================
-- Migration: 20261108_performance_indexes.sql
-- Purpose:   Performance indexes for high-frequency queries across Trainee,
--            Instructor, Admin, and Super Admin portals.
-- =============================================================================

-- Enrollments
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_enrollments_trainee_id ON enrollments(trainee_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_enrollments_trainee_status ON enrollments(trainee_id, status);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- Attendance
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_attendance_trainee_course ON attendance(trainee_id, course_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_attendance_batch_session_date ON attendance(batch_id, session_date);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_attendance_schedule_id ON attendance(schedule_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- Schedules
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_schedules_course_id ON schedules(course_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_schedules_batch_id ON schedules(batch_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_schedules_instructor_id ON schedules(instructor_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_schedules_status_start_end ON schedules(status, start_at, end_at);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- Assessment Attempts & Assessments
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_assessment_attempts_trainee_id ON assessment_attempts(trainee_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment_id ON assessment_attempts(assessment_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_assessments_course_id ON assessments(course_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- Course Modules, Learning Materials, Lesson Completions & Course Instructors
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_course_modules_course_id ON course_modules(course_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_learning_materials_module_id ON learning_materials(module_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_trainee_lesson_completions_trainee_course ON trainee_lesson_completions(trainee_id, course_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_course_instructors_instructor_course ON course_instructors(instructor_id, course_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- Audit Logs
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at ON audit_logs(action, created_at DESC);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- Notifications
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created_at ON notifications(recipient_id, created_at DESC);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;
