import { MCPService } from './types';

export const EXAMPLE_SERVICES: MCPService[] = [
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Give LLMs secure access to read and write files in specific directories on your computer.",
    author: "Model Context Protocol",
    icon: "HardDrive",
    type: "node",
    metadata: {
      npmPackage: "@modelcontextprotocol/server-filesystem",
    },
    variables: {
      args: [
        {
          label: "Allowed Directory",
          placeholder: "/Users/username/Desktop",
          description: "The absolute path to the directory you want to expose.",
          type: "path",
          required: true,
        },
      ],
    },
  },
  {
    id: "github",
    name: "GitHub",
    description: "Allow LLMs to search repositories, read code, and manage issues/PRs on GitHub.",
    author: "Model Context Protocol",
    icon: "Github",
    type: "node",
    metadata: {
      npmPackage: "@modelcontextprotocol/server-github",
    },
    variables: {
      env: [
        {
          key: "GITHUB_PERSONAL_ACCESS_TOKEN",
          label: "GitHub PAT",
          placeholder: "ghp_...",
          description: "A GitHub Personal Access Token.",
          required: true,
        },
      ],
    },
  },
  {
    id: "playwright",
    name: "Playwright",
    description: "Allow LLMs to interact with websites, take screenshots, and extract data using Playwright.",
    author: "Microsoft",
    icon: "Play",
    type: "node",
    metadata: {
      npmPackage: "@playwright/mcp",
    },
  },
  {
    id: "fetch",
    name: "Fetch",
    description: "Allow LLMs to fetch and extract content from websites for research.",
    author: "Model Context Protocol",
    icon: "Globe",
    type: "python",
    metadata: {
      pythonPackage: "mcp-server-fetch",
    },
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Read-only access to PostgreSQL databases.",
    author: "Model Context Protocol",
    icon: "Database",
    type: "docker",
    metadata: {
      dockerImage: "mcp/postgres",
    },
    variables: {
      env: [
        {
          key: "DATABASE_URL",
          label: "Connection String",
          placeholder: "postgresql://user:pass@localhost:5432/db",
          required: true,
        },
      ],
    },
  },
];
