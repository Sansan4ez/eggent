export type PipelineStepStatus = "queued" | "running" | "completed" | "failed" | "skipped";
export type PipelineRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface PipelineDefinitionFile {
  version: number;
  pipelines: RawPipelineDefinition[];
}

export interface RawPipelineDefinition {
  id?: string;
  name: string;
  description?: string;
  steps: RawPipelineStepDefinition[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RawPipelineStepDefinition {
  id?: string;
  name: string;
  /** Eggent project id to run as this pi agent config. Pipelines are project sequences. */
  projectId?: string;
  /** Optional per-step handoff instructions in addition to the project's own context. */
  instructions?: string;
  cwd?: string;
  tools?: string[];
  skills?: string[];
  output?: {
    artifactName?: string;
    format?: "text" | "markdown" | "json";
    required?: boolean;
  };
  approvalRequired?: boolean;
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description?: string;
  steps: PipelineStepDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStepDefinition {
  id: string;
  name: string;
  /** Eggent project id to run as this pi agent config. Pipelines are project sequences. */
  projectId?: string;
  /** Optional per-step handoff instructions in addition to the project's own context. */
  instructions: string;
  cwd?: string;
  tools?: string[];
  skills?: string[];
  output?: {
    artifactName?: string;
    format?: "text" | "markdown" | "json";
    required?: boolean;
  };
  approvalRequired?: boolean;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  chatId?: string;
  projectId?: string;
  status: PipelineRunStatus;
  input: string;
  artifactsDir: string;
  steps: PipelineStepRun[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStepRun {
  id: string;
  stepId: string;
  name: string;
  projectId?: string;
  status: PipelineStepStatus;
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  error?: string;
  artifacts?: string[];
}

export interface StartPipelineRunOptions {
  pipelineId: string;
  input: string;
  chatId?: string;
  projectId?: string;
  cwd?: string;
}
