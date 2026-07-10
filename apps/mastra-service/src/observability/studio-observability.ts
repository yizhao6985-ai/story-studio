import {
  Observability,
  MastraStorageExporter,
  SensitiveDataFilter,
} from "@mastra/observability";

let studioObservability: Observability | undefined;

export function getStudioObservability(): Observability {
  if (!studioObservability) {
    studioObservability = new Observability({
      configs: {
        default: {
          serviceName: "story-studio",
          exporters: [new MastraStorageExporter()],
          spanOutputProcessors: [new SensitiveDataFilter()],
          logging: {
            enabled: true,
            level: "info",
          },
        },
      },
    });
  }
  return studioObservability;
}
