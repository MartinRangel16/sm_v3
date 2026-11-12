-- Semilla Dorada: catálogo central de tiendas para la futura API MySQL.
-- El código se asigna dentro de una transacción después de insertar la tienda.
-- No almacenar la imagen QR: generar el QR desde el campo `code`.

CREATE TABLE stores (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(24) NULL,
    name VARCHAR(120) NOT NULL,
    address VARCHAR(240) NOT NULL,
    responsible_seller_username VARCHAR(80) NOT NULL,
    seller_access ENUM('all', 'selected') NOT NULL DEFAULT 'all',
    credit_authorized TINYINT(1) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    qr_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_stores_code (code),
    KEY idx_stores_responsible (responsible_seller_username),
    KEY idx_stores_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE store_seller_access (
    store_id BIGINT UNSIGNED NOT NULL,
    seller_username VARCHAR(80) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (store_id, seller_username),
    KEY idx_store_seller_access_seller (seller_username),
    CONSTRAINT fk_store_seller_access_store
        FOREIGN KEY (store_id) REFERENCES stores(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Patrón de asignación central (ejecutar desde la API dentro de una transacción):
-- START TRANSACTION;
-- INSERT INTO stores (name, address, responsible_seller_username, seller_access, credit_authorized)
-- VALUES (?, ?, ?, ?, ?);
-- SET @new_store_id = LAST_INSERT_ID();
-- UPDATE stores
-- SET code = CONCAT('SD-TDA-', LPAD(@new_store_id, 3, '0'))
-- WHERE id = @new_store_id;
-- COMMIT;
-- Si seller_access = 'selected', insertar en store_seller_access los vendedores autorizados.
-- El vendedor responsable también debe quedar autorizado en ese modo.
