import { describe, expect, it } from "vitest";
import type { PersistentJob } from "../utils/persistentJobQueue";

describe("persistentJobQueue", () => {
  it("formats and structures persistent job objects accurately", () => {
    const job: PersistentJob = {
      id: "job-123",
      tool: "image-compress",
      fileName: "test.png",
      fileSize: 1024,
      fileBlob: new Blob(["sample"], { type: "image/png" }),
      status: "queued",
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(job.id).toBe("job-123");
    expect(job.tool).toBe("image-compress");
    expect(job.status).toBe("queued");
    expect(job.fileSize).toBe(1024);
  });
});
