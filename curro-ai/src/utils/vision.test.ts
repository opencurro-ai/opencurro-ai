import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isVisionCapableModel } from "./vision.js";

describe("isVisionCapableModel", () => {
  it("treats well-known vision models as capable", () => {
    for (const model of [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.5-preview",
      "claude-3-5-sonnet",
      "gemini-1.5-pro",
      "pixtral-12b",
      "qwen2.5-vl-72b",
      "o1",
      "o3",
      "o4-mini",
    ]) {
      assert.equal(isVisionCapableModel(model), true, `${model} should be vision capable`);
    }
  });

  it("treats well-known text-only models as not capable", () => {
    for (const model of [
      "gpt-3.5-turbo",
      "deepseek-chat",
      "deepseek-reasoner",
      "llama-3.1-70b",
      "mistral-small-latest",
      "gemma-2-9b",
    ]) {
      assert.equal(isVisionCapableModel(model), false, `${model} should be text-only`);
    }
  });

  it("classifies the vision-less reasoning mini/preview variants as text-only", () => {
    // Regression: the broad "o1"/"o3" vision indicators must NOT win over these.
    for (const model of ["o1-mini", "o1-preview", "o3-mini", "openai/o3-mini-2025-01-31"]) {
      assert.equal(isVisionCapableModel(model), false, `${model} should be text-only`);
    }
  });

  it("classifies code-specialised models as text-only", () => {
    for (const model of [
      "deepseek-coder",
      "codestral-latest",
      "codellama-70b",
      "code-llama-13b",
      "starcoder2-15b",
    ]) {
      assert.equal(isVisionCapableModel(model), false, `${model} should be text-only`);
    }
  });

  it("lets explicit config text-only patterns override a vision match", () => {
    assert.equal(
      isVisionCapableModel("claude-3-5-sonnet", { textOnlyModelPatterns: ["claude-3-5-sonnet"] }),
      false,
    );
  });

  it("lets explicit config vision patterns rescue an unknown model", () => {
    assert.equal(
      isVisionCapableModel("my-custom-model", { visionModelPatterns: ["my-custom"] }),
      true,
    );
  });

  it("text-only config patterns win over vision config patterns", () => {
    assert.equal(
      isVisionCapableModel("some-model", {
        textOnlyModelPatterns: ["some-model"],
        visionModelPatterns: ["some-model"],
      }),
      false,
    );
  });

  it("defaults unknown models to capable and handles empty ids", () => {
    assert.equal(isVisionCapableModel("totally-unknown-model-2099"), true);
    assert.equal(isVisionCapableModel(""), true);
    assert.equal(isVisionCapableModel("   "), true);
  });
});
