# Phase 16.3 deferred items

## ConferenceRoomPage unmount clears the in-session chrome

- **Found during:** 16.3-06 (ConferenceMiniPanel)
- **Out of scope:** `packages/frontend/src/pages/ConferenceRoomPage/ConferenceRoomPage.tsx` is not in 16.3-06 files
- **Issue:** The page still dispatches `leaveSession()` and `roomHook.leave()` on unmount. Navigating away from `/conferences/:uid/room` therefore drops `selectConferenceSession` and hangs up the UA, so the mini-panel cannot appear after a real leave-the-page navigation
- **Do not fix here:** session lifetime above the room page is a shell-level change (Rule 4 / circle of concern)
- **Follow-up:** Stop tearing down the session on route change; hang up only on explicit leave/end
