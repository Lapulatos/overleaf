# Runtime and MCP release

- [x] Inspect branch and scope; preserve unrelated edits.
- [x] Stage runtime/MCP code and required terminal/file-reference integration.
- [x] Credentials scan: no real secrets; fixed fake token in protocol test.
- [x] Staged relative dependency closure: no missing imports.
- [x] Staged syntax: 48 scripts; backend/Agent tests: 20 passed.
- [x] Frontend tests: 19 passed; staged production build succeeded with 3 warnings (review-panel export and two bundle-size warnings).
- [x] MCP demo deployment source included; server syntax checked.
- [ ] Commit and push feature/writing-assist; verify remote hash.

Initial archive extraction used an unsupported Python tarfile argument; extraction was retried with system tar. No source or deployed service was changed by this validation issue.

The first isolated build reused external workspace package links and emitted 39 warnings. Rebinding workspace packages to the staged snapshot reduced this to 3. One intermediate setup attempt lacked the installed dictionaries package; the dependency link was corrected. All attempts remain in local logs; no runtime source was changed for the build setup.
