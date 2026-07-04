type ToolObservation = {
  ok: boolean;
  tool: string;
  summary: string;
  data?: unknown;
  truncated?: boolean;
  hint?: string;
  code?: string;
};

function formatObservation(obs: ToolObservation): string {
  return JSON.stringify(obs, null, 2);
}

export function errorObservation(
  tool: string,
  code: string,
  message: string,
  hint?: string,
): string {
  return formatObservation({
    ok: false,
    tool,
    summary: message,
    code,
    hint,
  });
}
