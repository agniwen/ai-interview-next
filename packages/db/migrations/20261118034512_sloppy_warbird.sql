DROP INDEX `resume_workspace_sha256_uq`;--> statement-breakpoint
CREATE INDEX `resume_workspace_sha256_idx` ON `resume` (`workspaceId`,`sha256`);--> statement-breakpoint
ALTER TABLE `application_resume` ADD `submissionId` text REFERENCES resume_submission(id);--> statement-breakpoint
ALTER TABLE `resume_submission` ADD `isDuplicate` integer DEFAULT false NOT NULL;