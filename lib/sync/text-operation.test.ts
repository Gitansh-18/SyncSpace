import { describe, expect, it } from "vitest";
import {
  applyTextPatch,
  createTextPatch,
  mergeTextPatch,
} from "./text-operation";

describe("createTextPatch", () => {
  it("creates an insertion patch", () => {
    expect(createTextPatch("Hello world", "Hello brave world")).toEqual({
      start: 6,
      deleteCount: 0,
      insertText: "brave ",
    });
  });

  it("creates a deletion patch", () => {
    expect(createTextPatch("Hello brave world", "Hello world")).toEqual({
      start: 6,
      deleteCount: 6,
      insertText: "",
    });
  });

  it("returns null when the content is unchanged", () => {
    expect(createTextPatch("Same", "Same")).toBeNull();
  });
});

describe("applyTextPatch", () => {
  it("applies a replacement", () => {
    expect(
      applyTextPatch("The colour is blue", {
        start: 4,
        deleteCount: 6,
        insertText: "color",
      }),
    ).toBe("The color is blue");
  });

  it("rejects a patch outside the document bounds", () => {
    expect(() =>
      applyTextPatch("Short", {
        start: 4,
        deleteCount: 4,
        insertText: "",
      }),
    ).toThrow("outside the document bounds");
  });
});

describe("mergeTextPatch", () => {
  it("applies a local change when the server content is unchanged", () => {
    const result = mergeTextPatch(
      "Hello world",
      { start: 6, deleteCount: 5, insertText: "team" },
      "Hello world",
    );

    expect(result).toEqual({
      content: "Hello team",
      conflicted: false,
    });
  });

  it("merges non-overlapping local and remote changes", () => {
    const result = mergeTextPatch(
      "Hello world",
      { start: 0, deleteCount: 5, insertText: "Hi" },
      "Hello brave world",
    );

    expect(result).toEqual({
      content: "Hi brave world",
      conflicted: false,
    });
  });

  it("does not duplicate an identical concurrent change", () => {
    const result = mergeTextPatch(
      "abc",
      { start: 1, deleteCount: 1, insertText: "X" },
      "aXc",
    );

    expect(result).toEqual({
      content: "aXc",
      conflicted: false,
    });
  });

  it("preserves both versions of an overlapping change", () => {
    const result = mergeTextPatch(
      "The color is blue.",
      { start: 13, deleteCount: 4, insertText: "green" },
      "The color is red.",
    );

    expect(result.conflicted).toBe(true);
    expect(result.content).toContain("green");
    expect(result.content).toContain("red");
    expect(result.content).toContain("<<<<<<< LOCAL CHANGE");
    expect(result.content).toContain(">>>>>>> REMOTE CHANGE");
  });

  it("produces the same conflict output for the same inputs", () => {
    const inputs = [
      "Draft title",
      { start: 6, deleteCount: 5, insertText: "heading" },
      "Draft name",
    ] as const;

    expect(mergeTextPatch(...inputs)).toEqual(mergeTextPatch(...inputs));
  });
});
