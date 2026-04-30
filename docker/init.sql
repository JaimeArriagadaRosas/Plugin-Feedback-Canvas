-- PostgreSQL initialization script for Feedback Plugin
-- This creates additional database objects beyond Sequelize sync

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for performance (RNF18 - Scalability)
-- Indexes are also defined in models, but we add some custom ones here

-- Composite index for feedback queries by course + status
CREATE INDEX IF NOT EXISTS idx_feedback_course_status 
ON feedbacks (course_id, status) 
WHERE status = 'pending';

-- Index for grade range queries
CREATE INDEX IF NOT EXISTS idx_feedback_grade_range 
ON feedbacks (grade_range, created_at DESC);

-- Partial index for recent unsent feedback
CREATE INDEX IF NOT EXISTS idx_feedback_pending_recent 
ON feedbacks (created_at DESC) 
WHERE status = 'pending';

-- Full-text search on template content (for future search feature)
CREATE MATERIALIZED VIEW IF NOT EXISTS template_search_index AS
SELECT 
  t.id,
  t.name,
  t.content,
  to_tsvector('spanish', t.content || ' ' || t.name) as document
FROM templates t
WHERE t.is_active = true;

CREATE INDEX IF NOT EXISTS idx_template_search 
ON template_search_index USING GIN (document);

-- Function to refresh template search
CREATE OR REPLACE FUNCTION refresh_template_search()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY template_search_index;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Audit log partition (by month) for performance
-- Note: In production with high volume, consider partitioning audit_logs by date

-- Function to clean old logs (> 2 years)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL '2 years';
  
  DELETE FROM notification_logs 
  WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Grant minimal permissions to plugin user
-- (Assuming separate read-only role future implementation)

-- Insert initial data if tables empty
INSERT INTO personalization_variables (course_id, variable_name, label, description, is_enabled, weight, display_order)
SELECT 
  1, -- default course
  'previous_grades_same_course',
  'Calificaciones previas en el curso',
  'Historial de calificaciones del estudiante en asignaturas anteriores del mismo curso',
  true, 60, 1
WHERE NOT EXISTS (SELECT 1 FROM personalization_variables LIMIT 1);

INSERT INTO personalization_variables (course_id, variable_name, label, description, is_enabled, weight, display_order)
SELECT 
  1,
  'performance_other_courses',
  'Desempeño en otras asignaturas',
  'Rendimiento promedio del estudiante en otros cursos del mismo semestre',
  false, 20, 2
WHERE NOT EXISTS (SELECT 1 FROM personalization_variables WHERE variable_name = 'performance_other_courses' LIMIT 1);

-- View for quick stats
CREATE OR REPLACE VIEW feedback_stats_daily AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_feedbacks,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'approved') as approved,
  AVG(grade) as avg_grade
FROM feedbacks
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Notification: alert when pending feedback > threshold
CREATE OR REPLACE FUNCTION check_pending_feedback()
RETURNS TRIGGER AS $$
DECLARE
  pending_count INT;
BEGIN
  SELECT COUNT(*) INTO pending_count 
  FROM feedbacks 
  WHERE status = 'pending' 
    AND created_at > NOW() - INTERVAL '24 hours';
  
  IF pending_count > 50 THEN
    -- Could send email alert to admins
    RAISE NOTICE 'High pending feedback count: %', pending_count;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for high pending count
-- CREATE TRIGGER check_pending_trigger
-- AFTER INSERT ON feedbacks
-- FOR EACH STATEMENT
-- EXECUTE FUNCTION check_pending_feedback();

COMMIT;

-- Database ready!
-- Run with: psql -U feedback_user -d feedback_plugin -f init.sql
