-- EduClass PostgreSQL schema
-- Run: psql -U postgres -d educlass -f sql/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('admin','teacher','parent','student')),
  is_active     BOOLEAN DEFAULT TRUE,
  reset_token   VARCHAR(255) DEFAULT NULL,
  reset_expires TIMESTAMP DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(512) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(50) NOT NULL,
  section             VARCHAR(10) DEFAULT 'A',
  academic_year       VARCHAR(20) NOT NULL,
  homeroom_teacher_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teachers (
  id             SERIAL PRIMARY KEY,
  user_id        INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  staff_number   VARCHAR(30) UNIQUE,
  specialization VARCHAR(100),
  phone          VARCHAR(20),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id             SERIAL PRIMARY KEY,
  user_id        INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  student_number VARCHAR(30) UNIQUE,
  class_id       INT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  dob            DATE,
  gender         VARCHAR(10) CHECK (gender IN ('male','female','other')),
  enrolled_at    DATE DEFAULT CURRENT_DATE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parents (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone      VARCHAR(20),
  occupation VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parent_student (
  parent_id    INT NOT NULL REFERENCES parents(id)  ON DELETE CASCADE,
  student_id   INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship VARCHAR(50) DEFAULT 'guardian',
  PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  code             VARCHAR(20),
  class_id         INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id       INT REFERENCES users(id) ON DELETE SET NULL,
  periods_per_week SMALLINT DEFAULT 5,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
  id         SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     VARCHAR(10) NOT NULL CHECK (status IN ('present','absent','late','excused')),
  marked_by  INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes      TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, subject_id, date)
);

CREATE TABLE IF NOT EXISTS grades (
  id              SERIAL PRIMARY KEY,
  student_id      INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id      INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  score           NUMERIC(5,2) NOT NULL,
  letter_grade    VARCHAR(3),
  assessment_type VARCHAR(20) NOT NULL CHECK (assessment_type IN ('classwork','homework','midterm','exam','project')),
  term            VARCHAR(20) NOT NULL,
  academic_year   VARCHAR(20) NOT NULL,
  entered_by      INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
  id             SERIAL PRIMARY KEY,
  student_id     INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term           VARCHAR(20) NOT NULL,
  academic_year  VARCHAR(20) NOT NULL,
  total_score    NUMERIC(6,2),
  average_score  NUMERIC(5,2),
  class_position SMALLINT,
  class_size     SMALLINT,
  remarks        TEXT,
  generated_by   INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, term, academic_year)
);

CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  sender_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcements (
  id          SERIAL PRIMARY KEY,
  author_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  target_role VARCHAR(20) DEFAULT 'all' CHECK (target_role IN ('all','admin','teacher','parent','student')),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed admin. Password: Admin@123
INSERT INTO users (name, email, password_hash, role)
VALUES ('System Admin','admin@educlass.school','$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/uUJmZGQ2G','admin')
ON CONFLICT (email) DO NOTHING;
