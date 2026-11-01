<!-- intent-skills:start -->

## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:

- Run `bunx --no-install --package @tanstack/intent intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `bunx --no-install --package @tanstack/intent intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

# Working conventions

Ship the requested behavior. These rules bound every change.

## Scope

Stay inside the requested change. Leave rare races and unlikely edge cases out.

A guard is a separate decision. Before adding one, say how the failure happens, how likely it is, and how much code it adds. Add it only after the user agrees.

## Boundaries

Validate external input once, at the entry point. After the type is established, pass that value through. Skip further defensive checks on it.

## Functions

The main function is the happy path. Put validation and detail in subfunctions.

Extract a function only when the logic is reused, when it hides real complexity, or when it names a concept of its own. Leave a one-off inline.

## Comments

Comment a non-obvious constraint or a counterintuitive step. Leave obvious code uncommented.

## Generated files

Generated files are output. Change the source and regenerate them. `src/routeTree.gen.ts` is one of these; hand-editing it does not stick.

## Tests

Test the real implementation and assert through it. Keep the business logic in the implementation. Use a mock only when that dependency cannot run.

## Process

Use the tools and workflows this repository already uses. A tool or process that is not already in use here stays out.
