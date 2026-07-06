import { ensureArtifactsDir, listArtifacts } from "@/lib/pipelines/artifacts";
import { buildPipelineStepPrompt } from "@/lib/pipelines/prompt-builder";
import {
  getPipelineDefinition,
  getPipelineRun,
  getPipelineRunArtifactsDir,
  savePipelineRun,
} from "@/lib/pipelines/store";
import type {
  PipelineRun,
  PipelineStepRun,
  StartPipelineRunOptions,
} from "@/lib/pipelines/types";
import { createEggentPiSession } from "@/lib/pi/session";

const RUNNER_STATE_KEY = "__EGGENT_PIPELINE_RUNNER_STATE__";

interface PipelineRunnerState {
  running: Set<string>;
}

function getRunnerState(): PipelineRunnerState {
  const globalWithState = globalThis as typeof globalThis & {
    [RUNNER_STATE_KEY]?: PipelineRunnerState;
  };
  if (!globalWithState[RUNNER_STATE_KEY]) {
    globalWithState[RUNNER_STATE_KEY] = { running: new Set<string>() };
  }
  return globalWithState[RUNNER_STATE_KEY];
}

function now() {
  return new Date().toISOString();
}

function shortError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/\s+/g, " ").trim() || "Unknown pipeline error";
}

function createInitialRun(options: StartPipelineRunOptions, stepRuns: PipelineStepRun[]): PipelineRun {
  const runId = `run_${crypto.randomUUID()}`;
  const timestamp = now();
  return {
    id: runId,
    pipelineId: options.pipelineId,
    chatId: options.chatId,
    projectId: options.projectId,
    status: "queued",
    input: options.input,
    artifactsDir: getPipelineRunArtifactsDir(runId),
    steps: stepRuns,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function createPipelineRun(options: StartPipelineRunOptions): Promise<PipelineRun> {
  const pipeline = await getPipelineDefinition(options.pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${options.pipelineId}`);
  }

  const stepRuns: PipelineStepRun[] = pipeline.steps.map((step) => ({
    id: crypto.randomUUID(),
    stepId: step.id,
    name: step.name,
    projectId: step.projectId,
    status: "queued",
  }));

  const run = createInitialRun({ ...options, pipelineId: pipeline.id }, stepRuns);
  await ensureArtifactsDir(run.artifactsDir);
  await savePipelineRun(run);
  return run;
}

export async function executePipelineRun(runId: string, options: { cwd?: string } = {}): Promise<PipelineRun> {
  const state = getRunnerState();
  if (state.running.has(runId)) {
    const current = await getPipelineRun(runId);
    if (!current) throw new Error(`Pipeline run not found: ${runId}`);
    return current;
  }

  state.running.add(runId);
  try {
    const run = await getPipelineRun(runId);
    if (!run) throw new Error(`Pipeline run not found: ${runId}`);

    const pipeline = await getPipelineDefinition(run.pipelineId);
    if (!pipeline) throw new Error(`Pipeline not found: ${run.pipelineId}`);

    await ensureArtifactsDir(run.artifactsDir);
    run.status = "running";
    run.updatedAt = now();
    await savePipelineRun(run);

    const completedSteps: PipelineStepRun[] = run.steps.filter(
      (step) => step.status === "completed"
    );

    for (let index = 0; index < pipeline.steps.length; index += 1) {
      const step = pipeline.steps[index];
      const stepRun = run.steps[index];
      if (!stepRun) continue;
      if (stepRun.status === "completed") continue;

      stepRun.status = "running";
      stepRun.startedAt = now();
      stepRun.error = undefined;
      run.updatedAt = stepRun.startedAt;
      await savePipelineRun(run);

      let summary = "";
      const effectiveProjectId = step.projectId || run.projectId;
      const session = await createEggentPiSession({
        cwd: step.cwd || options.cwd,
        projectId: effectiveProjectId,
        chatId: `${run.id}-${step.id}`,
        tools: step.tools,
      });

      const unsubscribe = session.subscribe((event: unknown) => {
        if (typeof event !== "object" || event === null || Array.isArray(event)) return;
        const record = event as Record<string, unknown>;
        if (record.type !== "message_update") return;
        const assistantEvent = record.assistantMessageEvent as Record<string, unknown> | undefined;
        if (assistantEvent?.type === "text_delta" && typeof assistantEvent.delta === "string") {
          summary += assistantEvent.delta;
        }
      });

      try {
        await session.prompt(
          buildPipelineStepPrompt({
            pipeline,
            step,
            userInput: run.input,
            artifactsDir: run.artifactsDir,
            previousSteps: completedSteps,
          })
        );

        stepRun.status = "completed";
        stepRun.summary = summary.trim();
        stepRun.completedAt = now();
        stepRun.artifacts = await listArtifacts(run.artifactsDir);
        completedSteps.push({ ...stepRun });
      } catch (error) {
        stepRun.status = "failed";
        stepRun.error = shortError(error);
        stepRun.completedAt = now();
        run.status = "failed";
        run.error = stepRun.error;
        run.updatedAt = stepRun.completedAt;
        await savePipelineRun(run);
        throw error;
      } finally {
        unsubscribe();
        session.dispose();
      }

      run.updatedAt = stepRun.completedAt || now();
      await savePipelineRun(run);
    }

    run.status = "completed";
    run.error = undefined;
    run.updatedAt = now();
    await savePipelineRun(run);
    return run;
  } finally {
    state.running.delete(runId);
  }
}

export async function startPipelineRun(options: StartPipelineRunOptions): Promise<PipelineRun> {
  const run = await createPipelineRun(options);
  return executePipelineRun(run.id, { cwd: options.cwd });
}

export async function startPipelineRunInBackground(
  options: StartPipelineRunOptions
): Promise<PipelineRun> {
  const run = await createPipelineRun(options);
  void executePipelineRun(run.id, { cwd: options.cwd }).catch((error) => {
    console.error(`Pipeline run ${run.id} failed:`, error);
  });
  return run;
}
