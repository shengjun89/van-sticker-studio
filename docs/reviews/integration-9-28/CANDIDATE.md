# Issue #31: bounded integration candidate

Executor: GPT (Codex cloud implementer). Claim: `vss-integration-9-28-gpt-20261026-01`.
Task: `01a1786a-607f-71a4-a4e4-46c3f78f8014`; initial turn: `01a1786a-6b63-71b5-87d1-130c1e4d42f0`.
Prepared on 2026-10-26 UTC in `/workspace/van-sticker-studio`; no user Mac used.
Branch: `feature/31-acceptance-candidate`. Refs #31, #9, #28.

## Authority and frozen inputs

Read the frozen main versions of `constitution.md`, `AGENTS.md`, `CONTRIBUTING.md`,
the PR template and both Issue templates. Repository `.agents/skills/` is absent;
the environment `/workspace/.agents/` is empty, so no local `SKILL.md` was available.
No unmerged governance rules were adopted.

| Input | Exact commit |
| --- | --- |
| main (including merged #22) | `3ef8fc05691604dbb9c546a67fe24c8c2c178cb4` |
| PR #9 | `5eddce13e9bbad38038daa69555c81700900a7b0` |
| PR #28 | `9b8b9dfcd791345ea7147725586d450b26a7f337` |

[Issue #31](https://github.com/shengjun89/van-sticker-studio/issues/31) specifies this
union. [CI authorization and execution receipt](https://github.com/shengjun89/van-sticker-studio/issues/31#issuecomment-6417327163)
records the owner's direct 13:34 UTC approval: use the existing automatic GitHub CI
with its existing build identity configuration. This permits one bounded push and
a Draft PR. It does not authorize local application execution or reading identity
configuration, workflow/configuration changes, main merge, production deployment,
real AI generation, credential/permission changes, or a retry after CI failure.

## Source stop and exclusivity checks

- [PR #9 final stop receipt](https://github.com/shengjun89/van-sticker-studio/pull/9#issuecomment-6404650271)
  records original run `bc-b9b11fa7-b141-56fa-abc2-5d5e59441f3e` as finished at the
  frozen head. The original VM's uncommitted state remains **unverified**; that VM
  was not accessed or restarted. No unpublished source work was discovered here.
- [PR #28 freeze receipt](https://github.com/shengjun89/van-sticker-studio/pull/28#issuecomment-6405000921)
  and [coordinator confirmation](https://github.com/shengjun89/van-sticker-studio/pull/28#issuecomment-6405028843)
  record original run `bc-a0c2a143-fdbe-518a-9f4b-42d2d9a17fe0` as finished,
  last worktree clean, dev stopped. VM retention is unknown. No source run restarted.
- Initial local `status --porcelain=v1 --untracked-files=all` was empty. There was
  one worktree, branch `work`, at the frozen main and no local candidate branch.
- `ls-remote --heads origin` matched all three frozen heads and found no candidate
  branch. Both source PRs were open Drafts at their frozen heads.
- A separate **read-only** inventory at 13:36:35 UTC checked all 9 open PRs, all 14
  remote branches, and all 34 Actions runs. There was no duplicate candidate
  branch/PR/run and no running Actions. This was not another implementation run.
  Sources: [PR inventory](https://api.github.com/repos/shengjun89/van-sticker-studio/pulls?state=open&per_page=100&page=1),
  [branch inventory](https://api.github.com/repos/shengjun89/van-sticker-studio/branches?per_page=100&page=1),
  [run inventory](https://api.github.com/repos/shengjun89/van-sticker-studio/actions/runs?per_page=100&page=1).
- Process metadata showed the Codex/tool process chain and environment services;
  no application server, test, browser or other implementation writer was found.
  A detached `git` PID 633 was reconciled as state `Z` (zombie), with empty cmdline:
  it was already exited and could not write. No process was killed or restarted.

## Composition and content identity

Source merge bases are `62f9318accac151544060f2cbfceaec72beda0d0` (#9) and
`20aee5d1136bcfbec9b2a992aa5fbdfa25ff9eaf` (#28). The source path sets are disjoint.
Both exact source patches passed `git apply --check --index` against frozen main,
then applied without conflict. No implementation, assertion or source evidence
was repaired, rewritten, weakened or regenerated.

The staged product/evidence tree **before adding this record** was
`982c2b6c451ec02bf84f08052551bee32685f3ec`.
An entire-index versus main metadata comparison proved that its only differences
were the following ten paths; each file mode and blob exactly matched its frozen
source. The final candidate adds only this record under the authorized new evidence
directory. The final commit SHA and remote CI observations belong in the Draft PR
handoff, avoiding a self-referential commit identifier in this file.

| Path | Source | Exact Git blob |
| --- | --- | --- |
| `tests/secret-hygiene.test.ts` | #9 | `a8a47e99957ae99ae001c1e511fc6eb1c5daceac` |
| `tools/scan-dist-secrets.mjs` | #9 | `af851df041b973adada3f5bb81d183ef2e0809d9` |
| `app/page.tsx` | #28 | `dcee92555844554ee41857d8d87dc2f2f15a1e3c` |
| `lib/i18n.ts` | #28 | `91e7884b386bcc897e31855551e7f4d3e6db7625` |
| `tests/generation-availability.test.ts` | #28 | `9d6f436c25e105253b02b906d26973115616d8cb` |
| `docs/reviews/pr-17/EVIDENCE.md` | #28 | `bdeff9fffff26a9882dff0adcedcb23dabdd5cba` |
| `docs/reviews/pr-17/disabled-en.png` | #28 | `02fae0b94ab1a464751eae83e9807d95f0b4c883` |
| `docs/reviews/pr-17/disabled-zh.png` | #28 | `00f78bdb9a8cde32339bc49967d4f73b74d80356` |
| `docs/reviews/pr-17/recovered-en.png` | #28 | `04342edd89813d11fb42587ac6d209e524bb6c38` |
| `docs/reviews/pr-17/recovered-zh.png` | #28 | `c6af0228bfa1ea5d0f7b5813e3465e64766ec3cc` |

The seven documents merged by #22 remain byte-identical to frozen main:
`docs/opc/decal-material-library.md`, `docs/opc/demand-pool.md`,
`docs/opc/layout-data-pipeline.md`, `docs/opc/sticker-compliance-onepager.md`,
`docs/opc/validation/problem-hypothesis.md`, `docs/opc/validation/red-team-brief.md`,
`docs/opc/validation/validation-plan.md`. The entire-index comparison also preserves
every other main path outside the allowlist, including governance, workflows,
configuration, spec and GLB. #23/#25/#26/#30 and the new vehicle direction are excluded.

## Local commands and results

All Git operations used `git -c core.hooksPath=/dev/null -c core.fsmonitor=false`;
diffs additionally used `--no-ext-diff --no-textconv`. No hooks or external diff
driver ran. These controls do not represent completion of application gates.

| Command/action | Result |
| --- | --- |
| `status --porcelain=v1 --untracked-files=all`; `worktree list --porcelain`; local branch metadata | exit 0; initially clean, one worktree |
| `ls-remote --heads origin` | exit 0; frozen inputs match, no candidate branch |
| `fetch --no-tags --no-write-fetch-head origin <frozen-9> <frozen-28>` | exit 0; exact objects fetched, source refs untouched |
| `merge-base <main> <frozen-source>` for each source | exit 0; bases listed above |
| `diff --no-ext-diff --no-textconv --binary <source-base> <source-head>` for each source | exit 0; operational patch files in `/tmp` |
| `check-attr filter merge diff -- <ten allowed paths>` | exit 0; all unspecified; no custom driver/filter |
| `apply --check --index /tmp/vss-31-source-9.patch` and `...-28.patch` | exit 0 each; no conflicts |
| `switch -c feature/31-acceptance-candidate <frozen-main>` | exit 0 |
| `apply --index /tmp/vss-31-source-9.patch` and `...-28.patch` | exit 0 each |
| `diff --no-ext-diff --no-textconv --cached --check` | exit 0; no whitespace errors |
| entire-tree path/mode/blob comparison via `ls-tree` and `ls-files --stage` | exit 0; exact source union and all remaining main entries preserved |

Discovery probes also reported missing repository `.agents` (rg exit 2) and source
objects not initially present (cat-file exit 128); no application execution or
integration failed. Frozen objects were subsequently fetched once; no failed
build, integration, push or remote run was retried.

## Not run and pending acceptance

- Local `npm install`, `npm ci`, lint, tests (including targeted/red/green tests),
  `npx tsc --noEmit`, build, dev and browser: **not run**. Local configuration
  consumption is prohibited; no dependencies or substitute configuration added.
- Local post-build `node tools/scan-dist-secrets.mjs`: **not run**; no local build
  produced candidate `dist/client`. Only a safe existing CI artifact path could
  support later scanning. If none is available, report the gap without changing CI.
- Existing source-PR gate/scanner reports are historical evidence only; they do
  not pass this combined SHA. Record automatic remote CI and actual checkout SHA
  separately in the Draft PR. Any failed CI stops this task without rerun or repair.
- No private identity/configuration file was opened or printed, including
  `.openai/hosting.json`, `.env` or real credential files.
- No new screenshots, paid generation, runtime/language/input-preservation/recovery
  acceptance or owner visual approval. Existing `pr-17` screenshots are preserved
  source evidence, not before/after evidence or runtime acceptance for this tree.
- A successful `/api/status` response alone is not proof of upstream generation
  health. Preview acceptance must avoid real generation requests and charges.
- Non-implementer review must bind the final combined SHA; this implementer does
  not self-review. Draft candidate is not a main/production approval.

## Handoff and rollback

After pre-push input/exclusivity recheck: one normal push, one Draft PR, observe
existing CI/preview metadata, then stop and hand the exact SHA to the parent for
independent review. Keep the candidate, source branches, PRs and Issues. Main and
production are unchanged. No deletion/reset/rebase/force push is part of rollback.

Cost is unavailable in this environment (`[NEEDS CLARIFICATION]`); preparation
started around 13:34 UTC. Final elapsed time is recorded in the PR handoff.
