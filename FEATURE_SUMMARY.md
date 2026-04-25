# Video Download with Mixed Audio - Feature Summary

## Overview
This feature allows users to download the original video with translated audio mixed in.
- Original audio: 50% volume
- Translation audio: 100% volume

## Files Changed

### New Files
1. **`src/videoDownloadMixer.ts`** - Core mixing functionality
   - Downloads video and translation audio
   - Mixes audio using Web Audio API
   - Muxes video with mixed audio using MediaRecorder

### Modified Files

2. **`src/ui/views/overlay.ts`**
   - Added `downloadVideoMixedButton` property
   - Added button to UI layout
   - Added click event handler
   - Shows/hides button with translation button

3. **`src/ui/components/downloadButton.ts`**
   - Added optional `ariaLabel` parameter to constructor

4. **`src/ui/manager.ts`**
   - Added `handleDownloadVideoMixedClick()` handler
   - Added event listener for button click
   - Hides button when clearing download data

5. **`src/index.ts`**
   - Shows/hides video mixed button alongside translation button

6. **`src/localization/locales/en.json`**
   - Added localization strings:
     - `VOTDownloadVideoMixed`
     - `VOTDownloadVideoMixedError`
     - `VOTDownloadVideoMixedNotSupported`
     - `VOTFailedGetVideo`

## How It Works

1. When translation is ready, both download buttons appear (audio-only and video-mixed)
2. Clicking the new button triggers the mixing process:
   - Downloads original video
   - Downloads translated audio
   - Mixes audio (50% original + 100% translation)
   - Creates new video file with mixed audio
   - Downloads the result as WebM

## Browser Support

Requires:
- MediaRecorder API
- HTMLVideoElement.captureStream()
- Web Audio API

Works in: Chrome, Edge, Firefox (modern versions)

## Building

```bash
bun install
bun run build
```

## Usage

1. Translate a video
2. Click the new download button (appears next to audio download button)
3. Wait for processing
4. Downloaded video will have both original and translated audio mixed
