export type TextPatch = {
  start: number;
  deleteCount: number;
  insertText: string;
};

export type TextMergeResult = {
  content: string;
  conflicted: boolean;
};

export function createTextPatch(
  baseContent: string,
  nextContent: string,
): TextPatch | null {
  if (baseContent === nextContent) {
    return null;
  }

  let prefixLength = 0;

  while (
    prefixLength < baseContent.length &&
    prefixLength < nextContent.length &&
    baseContent[prefixLength] === nextContent[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;

  while (
    suffixLength < baseContent.length - prefixLength &&
    suffixLength < nextContent.length - prefixLength &&
    baseContent[baseContent.length - 1 - suffixLength] ===
      nextContent[nextContent.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  return {
    start: prefixLength,
    deleteCount: baseContent.length - prefixLength - suffixLength,
    insertText: nextContent.slice(
      prefixLength,
      nextContent.length - suffixLength,
    ),
  };
}

export function applyTextPatch(content: string, patch: TextPatch) {
  if (
    !Number.isInteger(patch.start) ||
    !Number.isInteger(patch.deleteCount) ||
    patch.start < 0 ||
    patch.deleteCount < 0 ||
    patch.start + patch.deleteCount > content.length
  ) {
    throw new Error("Text patch is outside the document bounds");
  }

  return (
    content.slice(0, patch.start) +
    patch.insertText +
    content.slice(patch.start + patch.deleteCount)
  );
}

export function mergeTextPatch(
  baseContent: string,
  localPatch: TextPatch,
  remoteContent: string,
): TextMergeResult {
  const localContent = applyTextPatch(baseContent, localPatch);

  if (remoteContent === baseContent || remoteContent === localContent) {
    return { content: localContent, conflicted: false };
  }

  if (localContent === baseContent) {
    return { content: remoteContent, conflicted: false };
  }

  const remotePatch = createTextPatch(baseContent, remoteContent);

  if (!remotePatch) {
    return { content: localContent, conflicted: false };
  }

  if (!patchesOverlap(localPatch, remotePatch)) {
    const content = [localPatch, remotePatch]
      .sort((left, right) => right.start - left.start)
      .reduce(applyTextPatch, baseContent);

    return { content, conflicted: false };
  }

  const conflictStart = Math.min(localPatch.start, remotePatch.start);
  const conflictEnd = Math.max(
    localPatch.start + localPatch.deleteCount,
    remotePatch.start + remotePatch.deleteCount,
  );
  const localSegment = applyPatchToRange(
    baseContent,
    localPatch,
    conflictStart,
    conflictEnd,
  );
  const remoteSegment = applyPatchToRange(
    baseContent,
    remotePatch,
    conflictStart,
    conflictEnd,
  );
  const conflict = [
    "<<<<<<< LOCAL CHANGE",
    localSegment,
    "=======",
    remoteSegment,
    ">>>>>>> REMOTE CHANGE",
  ].join("\n");

  return {
    content:
      baseContent.slice(0, conflictStart) +
      conflict +
      baseContent.slice(conflictEnd),
    conflicted: true,
  };
}

function patchesOverlap(left: TextPatch, right: TextPatch) {
  const leftEnd = left.start + left.deleteCount;
  const rightEnd = right.start + right.deleteCount;

  if (left.deleteCount === 0) {
    return left.start >= right.start && left.start <= rightEnd;
  }

  if (right.deleteCount === 0) {
    return right.start >= left.start && right.start <= leftEnd;
  }

  return Math.max(left.start, right.start) < Math.min(leftEnd, rightEnd);
}

function applyPatchToRange(
  baseContent: string,
  patch: TextPatch,
  rangeStart: number,
  rangeEnd: number,
) {
  const segment = baseContent.slice(rangeStart, rangeEnd);

  return applyTextPatch(segment, {
    ...patch,
    start: patch.start - rangeStart,
  });
}
