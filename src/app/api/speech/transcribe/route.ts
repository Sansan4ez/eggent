import { NextRequest } from "next/server";
import { transcribeAudioBuffer } from "@/lib/speech/transcriber";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const languageRaw = formData.get("language");
    const language = typeof languageRaw === "string" ? languageRaw : undefined;

    if (!(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await transcribeAudioBuffer({
      buffer,
      filename: file.name || "audio.webm",
      mimeType: file.type,
      language,
    });

    return Response.json({
      success: true,
      transcript: result.transcript,
      language: result.language,
    });
  } catch (error) {
    console.error("Speech transcription API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
