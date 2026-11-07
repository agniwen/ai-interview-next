PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_department` (
	`createdAt` integer NOT NULL,
	`createdBy` text,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`workspaceId` text NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_department`("createdAt", "createdBy", "id", "name", "workspaceId") SELECT "createdAt", "createdBy", "id", "name", "workspaceId" FROM `department`;--> statement-breakpoint
DROP TABLE `department`;--> statement-breakpoint
ALTER TABLE `__new_department` RENAME TO `department`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `department_workspace_created_idx` ON `department` (`workspaceId`,`createdAt`,`id`);--> statement-breakpoint
ALTER TABLE `job` ADD `departmentId` text REFERENCES department(id);