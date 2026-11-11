# Remove the custom Git plugin only
- [x] Archive dedicated Git source/tests and shared integration files with hashes.
- [x] Remove Git source, UI, routes and Git-only document-updater endpoints; preserve other plugins and shared document safeguards.
- [x] Verify imports/build and Paper Assistant/Venues regression tests.
- [x] Deploy removal to local candidate without touching user browser or repository data.

Validation limits: frontend plugin suite: 227 passed, 8 failed in unchanged submission planner/recommendation modules. One standalone skill-plugin test file could not start without Mongo settings. No live browser interaction performed.
