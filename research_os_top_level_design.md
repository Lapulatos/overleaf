# Research OS Top-Level Design

## Conclusion

This project is not just an AI assistant added to Overleaf. It is a research workspace built on top of open-source Overleaf: paper writing, LaTeX repair, code implementation, experiment execution, result analysis, literature organization, and automatic research progress recording are all treated as traceable tasks.

The recommended top-level architecture is:

```text
Overleaf Fork
  + AI Task Service
  + OpenACP as the agent gateway
  + CAO for complex multi-agent orchestration
  + Research Ledger for task, experiment, and writing history
  + Sandboxed execution for LaTeX, agents, and experiments
```

## Product Goal

Build a collaborative research writing platform based on open-source Overleaf.

The platform should support:

- Collaborative LaTeX paper editing.
- AI-assisted writing and revision.
- Automatic LaTeX compile error diagnosis and repair.
- Method-description-to-code implementation.
- Experiment execution and result analysis.
- Multi-user collaborative experiment planning, execution, review, and comparison.
- Literature search, filtering, summary, and BibTeX organization.
- Automatic progress records for tasks, experiments, writing, and agent actions.
- Versioned and auditable research artifacts.

The core user groups are researchers, graduate students, PIs, and research teams.

The core value is reducing manual handoff between writing, debugging, coding, experiments, results, and literature work.

## Top-Level Architecture

```text
Overleaf Fork
  |
  |-- AI Task Service
  |     |-- Task API
  |     |-- Task Queue
  |     |-- Permission / Approval
  |     |-- Research Ledger
  |
  |-- Agent Gateway
  |     |-- OpenACP
  |     |-- Claude Code / Codex / Gemini / OpenCode
  |
  |-- Complex Worker Layer
  |     |-- CAO for multi-agent orchestration
  |     |-- Experiment runners
  |     |-- Collaborative experiment scheduler
  |     |-- LaTeX repair workers
  |
  |-- Sandbox Layer
  |     |-- LaTeX compile sandbox
  |     |-- Code execution sandbox
  |     |-- Agent workspace sandbox
  |
  |-- Artifact Store
        |-- PDFs
        |-- logs
        |-- patches
        |-- metrics
        |-- figures
        |-- BibTeX
```

## Recommended Component Choices

| Component | Recommendation | Role |
|---|---|---|
| Base editor | Overleaf Community Edition fork | Collaborative LaTeX editing and PDF preview |
| Agent gateway | OpenACP | Unified access to Claude Code, Codex, Gemini, OpenCode, and related agents |
| Multi-agent orchestration | AWS Labs CLI Agent Orchestrator, CAO | Complex task decomposition and multi-agent collaboration |
| Monitoring | AgentPulse, optional | Agent session observability and debugging |
| Task queue | Redis + BullMQ, Celery, or Temporal | Async task scheduling and retries |
| Database | Postgres | Projects, tasks, events, snapshots, metrics, decisions |
| Event payload | JSONB | Flexible event metadata |
| Artifact store | S3, MinIO, or local object storage | Logs, PDFs, patches, figures, experiment outputs |
| Sandbox | Docker, Kubernetes Job, or Firecracker | Isolated execution |
| File versioning | Git, libgit2, or isomorphic-git | File-level version history |
| Experiment tracking | Self-built MVP first, MLflow/DVC later | Experiment metadata and reproducibility |
| Collaborative experiments | Self-built workflow layer over runners and ledger | Shared plans, ownership, review, quota, and result comparison |
| Literature layer | Zotero + arXiv/Semantic Scholar adapters | Literature ingestion and citation management |

CloudCLI / ClaudeCodeUI is not recommended as the core backend because it overlaps with the Overleaf UI and uses AGPL-3.0, which may complicate closed-source commercial use.

## Core Modules

### 1. Overleaf Editing Layer

Responsibilities:

- Edit `.tex` and `.bib` files.
- Support collaborative editing.
- Render PDF previews.
- Manage project files.
- Display comments, suggestions, and patch reviews.

Required extensions:

- AI task sidebar.
- Inline text rewrite actions.
- Task history panel.
- Experiment result panel.
- Agent run log panel.
- Patch accept/reject UI.

### 2. AI Task Service

This is the main business backend. It manages task lifecycle rather than directly implementing agent logic.

Responsibilities:

- Create tasks.
- Save input context.
- Create project snapshots.
- Dispatch tasks to agents or workers.
- Receive streaming events.
- Save logs and artifacts.
- Generate patches.
- Wait for user approval.
- Write accepted changes back to the Overleaf project.
- Record user decisions.

