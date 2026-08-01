ALTER TABLE `item` ADD `created_at` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `stock_balance_unique_key` ON `stock_balance` (`warehouse_id`,`location_id`,`item_id`,`lot_id`);