✍️ HandwritingDemo

A cross-platform, handwriting-focused note-taking app built with React Native, TensorFlow.js, and Yjs — featuring real-time collaboration, on-device handwriting recognition, and offline-first sync.

🚀 Overview

HandwritingDemo is a technical demonstration of how modern React Native apps can deliver native-quality drawing performance, personalized AI handwriting recognition, and distributed real-time collaboration — all without third-party cloud services.

Built from scratch with Expo, Skia, and TensorFlow.js, this project explores:

low-latency canvas rendering,

on-device machine learning,

CRDT-based synchronization,

and deep performance profiling.

It’s designed to show product thinking, system-level optimization, and debugging ability rather than just UI polish.

🧩 Core Features
1️⃣ Low-Latency Handwriting Canvas

Built using @shopify/react-native-skia
.

Supports pressure-sensitive strokes, undo/redo, and persistent local storage.

Optimized render loop with frame-diff detection for battery efficiency.

2️⃣ Personalized Handwriting Recognition (On-Device ML)

Powered by @tensorflow/tfjs-react-native
.

Recognizes handwritten input offline — no cloud calls.

Incrementally adapts to user handwriting style with local fine-tuning.

3️⃣ Real-Time Collaboration (CRDTs via Yjs)

Multi-device note editing using yjs
 and y-websocket
.

Fully offline-capable — changes sync once connection restores.

Handles merge conflicts and simultaneous edits gracefully.

4️⃣ Offline-First Architecture

Notes, ML weights, and metadata cached locally with AsyncStorage.

Auto-syncs when reconnected without user intervention.

5️⃣ Advanced Debugging & Profiling

Performance profiled using Flipper, Android Studio Profiler, and Instruments.

Frame-rate, memory, and CPU usage benchmarked before/after optimizations.

Includes annotated UX screenshots and profiling artifacts in /profiling.

🧠 Tech Stack
Layer	Tools
Framework	React Native (Expo SDK 54)
Rendering Engine	Skia
Machine Learning	TensorFlow.js
Collaboration	Yjs + WebSocket
State Management	Hooks + AsyncStorage
Performance Tools	Flipper, Hermes Profiling, Skia Debug View
🧰 Folder Structure
src/
 ├── screens/           # Canvas, Recognition, Collaboration
 ├── components/        # Toolbar, StrokePreview, Loader
 ├── services/          # recognitionService, syncService, storageService
 ├── hooks/             # useCanvasEngine, useNetworkStatus
 ├── utils/             # constants, logger, math helpers
 ├── styles/            # shared colors, spacing
 └── assets/            # icons, fonts, model files

🧩 Goals of the Project

Demonstrate system design, not just UI.

Showcase debugging and profiling skills.

Prove fluency in hybrid architecture (JS ↔ Native bridge).

Deliver a working offline+collab demo in 48 hours.

📈 Deliverables

Working Expo demo (Android/iOS)

Technical write-up with:

Performance metrics (FPS, memory, latency)

Edge-case handling

Architecture breakdown

Annotated UX screenshots

Profiling artifacts

List of references and research sources

🧑‍💻 Author

Ankan Ganguly
React Native Developer | Product Engineer | AI Enthusiast

🪶 License

MIT © 2025 Ankan Ganguly
