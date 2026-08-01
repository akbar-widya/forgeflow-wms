CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_user_id` text NOT NULL,
	`employee_code` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'operator' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_profile_auth_user_id_unique` ON `staff_profile` (`auth_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `staff_profile_employee_code_unique` ON `staff_profile` (`employee_code`);--> statement-breakpoint
CREATE TABLE `location` (
	`id` text PRIMARY KEY NOT NULL,
	`warehouse_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`code` text NOT NULL,
	`location_type` text DEFAULT 'rack' NOT NULL,
	`capacity_qty` real,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`zone_id`) REFERENCES `zone`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `location_code_unique` ON `location` (`code`);--> statement-breakpoint
CREATE TABLE `warehouse` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `warehouse_code_unique` ON `warehouse` (`code`);--> statement-breakpoint
CREATE TABLE `zone` (
	`id` text PRIMARY KEY NOT NULL,
	`warehouse_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'storage' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `item` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`uom` text NOT NULL,
	`category` text,
	`lot_tracked` integer DEFAULT false NOT NULL,
	`expiry_tracked` integer DEFAULT false NOT NULL,
	`serial_tracked` integer DEFAULT false NOT NULL,
	`reorder_point` real,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_sku_unique` ON `item` (`sku`);--> statement-breakpoint
CREATE TABLE `item_lot` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`lot_code` text NOT NULL,
	`expiry_date` integer,
	`quality_status` text DEFAULT 'available' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stock_balance` (
	`id` text PRIMARY KEY NOT NULL,
	`warehouse_id` text NOT NULL,
	`location_id` text NOT NULL,
	`item_id` text NOT NULL,
	`lot_id` text,
	`on_hand_qty` real DEFAULT 0 NOT NULL,
	`allocated_qty` real DEFAULT 0 NOT NULL,
	`available_qty` real DEFAULT 0 NOT NULL,
	`stock_status` text DEFAULT 'out_of_stock' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lot_id`) REFERENCES `item_lot`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_order` (
	`id` text PRIMARY KEY NOT NULL,
	`warehouse_id` text NOT NULL,
	`po_number` text NOT NULL,
	`supplier_name` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`expected_date` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_order_po_number_unique` ON `purchase_order` (`po_number`);--> statement-breakpoint
CREATE TABLE `purchase_order_line` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_order_id` text NOT NULL,
	`item_id` text NOT NULL,
	`ordered_qty` real NOT NULL,
	`received_qty` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_order`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quality_inspection` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_line_id` text NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL,
	`discrepancy_code` text,
	`notes` text,
	`inspected_by` text,
	`inspected_at` integer,
	FOREIGN KEY (`receipt_line_id`) REFERENCES `receipt_line`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `receipt` (
	`id` text PRIMARY KEY NOT NULL,
	`warehouse_id` text NOT NULL,
	`purchase_order_id` text,
	`receipt_number` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`received_by` text,
	`received_at` integer,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_order`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipt_receipt_number_unique` ON `receipt` (`receipt_number`);--> statement-breakpoint
CREATE TABLE `receipt_line` (
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
	FOREIGN KEY (`lot_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_location_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job` (
	`id` text PRIMARY KEY NOT NULL,
	`warehouse_id` text NOT NULL,
	`job_number` text NOT NULL,
	`work_order_ref` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`due_date` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_job_number_unique` ON `job` (`job_number`);--> statement-breakpoint
CREATE TABLE `job_bom_line` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`item_id` text NOT NULL,
	`required_qty` real NOT NULL,
	`issued_qty` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `job_issue` (
	`id` text PRIMARY KEY NOT NULL,
	`job_bom_line_id` text NOT NULL,
	`source_location_id` text NOT NULL,
	`issue_qty` real NOT NULL,
	`issued_by` text,
	`issued_at` integer NOT NULL,
	FOREIGN KEY (`job_bom_line_id`) REFERENCES `job_bom_line`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scrap_return` (
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
	FOREIGN KEY (`lot_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stock_movement` (
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
	FOREIGN KEY (`lot_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `staff_profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`movement_id` text,
	`severity` text DEFAULT 'info' NOT NULL,
	`type` text DEFAULT 'system' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`movement_id`) REFERENCES `stock_movement`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `idempotency_key` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`route` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_key_key_unique` ON `idempotency_key` (`key`);