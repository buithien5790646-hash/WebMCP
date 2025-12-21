import { HardDrive, Github, Globe, Play, Clock } from "lucide-react";

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  author: string;
  icon: any;
  install: {
    type: "stdio" | "sse" | "http";
    command?: string;
    args?: string[];
    url?: string;
    headers?: Record<string, string>;
  };
  variables?: {
    env?: Array<{
      key: string;
      label: string;
      placeholder?: string;
      description?: string;
      required?: boolean;
    }>;
    args?: Array<{
      label: string;
      placeholder?: string;
      description?: string;
      type: "text" | "path";
      required?: boolean;
    }>;
  };
}

export const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: "filesystem",
    name: "Filesystem",
    description:
      "Give LLMs secure access to read and write files in specific directories on your computer.",
    author: "Model Context Protocol",
    icon: HardDrive,
    install: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
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
    icon: Github,
    install: {
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
      headers: {
        Authorization: "Bearer ${input:GITHUB_MCP_PAT}",
      },
    },
    variables: {
      env: [
        {
          key: "GITHUB_MCP_PAT",
          label: "GitHub MCP PAT",
          placeholder: "ghp_...",
          description: "A GitHub Personal Access Token for GitHub MCP access.",
          required: true,
        },
      ],
    },
  },
  {
    id: "playwright",
    name: "Playwright",
    description:
      "Allow LLMs to interact with websites, take screenshots, and extract data using Playwright.",
    author: "Microsoft",
    icon: Play,
    install: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@playwright/mcp@latest"],
    },
  },
  {
    id: "fetch",
    name: "Fetch",
    description: "Allow LLMs to fetch and extract content from websites for research using UVX.",
    author: "Model Context Protocol",
    icon: Globe,
    install: {
      type: "stdio",
      command: "uvx",
      args: ["mcp-server-fetch"],
    },
  },
  {
    id: "time",
    name: "Time",
    description: "Get current time, convert time zones, and handle date/time operations.",
    author: "Model Context Protocol",
    icon: Clock,
    install: {
      type: "stdio",
      command: "uvx",
      args: ["mcp-server-time"],
    },
  },
];
