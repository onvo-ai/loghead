# Loghead

Loghead is a smart log aggregation tool and MCP server. It collects logs from various sources like your terminal, docker containers, or your browser, stores them in a database, and makes them searchable for AI assistants (like Claude, Cursor, or Windsurf).

Think of it as a "long-term memory" for your development logs that your AI coding agent can read.

## Prerequisites

Before you start, make sure you have:

1.  **Node.js** (v18 or higher).
2.  **Ollama**: [Download here](https://ollama.com/download).
    - Ensure it is running (`ollama serve`) and accessible at `http://localhost:11434`.
    - Pull the embedding model: `ollama pull qwen3-embedding:0.6b` (or similar).

## Setup Guide

### 1. Start the Core Server

The **Core Server** (`@loghead/core`) manages the database, API, and web interface. You must have this running in a background terminal for Loghead to work.

```bash
npx @loghead/core
# OR
npx @loghead/core start
```

This command will:

- Initialize the local SQLite database (`loggerhead.db`).
- Start the REST API server on port `4567`.
- Print a **Loghead Token**.
- Launch the Terminal UI for viewing logs.

### 2. Connect Your AI Tool (MCP Server)

The **MCP Server** (`@loghead/mcp`) is a separate lightweight bridge that allows your AI assistant to talk to the Core Server. You configure your AI tool to run this MCP server automatically.

Use the **Loghead Token** printed in step 1.

#### Claude Desktop

Edit your `claude_desktop_config.json` (usually in `~/Library/Application Support/Claude/` on macOS):

```json
{
  "mcpServers": {
    "loghead": {
      "command": "npx",
      "args": ["-y", "@loghead/mcp"],
      "env": {
        "LOGHEAD_API_URL": "http://localhost:4567",
        "LOGHEAD_TOKEN": "<YOUR_MCP_TOKEN>"
      }
    }
  }
}
```

#### Windsurf / Cascade

Add the MCP server in your Windsurf configuration:

```json
{
  "mcpServers": {
    "loghead": {
      "command": "npx",
      "args": ["-y", "@loghead/mcp"],
      "env": {
        "LOGHEAD_API_URL": "http://localhost:4567",
        "LOGHEAD_TOKEN": "<YOUR_MCP_TOKEN>"
      }
    }
  }
}
```

#### Cursor

Go to **Settings > MCP** and add a new server:

- **Name**: `loghead`
- **Type**: `stdio`
- **Command**: `npx -y @loghead/mcp`
- **Environment Variables**:
  - `LOGHEAD_API_URL`: `http://localhost:4567`
  - `LOGHEAD_TOKEN`: `<YOUR_MCP_TOKEN>`

#### VS Code (MCP Extension)

To use Loghead as an MCP server in VS Code, add the following configuration to your `mcp.json` (usually found in your user settings directory):

```jsonc
{
  "servers": {
    "loghead": {
      "command": "npx",
      "args": [
        "-y",
        "@loghead/mcp"
      ],
      "env": {
        "LOGHEAD_API_URL": "http://localhost:4567",
        "LOGHEAD_TOKEN": "<YOUR_MCP_TOKEN>"
      }
    }
  }
}
```

Replace `<YOUR_MCP_TOKEN>` with the token printed by the Loghead server.

This enables VS Code to connect to Loghead via MCP for log search and retrieval.
### 3. Create a Project

You can manage projects via the CLI (in a separate terminal):

```bash
npx @loghead/core projects add "My Awesome App"
# Copy the Project ID returned
```

### 4. Add a Log Stream


Create a stream to pipe logs into.

**For Terminal Output:**

```bash
npx @loghead/core streams add terminal --project <PROJECT_ID> --name "Build Logs"
# Copy the Stream Token returned
```

**For Docker Containers:**

```bash
npx @loghead/core streams add docker --project <PROJECT_ID> --name "Backend API" --container my-api-container
# Copy the Stream Token returned
```

### 5. Ingest Logs

Now, feed logs into the stream using the ingestor tools.
**Add directly to project:**

```bash
# Add to package.json's script of your project
dev:log": "<commad-to-start-your-project> | npx @loghead/terminal --token <STREAM-TOKEN>
#Add the token
```


**Terminal Pipe:**

```bash
# Pipe any command into loghead-terminal
npm run build | npx @loghead/terminal --token <STREAM_TOKEN>
```

**Docker Logs:**

```bash
# Attach to a running container
npx @loghead/docker --token <STREAM_TOKEN> --container my-api-container
```

**OpenTelemetry (OTLP):**

You can point any OpenTelemetry exporter to Loghead.

```javascript
// Example: Node.js with @opentelemetry/exporter-logs-otlp-http
const { OTLPLogExporter } = require("@opentelemetry/exporter-logs-otlp-http");

const exporter = new OTLPLogExporter({
  url: "http://localhost:4567/v1/logs",
  headers: {
    Authorization: "Bearer <STREAM_TOKEN>",
  },
});
```

## How to Use with AI

Once connected, you can ask your AI assistant questions about your logs:

- "What errors appeared in the build logs recently?"
- "Find any database connection timeouts in the backend logs."
- "Why did the application crash?"

## CLI Commands Reference

The `@loghead/core` package provides several commands to manage your log infrastructure.

### General

- **Start Server & UI**:
  ```bash
  npx @loghead/core
  ```

### Projects

- **List Projects**:
  ```bash
  npx @loghead/core projects list
  ```
- **Add Project**:
  ```bash
  npx @loghead/core projects add "My Project Name"
  ```
- **Delete Project**:
  ```bash
  npx @loghead/core projects delete <PROJECT_ID>
  ```

### Streams

- **List Streams**:
  ```bash
  npx @loghead/core streams list --project <PROJECT_ID>
  ```
- **Add Stream**:

  ```bash
  # Basic
  npx @loghead/core streams add <TYPE> <NAME> --project <PROJECT_ID>

  # Examples
  npx @loghead/core streams add terminal "My Terminal" --project <PROJECT_ID>
  npx @loghead/core streams add docker "My Container" --project <PROJECT_ID> --container <CONTAINER_NAME>
  npx @loghead/core streams add opentelemetry "My OTLP Stream" --project <PROJECT_ID>
  ```

- **Get Stream Token**:
  ```bash
  npx @loghead/core streams token <STREAM_ID>
  ```
- **Delete Stream**:
  ```bash
  npx @loghead/core streams delete <STREAM_ID>
  ```

## Sample Calculator App

We provide a unified **Calculator App** in `sample_apps/calculator_app` that combines a Backend API, Frontend UI, and CLI capabilities to help you test all of Loghead's features in one place.

This app runs an Express.js server that performs calculations and logs them. It includes a web interface and can be containerized with Docker.

#### Scenario 1: Testing Terminal Ingest (CLI)

1.  **Create a Stream:**

    ```bash
    npx @loghead/core projects add "Calculator Project"
    # Copy Project ID
    npx @loghead/core streams add terminal --project <PROJECT_ID> --name "Terminal Logs"
    # Copy Stream Token
    ```

2.  **Run & Pipe Logs:**
    Run the server locally and pipe its output to Loghead.

    ```bash
    cd sample_apps/calculator_app
    npm install
    npm start | npx @loghead/terminal --token <STREAM_TOKEN>
    ```

3.  **Generate Traffic:**
    Open `http://localhost:3000` and perform calculations. The logs in your terminal will be sent to Loghead.

4.  **Ask AI:** "What calculations were performed recently?"

#### Scenario 2: Testing Docker Ingest

1.  **Create a Stream:**

    ```bash
    npx @loghead/core streams add docker --project <PROJECT_ID> --name "Docker Container" --container loghead-calc
    # Copy Stream Token
    ```

2.  **Run in Docker:**
    Build and run the app as a container named `loghead-calc`.

    ```bash
    cd sample_apps/calculator_app
    docker build -t loghead-calc .
    docker run --name loghead-calc -p 3000:3000 -d loghead-calc
    ```

3.  **Attach Loghead:**

    ```bash
    npx @loghead/docker --token <STREAM_TOKEN> --container loghead-calc
    ```

4.  **Generate Traffic & Ask AI:**
    Perform actions in the browser. Ask: "Did any errors occur in the docker container?" (Try dividing by zero or simulating a crash).

#### Scenario 3: Testing Browser Ingest (Chrome Extension)

1.  **Create a Stream:**

    ```bash
    npx @loghead/core streams add browser --project <PROJECT_ID> --name "Frontend Logs"
    # Copy Stream Token
    ```

2.  **Configure Extension:**
    Install the Loghead Chrome Extension (if available) and set the Stream Token.

3.  **Use the App:**
    Open `http://localhost:3000` (or the Docker version). The app logs actions to `console.log`, which the extension will capture.

4.  **Ask AI:** "What interactions did the user have in the browser?"

## Development

To build from source:

1. Clone the repo.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build all packages:
   ```bash
   npm run build
   ```

## API Reference

The `@loghead/core` server exposes a REST API on port `4567` (by default).

### Projects

- **List Projects**
  - `GET /api/projects`
- **Create Project**
  - `POST /api/projects`
  - Body: `{ "name": "string" }`
- **Delete Project**
  - `DELETE /api/projects/:id`

### Streams

- **List Streams**
  - `GET /api/streams?projectId=<PROJECT_ID>`
- **Create Stream**
  - `POST /api/streams/create`
  - Body: `{ "projectId": "string", "type": "string", "name": "string", "config": {} }`
- **Delete Stream**
  - `DELETE /api/streams/:id`

### Logs

- **Get Logs**

  - `GET /api/logs`
  - Query Params:
    - `streamId`: (Required) The Stream ID.
    - `q`: (Optional) Semantic search query.
    - `page`: (Optional) Page number (default 1).
    - `pageSize`: (Optional) Logs per page (default 100, max 1000).

- **Ingest Logs**

  - `POST /api/ingest`
  - Headers: `Authorization: Bearer <STREAM_TOKEN>`
  - Body:
    ```json
    {
      "streamId": "string",
      "logs": [
        {
          "content": "log message",
          "metadata": { "level": "info" }
        }
      ]
    }
    ```
    _Note: `logs` can also be a single string or object._

- **Ingest OTLP Logs**
  - `POST /v1/logs`
  - Headers: `Authorization: Bearer <STREAM_TOKEN>`
  - Body: Standard OTLP JSON payload.
