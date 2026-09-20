# Repository migration

The project moved to [knelbaker/sickway](https://github.com/knelbaker/sickway). The predecessor repository remains private.

## Preserved

- The 142 commits in the cleaned history, including commit authors and timestamps, and the `main` and `fix/83-british-voice` branches.
- All 34 issues and 59 pull-request descriptions, using the same numbers. Previous pull requests are archived issues labeled `migration:pull-request`; they record the original author, date, and merged status. Their code is already represented in the cleaned history.
- All 97 issue/PR comments, with original authors and dates attributed in the comment text. GitHub attributes the new records to the migrating account and gives them new creation timestamps.
- Issue labels and open/closed states. Original assignees are recorded in the issue text when pending collaborator invitations prevent assignment.
- Repository settings and the five GitHub environment names. The two other collaborators were invited with their existing write access.

Issue numbers remain stable so existing dependency references continue to work. Repository documentation links point to the new issue tracker. External deployment links in archived conversations refer to the original deployment records.

## Not transferred

The old pull-request Git refs contain credential-bearing history and were not pushed. Archived issues preserve their descriptions and conversations without recreating those refs or original code diffs. Only the verified clean branches were pushed.

Hosting integrations, provider credentials, domains, and the 129 historical GitHub deployment records remain associated with the old setup. Reconnect the existing hosting project to `knelbaker/sickway`; copying a GitHub environment name does not configure a deployment or copy its secrets. No application service credentials were placed in the new repository.

The predecessor had no releases, tags, milestones, GitHub Actions runs/artifacts, repository or environment Actions secrets/variables, or wiki/discussions to migrate. Branch-protection and ruleset reads on the predecessor returned HTTP 403, so those settings could not be copied or verified. The available GitHub authorization lacks the scope to inspect project boards; any boards must be checked separately.

The migration preserves application behavior. It does not rotate previously committed credentials. Keep local environment files ignored and follow the README's server-configuration guidance.
