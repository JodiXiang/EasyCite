import type { Author, BibliographyEntry, CitationFormatOptions, CitationMode, CitationStyle, Paper } from "./types.js";

export function formatInTextCitation(
  paper: Paper,
  style: CitationStyle,
  order?: number,
  options: CitationFormatOptions = {}
): string {
  if (style === "ieee" || style === "vancouver") return `[${order ?? 1}]`;

  const mode = resolveCitationMode(paper, options);
  const author = formatLeadAuthor(paper.authors, mode);
  const year = paper.year ?? "n.d.";

  if (mode === "year-only") return `(${year})`;
  if (mode === "narrative") return `${author} (${year})`;
  return `(${author}, ${year})`;
}

export function formatBibliographyEntry(paper: Paper, style: CitationStyle, order: number): BibliographyEntry {
  const formattedText = style === "ieee"
    ? `[${order}] ${formatIeeeReference(paper)}`
    : style === "vancouver"
      ? `${order}. ${formatVancouverReference(paper)}`
      : formatApaReference(paper);

  return {
    paperKey: paper.canonicalKey,
    style,
    order,
    formattedText
  };
}

function formatApaReference(paper: Paper): string {
  const authors = formatApaAuthors(paper.authors);
  const year = paper.year ? `(${paper.year}).` : "(n.d.).";
  const title = `${toSentenceCase(paper.title)}.`;
  const venue = paper.venue ? ` ${paper.venue}` : "";
  const volumeIssue = paper.volume
    ? `, ${paper.volume}${paper.issue ? `(${paper.issue})` : ""}`
    : paper.issue ? ` (${paper.issue})` : "";
  const pages = formatPages(paper.pageFirst, paper.pageLast, "apa");
  const locator = pages ? `, ${pages}.` : venue || volumeIssue ? "." : "";
  const doiOrUrl = paper.doi
    ? ` https://doi.org/${paper.doi}`
    : paper.url ? ` ${paper.url}` : "";

  return `${authors} ${year} ${title}${venue}${volumeIssue}${locator}${doiOrUrl}`.replace(/\s+/g, " ").trim();
}

function formatIeeeReference(paper: Paper): string {
  const authors = formatIeeeAuthors(paper.authors);
  const title = `"${paper.title}"`;
  const venue = paper.venue ? `${paper.venue}` : "Unknown venue";
  const volumeIssue = paper.volume
    ? `, vol. ${paper.volume}${paper.issue ? `, no. ${paper.issue}` : ""}`
    : paper.issue ? `, no. ${paper.issue}` : "";
  const pages = formatPages(paper.pageFirst, paper.pageLast, "ieee");
  const year = paper.year ? `, ${paper.year}` : "";
  const doi = paper.doi ? `, doi: ${paper.doi}` : paper.url ? `, ${paper.url}` : "";
  return `${authors}, ${title}, ${venue}${volumeIssue}${pages ? `, pp. ${pages}` : ""}${year}${doi}.`
    .replace(/\s+/g, " ")
    .trim();
}

function formatVancouverReference(paper: Paper): string {
  const authors = formatVancouverAuthors(paper.authors);
  const title = `${paper.title}.`;
  const venue = paper.venue ? ` ${paper.venue}.` : "";
  const year = paper.year ? ` ${paper.year}` : "";
  const volumeIssue = paper.volume
    ? `;${paper.volume}${paper.issue ? `(${paper.issue})` : ""}`
    : paper.issue ? `;(${paper.issue})` : "";
  const pages = formatPages(paper.pageFirst, paper.pageLast, "vancouver");
  const locator = pages ? `:${pages}.` : year || volumeIssue ? "." : "";
  const doi = paper.doi ? ` doi:${paper.doi}.` : paper.url ? ` Available from: ${paper.url}` : "";
  return `${authors} ${title}${venue}${year}${volumeIssue}${locator}${doi}`.replace(/\s+/g, " ").trim();
}

function formatLeadAuthor(authors: Author[], mode: CitationMode): string {
  if (authors.length === 0) return "Unknown";
  if (authors.length === 1) return authors[0]?.family || authors[0]?.displayName || "Unknown";
  if (authors.length === 2) {
    const first = authors[0]?.family || authors[0]?.displayName || "Unknown";
    const second = authors[1]?.family || authors[1]?.displayName || "Unknown";
    return mode === "narrative" ? `${first} and ${second}` : `${first} & ${second}`;
  }

  const first = authors[0]?.family || authors[0]?.displayName || "Unknown";
  return `${first} et al.`;
}

function formatApaAuthors(authors: Author[]): string {
  if (authors.length === 0) return "Unknown author.";

  if (authors.length <= 20) {
    const formatted = authors.map(formatApaAuthorName);
    if (formatted.length === 1) return ensureTerminalPeriod(formatted[0]);
    return ensureTerminalPeriod(`${formatted.slice(0, -1).join(", ")}, & ${formatted.at(-1)}`);
  }

  const firstNineteen = authors.slice(0, 19).map(formatApaAuthorName).join(", ");
  const lastAuthor = formatApaAuthorName(authors.at(-1)!);
  return ensureTerminalPeriod(`${firstNineteen}, ... ${lastAuthor}`);
}

function formatApaAuthorName(author: Author): string {
  const family = author.family || author.displayName || "Unknown";
  const initials = (author.given ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]}.`)
    .join(" ");
  return initials ? `${family}, ${initials}` : family;
}

function formatIeeeAuthors(authors: Author[]): string {
  if (authors.length === 0) return "Unknown author";

  return authors.slice(0, 6).map((author) => {
    const initials = (author.given ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `${part[0]}.`)
      .join(" ");
    const family = author.family || author.displayName || "Unknown";
    return initials ? `${initials} ${family}` : family;
  }).join(", ");
}

function formatVancouverAuthors(authors: Author[]): string {
  if (authors.length === 0) return "Unknown author.";

  const visible = authors.slice(0, 6).map((author) => {
    const family = author.family || author.displayName || "Unknown";
    const initials = (author.given ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("");
    return initials ? `${family} ${initials}` : family;
  });

  const suffix = authors.length > 6 ? ", et al." : ".";
  return `${visible.join(", ")}${suffix}`;
}

function formatPages(pageFirst?: string, pageLast?: string, _style?: CitationStyle): string {
  if (pageFirst && pageLast) return `${pageFirst}-${pageLast}`;
  return pageFirst || pageLast || "";
}

function toSentenceCase(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "Untitled";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function ensureTerminalPeriod(text: string): string {
  return text.endsWith(".") ? text : `${text}.`;
}

function resolveCitationMode(paper: Paper, options: CitationFormatOptions): CitationMode {
  if (options.mode && options.mode !== "auto") return options.mode;

  const context = (options.contextText ?? "").toLowerCase();
  const leadAuthor = (paper.authors[0]?.family || paper.authors[0]?.displayName || "").toLowerCase();
  if (leadAuthor && context.includes(leadAuthor)) return "year-only";
  return "parenthetical";
}