Candidate task types:

```text
writing.polish
writing.review
latex.fix_compile
latex.fix_bib
code.implement_method
experiment.run
experiment.analyze
literature.search
literature.summarize
paper.related_work
```

### 3. Agent Gateway

Recommended component: OpenACP.

Responsibilities:

- Connect to Claude Code, Codex, Gemini, OpenCode, and related agents.
- Manage sessions.
- Stream agent output.
- Handle permission approval.
- Preserve native agent behavior.
- Reduce the maintenance burden of CLI-specific adapters.

### 4. Multi-Agent Worker Layer

Recommended component: CAO.

Suitable tasks:

- One agent writes code.
- One agent reviews code.
- One agent runs tests or experiments.
- One agent analyzes results.
- One agent writes a final report.

Typical flow:

```text
Plan -> Implement -> Run -> Analyze -> Review -> Patch
```

### 5. Research Ledger

The Research Ledger is the Git-like progress record layer for research activity.

It should record not only file versions, but also:

- Who created a task.
- What the agent did.
- Which commands were run.
- Which files were changed.
- Which experiment parameters were used.
- What metrics were produced.
- Which suggestions were accepted or rejected.
- Why a figure, table, patch, or report was generated.

Minimal data model:

```text
projects
tasks
task_runs
events
artifacts
snapshots
decisions
metrics
experiment_plans
experiment_runs
run_groups
run_reviews
resource_quotas
```

### 6. Collaborative Experiment Layer

Multi-user collaboration should be a first-class experiment capability, not only a shared log page.

Responsibilities:

- Let multiple users create, edit, assign, and review experiment plans.
- Support shared experiment queues within a project or lab workspace.
- Track ownership for each run, metric, artifact, and decision.
- Allow users to compare runs across branches, methods, parameters, and data versions.
- Prevent conflicting writes to the same code, config, or generated result.
- Enforce per-user, per-project, and per-lab resource quota.
- Record approvals for expensive, long-running, or external-resource experiments.
- Support comments and review threads on experiment runs and result tables.

Key collaborative objects:

```text
ExperimentPlan
ExperimentRun
RunGroup
RunReview
ResourceQuota
ResultComparison
ExperimentDecision
```

Recommended collaboration flow:

```text
User A creates an experiment plan
-> User B comments on parameters or baseline choice
-> PI or project owner approves the plan
-> Scheduler launches one or more sandboxed runs
-> System streams logs and intermediate metrics
-> Users compare results
-> Agent generates summary and LaTeX table
-> Users review the interpretation
-> Accepted results are linked to the paper draft
-> Research Ledger records plan, runs, reviews, decisions, and artifacts
```

Important design rule:

```text
Experiment artifacts can be shared immediately, but paper/code write-back should require explicit review.
```

## Key Workflows

### LaTeX Compile Error Repair

```text
User clicks "Fix compile error"
-> System saves current project snapshot
-> System extracts compile.log
-> Agent analyzes the error
-> Agent modifies .tex/.bib files in a sandboxed workspace
-> System runs latexmk in a sandbox
-> If successful, system generates a patch
-> User reviews the patch
-> Accepted patch is written back to Overleaf
-> Research Ledger records the full process
```

### Paper Text Revision

```text
User selects a paragraph
-> User chooses polish / shorten / Nature style / reviewer response
-> LLM generates candidate edits
-> System displays suggestions or comments
-> User accepts or rejects suggestions
-> Research Ledger records the original text, suggestions, and decision
```

This workflow does not always need Claude Code or Codex. Direct LLM API calls are often lighter and faster.

### Method Description to Experiment Code

```text
User submits method description
-> Agent generates an implementation plan
-> User approves the plan
-> CAO dispatches implementation tasks
-> Agent writes code
-> Runner installs dependencies and runs tests/experiments
-> System saves metrics, logs, and figures
-> System generates experiment report and LaTeX tables
-> User reviews the patch and artifacts
```

### Multi-User Collaborative Experiment

```text
User creates an experiment plan
-> Collaborators review baselines, datasets, parameters, and expected outputs
-> Owner or PI approves execution
-> Scheduler assigns sandboxed runs
-> Logs, metrics, and artifacts stream into the shared experiment panel
-> Users compare runs and comment on results
-> Agent drafts an analysis summary
-> Users accept, revise, or reject the interpretation
-> Accepted tables, figures, and claims are linked back to the paper
```

### Literature Organization

