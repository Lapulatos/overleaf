# Calendar export

Venues exports a downloadable iCalendar (`.ics`) snapshot for Google Calendar and iCloud Calendar. No account connection or direct calendar write is performed. Later planner/source changes are not automatically synchronized.

## Export locations

- Submission planner footer: current submission and planned targets, including journals. Submission/review dates use the edited plan. Journal review outcomes are explicitly estimated. Conference milestones retain their published times; matching plan milestones are not duplicated.
- Conference card footer: available conference and indexed Track milestones.
- Individual Track footer: that Track's milestones.
- Submission timeline footer on the conference detail page: all loaded Tracks, irrespective of the highlighted Track. The Tracks container has no duplicate aggregate export footer.
- Filtered results footer (Calendar, Card, Timeline): conferences in the current filtered result set, with available milestones. Journal catalog entries are excluded. The calendar's visible month does not narrow the filtered export further.

Unknown dates are omitted. Date-only events remain all-day events; explicit timestamps are exported in UTC. Text is escaped, UTF-8 content lines are folded, and duplicate event identifiers are collapsed. Planned event identifiers include the project and target; calendar clients may handle repeated imports differently.

## Import

- Google Calendar on desktop: Settings → Import & export → choose the downloaded `.ics` file and destination calendar. [Google instructions](https://support.google.com/calendar/answer/37118)
- Apple Calendar on Mac: open/import the `.ics` file and choose a calendar in the iCloud account. [Apple instructions](https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac)

## Validation boundary

V261 production build passed, 68 frozen image files verified. Browser downloads verified for Plan (including TOSEM), conference cards, single/all Tracks, and filtered Card/Calendar views. Controls measured 12px text and 32px height with two SVG icons. No browser script errors; isolated test project archived. Actual imports into Google/iCloud accounts were not performed.

56 focused frontend checks passed. An expanded Track/calendar/view run passed 25 checks and failed 3 pre-existing view assertions; the same 3 failures were reproduced against the frozen V260 sources (old List label, compact timeline point, and location display assertions).

Presentation: shared centered, single-row Google Calendar / iCloud Calendar buttons, with an export icon and locally bundled brand SVG; no separator above the export controls. Brand asset provenance is recorded in `services/web/frontend/js/features/plugins/calendar-icons/README.md`.
