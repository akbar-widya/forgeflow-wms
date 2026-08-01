PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_receipt_line` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`purchase_order_line_id` text,
	`item_id` text NOT NULL,
	`lot_id` text,
	`target_location_id` text,
	`received_qty` real NOT NULL,
	`accepted_qty` real DEFAULT 0 NOT NULL,
	`rejected_qty` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipt`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`purchase_order_line_id`) REFERENCES `purchase_order_line`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lot_id`) REFERENCES `item_lot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_receipt_line`("id", "receipt_id", "purchase_order_line_id", "item_id", "lot_id", "target_location_id", "received_qty", "accepted_qty", "rejected_qty", "status") SELECT "id", "receipt_id", "purchase_order_line_id", "item_id", "lot_id", "target_location_id", "received_qty", "accepted_qty", "rejected_qty", "status" FROM `receipt_line`;--> statement-breakpoint
DROP TABLE `receipt_line`;--> statement-breakpoint
ALTER TABLE `__new_receipt_line` RENAME TO `receipt_line`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_scrap_return` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`item_id` text NOT NULL,
	`lot_id` text,
	`target_location_id` text NOT NULL,
	`return_qty` real NOT NULL,
	`reason_code` text NOT NULL,
	`returned_by` text,
	`returned_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lot_id`) REFERENCES `item_lot`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_scrap_return`("id", "job_id", "item_id", "lot_id", "target_location_id", "return_qty", "reason_code", "returned_by", "returned_at") SELECT "id", "job_id", "item_id", "lot_id", "target_location_id", "return_qty", "reason_code", "returned_by", "returned_at" FROM `scrap_return`;--> statement-breakpoint
DROP TABLE `scrap_return`;--> statement-breakpoint
ALTER TABLE `__new_scrap_return` RENAME TO `scrap_return`;--> statement-breakpoint
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
	FOREIGN KEY (`performed_by`) REFERENCES `staff_profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_stock_movement`("id", "warehouse_id", "item_id", "lot_id", "from_location_id", "to_location_id", "qty_delta", "movement_type", "reference_type", "reference_id", "performed_by", "occurred_at") SELECT "id", "warehouse_id", "item_id", "lot_id", "from_location_id", "to_location_id", "qty_delta", "movement_type", "reference_type", "reference_id", "performed_by", "occurred_at" FROM `stock_movement`;--> statement-breakpoint
DROP TABLE `stock_movement`;--> statement-breakpoint
ALTER TABLE `__new_stock_movement` RENAME TO `stock_movement`;