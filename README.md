# rigidX

rigidX is an anonymous chat platform built around simple, low-friction conversations. It provides a minimal interface for starting conversations without requiring users to expose unnecessary personal information.

The current implementation combines a React frontend, an Express backend, and Ollama-powered AI conversations. The architecture is designed to keep the frontend, backend, and AI inference layers separate so they can evolve independently.

## Overview

rigidX focuses on a clean and distraction-free chat experience.

The current application provides:

- Anonymous chat interface
- AI-powered conversations
- Responsive dark interface
- Multiple visual themes
- Conversation history during a session
- Chat skip and leave controls
- Keyboard shortcuts
- Animated transitions
- Separate frontend and backend architecture
- Local AI inference through Ollama

The project is currently under active development, with real-time user matchmaking, WebSocket communication, moderation, and production infrastructure planned for future versions.

---

## Features

### Anonymous Chat

- Start a conversation without creating a traditional profile
- Minimal chat interface
- Conversation history maintained during the active session
- Skip the current conversation
- Leave the current conversation
- Loading and transition states

### AI Conversations

rigidX currently uses Ollama for local AI inference.

The current model is:

```text
qwen3:8b