// Helpers for the start-date tag that GanttSmart stores inside Linear issue descriptions.
// Current format: "Start Date: YYYY-MM-DD"; legacy format: "start: DD-MM-YY".

const START_TAG_RE = /(start date|start):\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{2})/i;

/**
 * Split an issue description into its human body and the GanttSmart start-date tag.
 * The tag is metadata and should not be shown/edited as part of the description body.
 */
export function extractStartTag(description: string | null | undefined): { body: string; tag: string | null } {
  if (!description) return { body: '', tag: null };
  const match = description.match(START_TAG_RE);
  const tag = match ? match[0] : null;
  let body = description;
  if (tag) {
    body = description.replace(START_TAG_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  return { body, tag };
}

/** Combine an edited description body with an existing start-date tag (if any). */
export function combineDescription(body: string, tag: string | null): string {
  const trimmed = body.trim();
  if (!tag) return trimmed;
  return trimmed ? `${trimmed}\n${tag}` : tag;
}
