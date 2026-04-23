-- Таблица лицевых счётов должников (импорт из биллинга ЖКХ)
-- Формат источника: Населенный пункт;Адрес ЛС;Отв. квартиросъемщик;Номер ЛС;Сальдо на конец периода Дебет

CREATE TABLE IF NOT EXISTS `krasinform_accounts` (
  `uid`            INT AUTO_INCREMENT PRIMARY KEY,

  -- Данные из файла импорта
  `locality`       VARCHAR(255)   NOT NULL DEFAULT '' COMMENT 'Населенный пункт',
  `address`        VARCHAR(512)   NOT NULL DEFAULT '' COMMENT 'Адрес ЛС',
  `tenant_name`    VARCHAR(512)   NOT NULL DEFAULT '' COMMENT 'Отв. квартиросъемщик',
  `account_number` VARCHAR(64)    NOT NULL          COMMENT 'Номер ЛС',
  `balance_debit`  DECIMAL(12,2)  NOT NULL DEFAULT 0.00 COMMENT 'Сальдо на конец периода Дебет',

  -- Служебные поля
  `import_batch`   VARCHAR(128)   DEFAULT NULL COMMENT 'Идентификатор пакета импорта (имя файла или дата)',
  `created_at`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE  KEY `uq_account_number`   (`account_number`),
  INDEX   `idx_locality`            (`locality`),
  INDEX   `idx_tenant_name`         (`tenant_name`(64)),
  INDEX   `idx_import_batch`        (`import_batch`),
  FULLTEXT KEY `ft_address`          (`address`),
  FULLTEXT KEY `ft_locality_address` (`locality`, `address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Лицевые счета должников, импортированные из биллинговой системы';
