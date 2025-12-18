import { HardDrive, Github, Database, BrainCircuit, Globe } from 'lucide-react';

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  author: string;
  icon: any;
  install: {
    type: 'stdio' | 'sse';
    command?: string;
    args?: string[];
    url?: string;
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
      type: 'text' | 'path';
      required?: boolean;
    }>;
  };
}

export const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Give LLMs secure access to read and write files in specific directories on your computer.',
    author: 'Model Context Protocol',
    icon: HardDrive,
    install: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
    },
    variables: {
      args: [
        {
          label: 'Allowed Directory',
          placeholder: '/Users/username/Desktop',
          description: 'The absolute path to the directory you want to expose.',
          type: 'path',
          required: true
        }
      ]
    }
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Allow LLMs to search repositories, read code, and manage issues/PRs on GitHub.',
    author: 'Model Context Protocol',
    icon: Github,
    install: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
    },
    variables: {
      env: [
        {
          key: 'GITHUB_PERSONAL_ACCESS_TOKEN',
          label: 'Personal Access Token',
          placeholder: 'github_pat_...',
          description: 'A GitHub PAT with repo permissions.',
          required: true
        }
      ]
    }
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Query and analyze SQLite databases. Great for data analysis tasks.',
    author: 'Model Context Protocol',
    icon: Database,
    install: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite'],
    },
    variables: {
      args: [
        {
          label: 'Database File Path',
          placeholder: '/path/to/database.db',
          description: 'Absolute path to an existing SQLite file.',
          type: 'path',
          required: true
        }
      ]
    }
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'A knowledge graph based memory server that persists insights across sessions.',
    author: 'Model Context Protocol',
    icon: BrainCircuit,
    install: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    }
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Allow LLMs to fetch and extract content from websites for research.',
    author: 'Model Context Protocol',
    icon: Globe,
    install: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
    }
  }
];