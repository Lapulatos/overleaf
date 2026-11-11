# New conversion package organization

Applies only to **Convert to new LaTeX ZIP**, and therefore to the new project imported from that ZIP. It does not reorganize the source project or ordinary submission checks.

Reference inspected: `/Users/sujie/Downloads/ASE26-TAMARIS.zip`, root `ASE26-TAMARIS/main.tex` (not `man.tex`). The reference is used for organization only, not scientific content or IEEE formatting.

```text
main.tex                 # target preamble, front matter, ordered section headings + inputs, bibliography
tex/
  00-abstract.tex
  01-introduction.tex
  ...                    # preserve this manuscript's own section sequence
figures/
  overview.tex           # figure environment, caption, label
  src/
    overview.pdf         # original image bytes, unchanged resolution
tables/                  # separate complete table environments
codes/                   # listing/code wrappers
algorithms/              # algorithm environments
lists/                   # standalone lists where useful
references.bib           # retain the existing bibliography filename and citation keys
submission-layout.json   # validated package-only path moves when needed
CONVERSION-REPORT.md     # completed/incomplete/decisions and directory changes
```

For example, `main.tex` contains `\section{Introduction}\label{sec:introduction}` followed by `\input{tex/01-introduction}`. Section bodies use `\input{figures/overview}`. The figure wrapper contains `\includegraphics{figures/src/overview.pdf}` plus caption and label. Avoid duplicated section headings.

Use target-template equivalents where required; do not copy the reference's hard-coded IEEE class/BST, negative spacing, `.DS_Store`, generated PDF, backup filenames, duplicated nested directories or disabled sections. Do not create scientific content or empty sections to fill this structure. Existing original files are preserved; only the exported package receives validated relocations. Root path must remain stable for import.

The optional relocation manifest contains `{"moves":[{"from":"old.png","to":"figures/src/old.png"}]}`. Server validation rejects traversal, missing sources, differing destination content, repeated paths, chains/cycles, root relocation and reserved filename collisions. New binary images are not synthesized by this mechanism: it reuses the frozen original bytes. Compile with the new paths in the isolated snapshot and report anything unverified.
