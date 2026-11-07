ALTER TABLE `interview_round` ADD `configuration` text;--> statement-breakpoint
ALTER TABLE `interview_round` ADD `admissionDeadline` integer;--> statement-breakpoint
ALTER TABLE `interview_round` ADD `createdBy` text REFERENCES user(id);