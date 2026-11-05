CREATE TABLE `application` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`candidateId` text NOT NULL,
	`jobId` text NOT NULL,
	`stage` text NOT NULL,
	`closedAt` integer,
	`outcome` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspaceId`,`candidateId`) REFERENCES `candidate`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`jobId`) REFERENCES `job`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_workspace_id_uq` ON `application` (`workspaceId`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_open_candidate_job_uq` ON `application` (`workspaceId`,`candidateId`,`jobId`) WHERE "application"."closedAt" is null;--> statement-breakpoint
CREATE TABLE `application_evaluation` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`applicationId` text NOT NULL,
	`resumeId` text NOT NULL,
	`jobRequirementsSnapshot` text NOT NULL,
	`result` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspaceId`,`applicationId`) REFERENCES `application`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`resumeId`) REFERENCES `resume`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `application_resume` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`applicationId` text NOT NULL,
	`resumeId` text NOT NULL,
	`status` text NOT NULL,
	`confirmedByUserId` text,
	`confirmedAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`confirmedByUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`applicationId`) REFERENCES `application`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`resumeId`) REFERENCES `resume`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_resume_pair_uq` ON `application_resume` (`applicationId`,`resumeId`);--> statement-breakpoint
CREATE TABLE `candidate` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`name` text NOT NULL,
	`phoneNormalized` text,
	`email` text,
	`latestEmployer` text,
	`creationSource` text NOT NULL,
	`profileEditedAt` integer,
	`archivedAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_workspace_id_uq` ON `candidate` (`workspaceId`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_active_phone_uq` ON `candidate` (`workspaceId`,`phoneNormalized`) WHERE "candidate"."archivedAt" is null and "candidate"."phoneNormalized" is not null;--> statement-breakpoint
CREATE TABLE `candidate_note` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`candidateId` text NOT NULL,
	`authorUserId` text NOT NULL,
	`body` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`candidateId`) REFERENCES `candidate`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `candidate_phone_history` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`candidateId` text NOT NULL,
	`previousPhoneNormalized` text NOT NULL,
	`changedByUserId` text NOT NULL,
	`changedAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changedByUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`candidateId`) REFERENCES `candidate`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `interview_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`interviewRoundId` text NOT NULL,
	`authorUserId` text NOT NULL,
	`body` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`authorUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`interviewRoundId`) REFERENCES `interview_round`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `interview_round` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`applicationId` text NOT NULL,
	`resumeId` text,
	`sequence` integer NOT NULL,
	`status` text NOT NULL,
	`scheduledAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspaceId`,`applicationId`) REFERENCES `application`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`resumeId`) REFERENCES `resume`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interview_round_workspace_id_uq` ON `interview_round` (`workspaceId`,`id`);--> statement-breakpoint
CREATE TABLE `job` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`title` text NOT NULL,
	`requirements` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_workspace_id_uq` ON `job` (`workspaceId`,`id`);--> statement-breakpoint
CREATE TABLE `resume` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`candidateId` text,
	`sha256` text NOT NULL,
	`pdfObjectKey` text NOT NULL,
	`parseStatus` text DEFAULT 'pending' NOT NULL,
	`markdown` text,
	`parsedProfile` text,
	`extractedPhoneNormalized` text,
	`phoneMatchDisabledAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspaceId`,`candidateId`) REFERENCES `candidate`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resume_workspace_id_uq` ON `resume` (`workspaceId`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `resume_workspace_sha256_uq` ON `resume` (`workspaceId`,`sha256`);--> statement-breakpoint
CREATE TABLE `resume_ownership_change` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`resumeId` text NOT NULL,
	`fromCandidateId` text NOT NULL,
	`toCandidateId` text NOT NULL,
	`changedByUserId` text NOT NULL,
	`changedAt` integer NOT NULL,
	`phoneMatchDisabled` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changedByUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`resumeId`) REFERENCES `resume`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`fromCandidateId`) REFERENCES `candidate`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`toCandidateId`) REFERENCES `candidate`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `resume_submission` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`resumeId` text NOT NULL,
	`jobId` text,
	`originalFilename` text NOT NULL,
	`identityStatus` text DEFAULT 'pending' NOT NULL,
	`pdfMatchedCandidateId` text,
	`phoneMatchedCandidateId` text,
	`resolvedCandidateId` text,
	`applicationId` text,
	`phoneChangeStatus` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspaceId`,`resumeId`) REFERENCES `resume`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`jobId`) REFERENCES `job`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`pdfMatchedCandidateId`) REFERENCES `candidate`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`phoneMatchedCandidateId`) REFERENCES `candidate`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`resolvedCandidateId`) REFERENCES `candidate`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspaceId`,`applicationId`) REFERENCES `application`(`workspaceId`,`id`) ON UPDATE no action ON DELETE no action
);
