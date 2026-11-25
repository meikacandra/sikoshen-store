-- Schema Database MySQL (Laragon) untuk Sikoshen Store
-- Database: sikoshen_store

CREATE DATABASE IF NOT EXISTS sikoshen_store
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sikoshen_store;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'Owner',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  size_type ENUM('huruf', 'angka') NOT NULL,
  variants_json JSON NOT NULL,
  sizes_json JSON NOT NULL,
  unavailable_json JSON NOT NULL,
  median INT NOT NULL,
  stock_target INT NOT NULL,
  fast_target INT NOT NULL,
  restock_target INT NOT NULL,
  stacked_slow_target INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sku_profiles (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(32) NOT NULL,
  variant VARCHAR(64) NOT NULL,
  size VARCHAR(16) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  average_stock_target INT NOT NULL DEFAULT 0,
  estimated_total_out INT NOT NULL DEFAULT 0,
  label VARCHAR(16) NULL,
  recognized_by_model TINYINT(1) NOT NULL DEFAULT 1,
  sample_monthly_out INT NULL,
  fast_probability DOUBLE NULL,
  predicted_next_month DOUBLE NULL,
  rmse_sku DOUBLE NULL,
  safety_stock INT NULL,
  suggested_order INT NULL,
  prediction_month CHAR(7) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_sku_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS monthly_movements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sku_id VARCHAR(64) NOT NULL,
  month CHAR(7) NOT NULL,
  opening_stock INT NOT NULL DEFAULT 0,
  incoming INT NOT NULL DEFAULT 0,
  outgoing INT NOT NULL DEFAULT 0,
  closing_stock INT NOT NULL DEFAULT 0,
  transactions_json JSON NULL,
  UNIQUE KEY uq_sku_month (sku_id, month),
  INDEX idx_month (month),
  CONSTRAINT fk_movement_sku FOREIGN KEY (sku_id) REFERENCES sku_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS uploads (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  at DATETIME NOT NULL,
  status ENUM('berhasil', 'ditolak', 'gagal') NOT NULL,
  ready_rows INT NULL,
  sku_count INT NULL,
  discarded_rows INT NULL,
  fixed_rows INT NULL,
  reason TEXT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS classifications (
  id VARCHAR(64) PRIMARY KEY,
  at DATETIME NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  fast INT NOT NULL DEFAULT 0,
  slow INT NOT NULL DEFAULT 0,
  changes_json JSON NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recommendation_reviews (
  id VARCHAR(64) PRIMARY KEY,
  at DATETIME NOT NULL,
  sku_ids_json JSON NOT NULL,
  classification_at DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS model_metadata (
  id INT PRIMARY KEY DEFAULT 1,
  algorithm VARCHAR(100) NOT NULL,
  trees INT NOT NULL,
  max_depth INT NOT NULL,
  train_sku_count INT NOT NULL,
  test_sku_count INT NOT NULL,
  correct_labels INT NOT NULL,
  accuracy_percent DOUBLE NOT NULL,
  fast_recall DOUBLE NOT NULL,
  slow_recall DOUBLE NOT NULL,
  cv_avg_percent DOUBLE NOT NULL,
  cv_std_percent DOUBLE NOT NULL,
  confusion_matrix_json JSON NOT NULL,
  feature_importance_json JSON NOT NULL,
  mae VARCHAR(64) NOT NULL,
  reg_metrics_json JSON NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS system_state (
  id INT PRIMARY KEY DEFAULT 1,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  last_upload DATETIME NOT NULL,
  last_classification DATETIME NOT NULL,
  classification_running TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS process_jobs (
  id VARCHAR(64) PRIMARY KEY,
  kind ENUM('upload_check', 'classification') NOT NULL,
  status ENUM('running', 'success', 'failed', 'cancelled') NOT NULL,
  progress DOUBLE NOT NULL DEFAULT 0,
  current_step INT NOT NULL DEFAULT 0,
  total_steps INT NOT NULL DEFAULT 1,
  error_code VARCHAR(32) NULL,
  reason TEXT NULL,
  payload_json LONGTEXT NULL,
  result_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

