# AI Overlay

An invisible AI-powered desktop overlay. Capture anything on your screen, get
AI analysis and suggested solutions, and keep the overlay hidden from screen
sharing and most screen recorders.

> **Branding vs. on-disk artifacts.** This project is called **AI Overlay**,
> but the produced binaries, window title, Dock/taskbar entry, and Windows
> AppUserModelID are intentionally generic (`System UI Helper`, empty window
> title, `com.microsoft.windows.shell.helper`). This is by design — those
> surfaces are what screen-share / process-enumeration / integrity tools
> read. Do **not** rename them back to "AI Overlay"; doing so will weaken
> stealth. See [Maximizing stealth](#maximizing-stealth-in-screen-sharing-apps)
> below.

## Invisibility Compatibility

The application is invisible to:

- Zoom versions below 6.1.6 (inclusive)
- All browser-based screen recording software
- All versions of Discord
- Mac OS _screenshot_ functionality (Command + Shift + 3/4)

Note: The application is **NOT** invisible to:

- Zoom versions 6.1.6 and above
  - https://zoom.en.uptodown.com/mac/versions (link to downgrade Zoom if needed)
- Mac OS native screen _recording_ (Command + Shift + 5)

### Maximizing stealth in screen-sharing apps

The overlay relies on the OS-level capture-exclusion flag
(`NSWindowSharingNone` on macOS, `WDA_EXCLUDEFROMCAPTURE` on Windows 10
build 2004+). This is honored by the modern capture paths used by Zoom,
Microsoft Teams, Google Meet (desktop and browser), and any app that
captures via `getDisplayMedia` on Chromium 100+. To get the strongest
results:

- **Zoom (desktop):** in Zoom → Settings → Share Screen, prefer the option
  that uses the windowing-system capture method ("Use the new capture
  method"/"Capture with the windowing system"). Older Zoom builds fall
  back to `BitBlt`/DXGI duplication, which bypasses the OS exclude flag.
  Update Zoom to the latest version, or downgrade to ≤ 6.1.5 if needed
  (see link above).
- **Microsoft Teams / Google Meet:** modern releases use Windows Graphics
  Capture (Windows) or ScreenCaptureKit (macOS 12.3+) and respect the
  exclude flag automatically — no user action required.
- **Windows:** ensure you are on Windows 10 build 2004 (May 2020 Update)
  or later. Earlier builds do not support `WDA_EXCLUDEFROMCAPTURE`.
- **macOS:** macOS 10.15 Catalina or later is required for reliable
  exclusion under ScreenCaptureKit/CGDisplayStream.
- **Linux / Wayland:** the PipeWire screencast portal does not currently
  expose a per-window exclusion API. The overlay **cannot be reliably
  hidden** from screen-sharing on Linux/Wayland today. Use the panic-hide
  shortcut (below) before sharing.

### Limitations that cannot be solved from inside the app

These bypass every OS exclusion flag and are unsolvable from an Electron
app — defend against them by hiding the window before sharing:

- OBS, ffmpeg, or any third-party screen recorder that captures via raw
  desktop duplication.
- Hardware HDMI capture cards / external recorders.
- A phone or camera physically pointed at your screen.

## Features

- 🎯 99% Invisibility: Undetectable window that bypasses most screen capture methods
- 📸 Smart Screenshot Capture: Capture both question text and code separately for better analysis
- 🤖 AI-Powered Analysis: Automatically extracts and analyzes problems from screenshots
- 💡 Solution Generation: Get detailed explanations and solutions
- 🔧 Real-time Debugging: Debug your code with AI assistance
- 🎨 Window Management: Freely move and position the window anywhere on screen

## Global Commands

The application uses unidentifiable global keyboard shortcuts that won't be detected by browsers or other applications:

- Toggle Window Visibility: [Control or Cmd + b]
- Panic Hide (hard hide for capture paths the OS exclude flag can't defeat): [Control or Cmd + \\]
- Move Window: [Control or Cmd + arrows]
- Take Screenshot: [Control or Cmd + H]
- Process Screenshots: [Control or Cmd + Enter]
- Reset View: [Control or Cmd + R]
- Quit: [Control or Cmd + Q]

## Usage

1. **Initial Setup**

   - Launch the invisible window
   - Provide your OpenAI API key via the `OPENAI_API_KEY` environment variable (in `.env`)

2. **Capturing Problem**

   - Use global shortcut [Control or Cmd + H] to take screenshots
   - Screenshots are automatically added to the queue of up to 2.

3. **Processing**

   - AI analyzes the screenshots to extract:
     - Problem requirements
     - Code context
   - System generates optimal solution strategy

4. **Solution & Debugging**

   - View generated solutions
   - Use debugging feature to:
     - Test different approaches
     - Fix errors in your code
     - Get line-by-line explanations
   - Toggle between solutions and queue views

5. **Window Management**
   - Move window freely using global shortcut
   - Toggle visibility as needed
   - Window remains invisible to specified applications
   - Reset view using Command + R

## Prerequisites

- Node.js (v16 or higher)
- npm or bun package manager
- An OpenAI API key (set as `OPENAI_API_KEY` in a `.env` file)
- Screen Recording Permission for Terminal/IDE
  - On macOS:
    1. Go to System Preferences > Security & Privacy > Privacy > Screen Recording
    2. Ensure that AI Overlay (which appears on disk as **System UI Helper** — see the branding note above) has screen recording permission enabled
    3. Restart the app after enabling permissions
  - On Windows:
    - No additional permissions needed
  - On Linux:
    - May require `xhost` access depending on your distribution

## Installation

1. Clone the repository:

```bash
git clone https://github.com/AndreTeixeira1998/AI-overlay.git
cd AI-overlay
```

2. Install dependencies:

```bash
npm install
# or if using bun
bun install
```

## Running Locally

1. Start the development server:

```bash
npm run dev
```

This will:

- Start the Vite development server
- Launch the Electron application
- Enable hot-reloading for development

## Tech Stack

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- Radix UI Components
- OpenAI API

## Configuration

Create a `.env` file at the project root with at least:

```
OPENAI_API_KEY=sk-...
# Optional overrides:
# OPENAI_API_URL=https://api.openai.com/v1/chat/completions
# OPENAI_MODEL=gpt-4-vision-preview
```

## Building

After `npm run build`, notarize and staple the produced DMGs. The on-disk
artifact name is intentionally generic (`System-UI-Helper-*.dmg`) — keep
it that way for stealth:

```
node scripts/manual-notarize.js "release/System-UI-Helper-x64.dmg" && xcrun stapler staple "release/System-UI-Helper-x64.dmg"
node scripts/manual-notarize.js "release/System-UI-Helper-arm64.dmg" && xcrun stapler staple "release/System-UI-Helper-arm64.dmg"
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
