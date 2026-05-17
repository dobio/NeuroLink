export type JsonSchema = Record<string, unknown>;

export interface Tool {
  name: string;
  description: string;
  inputSchema?: JsonSchema;
  execute(input: unknown): Promise<string>;
}