```text
User submits a topic or seed papers
-> Literature worker searches arXiv, Semantic Scholar, Zotero, or other sources
-> System generates candidate paper list
-> User filters candidates
-> System generates BibTeX
-> System generates related-work notes
-> Accepted content can be inserted into the paper draft
```

## Versioning and Progress Recording

Use two layers:

```text
Git-like file versioning:
- .tex
- .bib
- code
- config
- generated tables

Research Ledger:
- task events
- agent logs
- experiment runs
- decisions
- metrics
- artifacts
```

Each completed task should produce a research commit record:

```text
Task: latex.fix_compile
Status: completed
Base snapshot: abc123
Result snapshot: def456
Changed files:
  - main.tex
  - references.bib
Artifacts:
  - compile.log
  - output.pdf
  - diff.patch
Verification:
  - latexmk passed
Decision:
  - accepted by user
```

## Event Model

Example event:

```json
{
  "event_id": "evt_...",
  "project_id": "proj_...",
  "task_id": "task_...",
  "run_id": "run_...",
  "type": "agent.command.finished",
  "actor": "agent:codex",
  "timestamp": "2026-06-05T12:30:00Z",
  "summary": "Ran latexmk and found missing citation errors",
  "payload": {
    "command": "latexmk -pdf main.tex",
    "exit_code": 1,
    "log_artifact_id": "art_..."
  },
  "parent_event_id": "evt_..."
}
```

Useful event categories:

```text
task.created
task.started
task.completed
task.failed
agent.message
agent.command.started
agent.command.finished
agent.file.patch
latex.compile.started
latex.compile.finished
experiment.run.started
experiment.run.finished
experiment.metrics.recorded
experiment.plan.created
experiment.plan.reviewed
experiment.run.assigned
experiment.run.compared
experiment.result.approved
artifact.created
decision.accepted
decision.rejected
snapshot.created
```

## Safety Boundaries

This is a P0 requirement.

Overleaf Community Edition is designed primarily for trusted-user environments. Without sandboxed compiles, LaTeX compilation may access container files, network, and environment variables. A production multi-user system must add sandboxing.

Required isolation:

- LaTeX compilation.
- Agent file reads and writes.
- Code and experiment execution.
- Network access.
- User project directories.
- API keys and cloud credentials.
- Dataset access.

Default policy:

- Agents cannot directly modify the main project.
- Agents work only in temporary snapshots or worktrees.
- All patches require user confirmation.
- Experiment containers receive no default secrets.
- Dangerous commands require approval.
- All artifacts and actions are auditable.

## MVP Scope

### Phase 1

Build three closed loops first:

- LaTeX compile error repair.
- Selected-text polishing and rewriting.
- Task progress ledger and artifact recording.

### Phase 2

Add experiment support:

- Method description to code.
- Sandboxed experiment execution.
- Metrics, figures, logs, and LaTeX table generation.
- Multi-user experiment plans, shared run history, comments, and result comparison.

### Phase 3

Add literature and advanced multi-agent workflows:

- Literature search and BibTeX management.
- Related-work draft generation.
- Multi-agent review and verification loops.

## Open Decisions

### Commercialization

If this product will be commercial, license constraints must be checked early.

Important points:

- CloudCLI / ClaudeCodeUI uses AGPL-3.0 and should not be deeply embedded into a closed-source commercial core without legal review.
- Overleaf Community Edition itself also has open-source license implications that must be checked before SaaS or redistribution.

### User Trust Model

Key question:

```text
Are users mutually trusted?
```

If not, sandboxing is the first engineering priority.

### Agent Billing Model

Options:

- Users bring their own API keys or subscriptions.
- Platform pays for agent usage and bills users.
- Hybrid model.

This decision affects quota, abuse prevention, logging, and permission design.

### Long-Running Experiments

If long-running experiments are allowed, the system needs:

- Job scheduler.
- Quota management.
- Checkpointing.
- Artifact streaming.
- Failure recovery.

### Multi-User Experiment Collaboration

Open questions:

- Who can approve expensive or long-running experiments?
- Are experiment resources allocated per user, per project, or per lab?
- Can collaborators edit an approved experiment plan, or must they create a new revision?
- Should failed runs be visible to all collaborators by default?
- Which experiment outputs can be auto-linked to the paper, and which require manual approval?

### Result Write-Back Policy

Recommended MVP policy:

```text
All agent-generated changes require human review before being applied.
```

Automatic application can be added later only for low-risk tasks.

## Design Positioning

```text
An AI-native research workspace based on Overleaf:
OpenACP and CAO execute tasks,
sandboxes protect users and projects,
Research Ledger records the full research process,
and Overleaf UI remains the main writing and review surface.
```
