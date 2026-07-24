"use strict";

const currentCreationTime =
  "case`local`:return n.conversation==null?n.pendingWorktree.createdAt:t(xnr,n.conversation.id)??n.conversation.updatedAt";
const patchedCreationTime =
  currentCreationTime +
  "??(/^local:[\\da-f]{8}-[\\da-f]{4}-7[\\da-f]{3}-[89ab][\\da-f]{3}-[\\da-f]{12}$/i.test(n.key)?Number.parseInt(n.key.slice(6).replaceAll(`-`,``).slice(0,12),16):n.conversation.recencyAt??n.conversation.updatedAt)";

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

function applyProjectTaskSortPatch(source) {
  const currentCount = countOccurrences(source, currentCreationTime);
  const patchedCount = countOccurrences(source, patchedCreationTime);
  const unpatchedCount = currentCount - patchedCount;

  if (patchedCount === 1 && unpatchedCount === 0) {
    return source;
  }

  if (unpatchedCount !== 1 || patchedCount !== 0) {
    console.warn(
      "WARN: Could not find current project task creation timestamp insertion point - skipping project task sort feature patch",
    );
    return source;
  }

  return source.replace(currentCreationTime, patchedCreationTime);
}

const descriptors = [
  {
    id: "creation-time",
    phase: "webview-asset",
    order: 20_900,
    ciPolicy: "optional",
    pattern: /^app-initial-[^.]+\.js$/,
    missingDescription: "project task sort webview bundle",
    skipDescription: "project task creation timestamp feature patch",
    apply: applyProjectTaskSortPatch,
  },
];

module.exports = {
  applyProjectTaskSortPatch,
  descriptors,
};
