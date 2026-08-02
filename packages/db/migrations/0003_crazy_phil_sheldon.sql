PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_stock_movement` (
	`id` text PRIMARY KEY NOT NULL,
	`warehouse_id` text NOT NULL,
	`item_id` text NOT NULL,
	`lot_id` text,
	`from_location_id` text,
	`to_location_id` text,
	`qty_delta` real NOT NULL,
	`movement_type` text NOT NULL,
	`reference_type` text NOT NULL,
	`reference_id` text,
	`performed_by` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lot_id`) REFERENCES `item_lot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `staff_profile`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_stock_movement`("id", "warehouse_id", "item_id", "lot_id", "from_location_id", "to_location_id", "qty_delta", "movement_type", "reference_type", "reference_id", "performed_by", "occurred_at") SELECT "id", "warehouse_id", "item_id", "lot_id", "from_location_id", "to_location_id", "qty_delta", "movement_type", "reference_type", "reference_id", "performed_by", "occurred_at" FROM `stock_movement`;--> statement-breakpoint
DROP TABLE `stock_movement`;--> statement-breakpoint
ALTER TABLE `__new_stock_movement` RENAME TO `stock_movement`;--> statement-breakpoint
PRAGMA foreign_keys=ON;