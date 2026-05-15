# Third-Party Skills

This repository does not vendor third-party skills by default. Use `third-party-skills.json` and `scripts/install-third-party-skills.js` to install optional skills from their source repositories.

## Install Defaults

```sh
node scripts/install-third-party-skills.js --yes
```

Default installation only includes skills with confirmed permissive licenses.

## List Skills

```sh
node scripts/install-third-party-skills.js --list
```

## Optional Or Restricted Skills

```sh
node scripts/install-third-party-skills.js --include product-designer --allow-restricted --yes
```

Do not install restricted skills unless you have reviewed and accepted their original license terms.

## Skill Inventory

| Skill | Source | License | Default | Notes |
| --- | --- | --- | --- | --- |
| `brainstorming` | `obra/superpowers` | MIT | yes | Confirmed from source repository LICENSE. |
| `customer-research` | `coreyhaines31/marketingskills` | MIT | yes | Confirmed from source repository LICENSE. |
| `frontend-design` | `anthropics/skills` | Apache-2.0 | yes | This specific skill includes Apache-2.0 terms. |
| `grill-me` | `mattpocock/skills` | MIT | yes | Confirmed from source repository LICENSE. |
| `prd` | `github/awesome-copilot` | MIT | yes | Confirmed from source repository LICENSE. |
| `to-prd` | `mattpocock/skills` | MIT | yes | Confirmed from source repository LICENSE. |
| `product-designer` | `borghei/claude-skills` | MIT + Commons Clause | no | Optional; Commons Clause restricts selling this skill or substantially similar copies. |
| `web-design-guidelines` | `vercel-labs/agent-skills` | unknown | no | Source repository currently has no declared license. |
| `docx` | `anthropics/skills` | proprietary | no | Not installable by this script. Use only through authorized Anthropic services. |
| `pptx` | `anthropics/skills` | proprietary | no | Not installable by this script. Use only through authorized Anthropic services. |

## Memory Marker

After installation, the script writes the `memory/index.json` field `thirdPartySkills.initializedAt`. Yet Another Boss Request uses this marker to know whether it should guide the user through third-party skill setup.
