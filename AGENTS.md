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

## JSON

Define every project-owned JSON structure as an object with a required, non-null top-level `version` field. Use it to identify the data format when reading or rendering the payload.

## List pagination / 列表分页

- Numbered lists use GET query parameters `page` (integer from 1 to 1,000,000, default 1) and `pageSize` (integer from 1 to 100, default 20). Use `search` for optional keyword search. Trim it, cap it at 200 characters, and treat an empty value as no search. Name other filters for their domain, such as `projectId` and `status`.
  页码列表使用 GET 查询参数 `page`（1 至 1,000,000 的整数，默认 1）和 `pageSize`（1 至 100 的整数，默认 20）。关键词用可选的 `search`，去掉首尾空白，最多 200 字符，空值表示不搜索。其他筛选按业务命名，例如 `projectId` 和 `status`。
- Apply authorization and all filters before pagination. Sort deterministically with a unique tie-breaker. Return `{ version: 1, rows, page, pageSize, total }`, where `total` counts all matching records before pagination. Out-of-range pages return empty `rows` and the same filtered total.
  先校验权限并应用所有筛选，再分页。排序应稳定，并以唯一字段作为同值时的排序依据。返回 `{ version: 1, rows, page, pageSize, total }`，`total` 为分页前符合条件的记录数。超出数据范围的页返回空 `rows` 和同一筛选总数。
- Load-more pickers can use the same parameters and return `{ version: 1, rows, page, pageSize, nextPage }` when a total is unnecessary. Use `nextPage: null` at the end.
  下拉加载更多等无需总数的场景可使用相同参数，返回 `{ version: 1, rows, page, pageSize, nextPage }`。末页返回 `nextPage: null`。
- Web list routes keep the page, page size, and filters in the URL. Include those values and the workspace in the query key. Changing a filter or page size resets to page 1. Paging and refreshing retain the current filters.
  Web 列表将页码、每页条数和筛选保存在 URL，并连同工作区纳入查询缓存键。更改筛选或每页条数回到第 1 页，翻页和刷新保留当前筛选。

## File uploads

Use [Files SDK](https://files-sdk.dev/) for R2 and S3 uploads, including presigning and writes through the API.

## Functions

The main function is the happy path. Put validation and detail in subfunctions.

Extract a function only when the logic is reused, when it hides real complexity, or when it names a concept of its own. Leave a one-off inline.

## Comments

Comment a non-obvious constraint or a counterintuitive step. Leave obvious code uncommented.

When writing or updating comments, provide both Chinese and English versions together, keeping their meaning consistent and updating both in the same change.
编写或更新注释时，必须同步提供中英文版本，保持含义一致，并在同一次修改中同步更新。

## Generated files

Generated files are output. Change the source and regenerate them. `apps/web/src/routeTree.gen.ts` is one of these; hand-editing it does not stick.

## Tests

Test the real implementation and assert through it. Keep the business logic in the implementation. Use a mock only when that dependency cannot run.

## Process

Use the tools and workflows this repository already uses. A tool or process that is not already in use here stays out.
