CREATE TABLE `question_set_job` (
	`questionSetId` text NOT NULL,
	`jobId` text NOT NULL,
	PRIMARY KEY(`questionSetId`, `jobId`),
	FOREIGN KEY (`questionSetId`) REFERENCES `question_set`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`jobId`) REFERENCES `job`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_set_job_job_idx` ON `question_set_job` (`jobId`);