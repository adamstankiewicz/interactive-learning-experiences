import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * Thin wrapper over the Learning Commons Knowledge Graph MCP server.
 *
 * The server exposes three code-first tools. There is deliberately no
 * topic search — resolving a free-text topic to standard codes is the
 * model's job (see `proposeStandardCodes`); this client is the authority
 * that confirms or rejects what the model proposed.
 */

const MCP_URL = process.env.LEARNING_COMMONS_MCP_URL ?? 'https://mcp.learningcommons.org/mcp';

export type StandardStatement = {
  statementCode: string;
  caseIdentifierUUID: string;
  description: string;
  jurisdiction: string;
  gradeLevels: string[];
  academicSubject: string;
};

export type LearningComponent = {
  identifier: string;
  description: string;
};

export type ProgressionStandard = {
  statementCode: string;
  caseIdentifierUUID: string;
  description: string;
  jurisdiction: string;
  gradeLevel: string;
  academicSubject: string;
  before: string[];
  after: string[];
};

/** The server returns `isError: true` for "not found", which is a normal outcome here. */
class ToolMiss extends Error {}

/**
 * One connection, reused across calls. Every call used to build a transport,
 * run the MCP `initialize` handshake, then close again — measured at ~565ms
 * per call against the live graph, and a pathway makes about six of them, so
 * the handshake was most of that time and none of it was useful work.
 */
let connection: Promise<Client> | null = null;

function connect(): Promise<Client> {
  const apiKey = process.env.LEARNING_COMMONS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error('LEARNING_COMMONS_API_KEY is not set. Copy .env.example to .env.local.'),
    );
  }

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
  const client = new Client({ name: 'interactive-student-experiences', version: '0.1.0' });

  return client.connect(transport).then(() => client);
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  connection ??= connect();

  let client: Client;
  try {
    client = await connection;
  } catch (error) {
    connection = null; // never cache a failed handshake
    throw error;
  }

  try {
    return await fn(client);
  } catch (error) {
    // A ToolMiss is a normal "not found" answer over a healthy connection.
    // Anything else may mean the transport is gone, so drop the cached
    // connection and let the next call reconnect. The client is not closed
    // here: concurrent callers may still be holding it.
    if (!(error instanceof ToolMiss)) connection = null;
    throw error;
  }
}

async function callTool<T>(client: Client, name: string, args: Record<string, unknown>): Promise<T> {
  const result = await client.callTool({ name, arguments: args });

  if (result.isError) {
    const content = result.content as Array<{ type: string; text?: string }> | undefined;
    throw new ToolMiss(content?.[0]?.text ?? `${name} returned an error`);
  }
  if (!result.structuredContent) {
    throw new Error(`${name} returned no structured content`);
  }
  return result.structuredContent as T;
}

/**
 * Resolve a standard code (e.g. "3.NF.A.1", "RI.5.2") to its authoritative statement.
 * Returns null when the code does not exist in the graph — the signal that the
 * model hallucinated it.
 */
export async function findStandardStatement(
  statementCode: string,
  jurisdiction?: string,
): Promise<StandardStatement | null> {
  return withClient(async (client) => {
    try {
      return await callTool<StandardStatement>(client, 'find_standard_statement', {
        statementCode,
        ...(jurisdiction ? { jurisdiction } : {}),
      });
    } catch (error) {
      if (error instanceof ToolMiss) return null;
      throw error;
    }
  });
}

/**
 * Fine-grained teachable skills for a standard. CCSS-M only — returns [] for
 * ELA and other frameworks rather than throwing, since a missing decomposition
 * is a normal state we degrade around.
 */
export async function findLearningComponents(
  caseIdentifierUUID: string,
): Promise<LearningComponent[]> {
  return withClient(async (client) => {
    try {
      const result = await callTool<{ learning_components: LearningComponent[] }>(
        client,
        'find_learning_components_from_standard',
        { caseIdentifierUUID },
      );
      return result.learning_components ?? [];
    } catch (error) {
      if (error instanceof ToolMiss) return [];
      throw error;
    }
  });
}

/**
 * Prerequisite (backward) or extension (forward) standards from the SAP
 * Coherence Map. CCSS-M only; returns [] where no crosswalk exists.
 */
export async function findProgression(
  caseIdentifierUUID: string,
  direction: 'backward' | 'forward',
): Promise<ProgressionStandard[]> {
  return withClient(async (client) => {
    try {
      const result = await callTool<{ standards: ProgressionStandard[] }>(
        client,
        'find_standards_progression_from_standard',
        { caseIdentifierUUID, direction },
      );
      return result.standards ?? [];
    } catch (error) {
      if (error instanceof ToolMiss) return [];
      throw error;
    }
  });
}
