# Call System Audit Reference

Status: historical document
Last reclassified: 2026-03-30

This file no longer describes the live calling runtime.

What changed:

- the app now uses Stream Video for direct calls and voice channels
- the old Firestore/WebRTC call stack described by the earlier audit is not the active architecture
- `src/services/calls/` is no longer the transport/runtime source of truth, aside from `callSettingsService`

Use these current docs instead:

- [calls-and-audio.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/features/calls-and-audio.md)
- [STREAM_SETUP_GUIDE.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/STREAM_SETUP_GUIDE.md)
- [system-overview.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/architecture/system-overview.md)

Keep the older audit only as historical context while tracing how the project moved from the Firestore/WebRTC stack to Stream.
