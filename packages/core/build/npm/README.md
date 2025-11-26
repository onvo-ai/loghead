# Loghead

Loghead is a smart log aggregation tool and MCP server. It collects logs from various sources like your Terminal, Docker containers, or Browser, stores them in a database, and makes them searchable for AI assistants (like Claude, Cursor, or Windsurf).

Think of it as a "long-term memory" for your development logs that your AI coding agent can read.

## Prerequisites

Before you start, make sure you have:

1.  **Local Ollama**: [Download here](https://ollama.com/download).
    - Ensure it is running (`ollama serve`) and accessible at `http://localhost:11434`.
    - Pull the embedding model: `ollama pull qwen3-embedding:0.6b` (or similar).
2.  **The Loghead Executable**: You can download the latest release or build it yourself (see below).

_(Note: [Deno](https://docs.deno.com/runtime/fundamentals/installation/) is only required if you want to build the project from source.)_

## Setup Guide

Follow these steps to get Loghead running on your machine.

### 1. Install the Tool

Download the `loghead` binary from the releases page and move it to a directory in your PATH (e.g., `/usr/local/bin`).

**Verify installation:**

```bash
loghead --help
```

### 2. Initialize the Database

Run this command to set up the database tables (SQLite):

```bash
loghead init
```

## How to Use

### 1. Start the MCP Server

This is the bridge that allows your AI editor to talk to Loghead.

```bash
loghead start
```

You will see instructions on how to connect your specific AI tool (Claude, Cursor, VS Code, Windsurf) in the output.

**Example for Claude Desktop Config:**

```json
"loghead": {
  "command": "loghead",
  "args": ["stdio"]
}
```

### 2. Create a Project

Organize your logs into projects.

```bash
loghead projects add "My Awesome App"
```

### 3. Add a Log Stream

A "stream" is a specific source of logs (e.g., your terminal output, or a specific Docker container). You need the Project ID from the previous step (use `loghead projects list` to see it).

**Example: Creating a stream for Docker logs**

```bash
loghead streams add docker --project <PROJECT_ID> --name "Backend API" --container my-api-container
```

**Example: Creating a generic terminal stream**

```bash
loghead streams add terminal --project <PROJECT_ID> --name "Build Logs"
```

### 4. Ingest Logs

Now, feed logs into the stream you created. You need the Stream ID (use `loghead streams list --project <PROJECT_ID>` to find it).

**From Standard Input (Manual):**
You can pipe any command's output into Loghead:

```bash
echo "Something happened" | loghead ingest --stream <STREAM_ID>
```

Or run a script and capture its output:

```bash
deno run my_script.ts | loghead ingest --stream <STREAM_ID>
```

### 5. Query Logs (The AI Part)

Your AI assistant can now "call" tools to search these logs. It can ask things like:

- "Show me the recent errors in the Backend API stream."
- "Find logs related to 'database connection failure'."

You can also check logs manually:

```bash
npx loghead log list --stream <STREAM_ID>
```

## Building from Source

If you want to build the `loghead` executable yourself (e.g., to contribute or modify it):

1.  Install **Deno** (see Prerequisites).
2.  Compile the tool into a single executable file in the `build` directory:

```bash
mkdir -p build
deno task build
```

3.  This will generate the `loghead` binary in your `packages/core/build/` directory.

## Architecture Overview

- **Language:** TypeScript (Deno)
- **Database:** SQLite with `sqlite-vec` for storing log embeddings.
- **AI:** Local Ollama running `mxbai-embed-large` (or similar) to understand the semantic meaning of logs.
- **Protocol:** Model Context Protocol (MCP) for integration with AI agents.

## Sample Apps

We provide sample applications in the `sample_apps` directory to help you test Loghead's capabilities.

### 1. CLI Calculator

A simple script that generates random logs and simulates a crash.

**How to test:**

1. Create a project and a stream:
   ```bash
   npx loghead projects add "Calculator App"
   # Copy Project ID
   npx loghead streams add terminal --project <PROJECT_ID> --name "CLI Output"
   # Copy Stream ID
   ```
2. Run the calculator and pipe logs to Loghead:
   ```bash
   deno run sample_apps/cli_calculator/main.ts | npx @loghead/terminal --token <TOKEN>
   ```
3. Ask your AI Agent: "Why did the calculator app crash?"

### 2. Docker App

A Python worker process running in Docker that logs tasks and simulates occasional warnings.

**How to test:**

1. Create a stream for Docker:
   ```bash
   # Use existing Project ID
   npx loghead streams add docker --project <PROJECT_ID> --name "Worker Node" --container worker-app
   # Note the container name "worker-app" matches the --name in docker run below
   # Copy Stream ID
   ```
2. Build and run the container:
   ```bash
   cd sample_apps/docker_app
   docker build -t docker-app .
   docker run --name worker-app -d docker-app
   ```
3. Attach Loghead to the container logs:
   ```bash
   npx @loghead/docker --token <TOKEN> --container worker-app
   ```
4. Ask your AI Agent: "What tasks is the worker processing?" or "Are there any performance warnings?"

### 3. Browser App

A simple HTML/JS Calculator that logs actions to the browser console.

**How to test:**

1. Open `sample_apps/browser_app/index.html` in your browser.
2. Ensure the Loghead Chrome Extension is installed and connected to a browser stream.
3. Open Developer Tools (Console).
4. Perform some calculations (try dividing by zero!).
5. Logs will automatically appear in your Loghead dashboard.
