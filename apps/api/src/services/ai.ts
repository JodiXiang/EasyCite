import type { Paper } from "../lib/citationCore.js";

type AiSearchInput = {
  query?: string;
  selectedText?: string;
  surroundingText?: string;
  openAIApiKey?: string;
  openAIModel?: string;
};

type QueryRewriteResult = {
  queries: string[];
};

type RankedPaper = {
  canonicalKey: string;
  whyRelevant: string;
};

type RerankResult = {
  ranked: RankedPaper[];
};

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

export async function rewriteQueriesWithAi(input: AiSearchInput): Promise<string[]> {
  if (!input.openAIApiKey) return [];

  const prompt = [
    "You improve scholarly literature search queries.",
    "Return strict JSON only.",
    JSON.stringify({
      task: "Generate 3 concise search queries for academic search engines.",
      requirements: [
        "Preserve named methods, datasets, diseases, models, or technical terms.",
        "Do not invent citations or metadata.",
        "Prefer keyword queries, not natural-language questions."
      ],
      input: {
        query: input.query,
        selectedText: input.selectedText,
        surroundingText: input.surroundingText
      },
      outputSchema: {
        queries: ["string"]
      }
    })
  ].join("\n");

  const result = await callOpenAI<QueryRewriteResult>(prompt, input.openAIApiKey, input.openAIModel);
  return (result?.queries ?? []).map((query) => query.trim()).filter(Boolean);
}

export async function rerankPapersWithAi(input: AiSearchInput, papers: Paper[]): Promise<Paper[]> {
  if (!input.openAIApiKey || papers.length === 0) return papers;

  const prompt = [
    "You rerank scholarly search candidates for citation insertion.",
    "Return strict JSON only.",
    JSON.stringify({
      task: "Rank papers by how well they support the user's claim or search intent.",
      requirements: [
        "Only use the provided metadata.",
        "Prefer papers that directly support the claim.",
        "Reward stronger metadata completeness and likely canonical sources.",
        "Do not invent facts.",
        "For each ranked paper, provide one short whyRelevant explanation."
      ],
      input: {
        query: input.query,
        selectedText: input.selectedText,
        surroundingText: input.surroundingText,
        papers: papers.map((paper) => ({
          canonicalKey: paper.canonicalKey,
          title: paper.title,
          authors: paper.authors.map((author: Paper["authors"][number]) => author.displayName || author.family).join(", "),
          year: paper.year,
          venue: paper.venue,
          abstract: paper.abstract,
          doi: paper.doi,
          citedByCount: paper.citedByCount
        }))
      },
      outputSchema: {
        ranked: [
          {
            canonicalKey: "string",
            whyRelevant: "string"
          }
        ]
      }
    })
  ].join("\n");

  const result = await callOpenAI<RerankResult>(prompt, input.openAIApiKey, input.openAIModel);
  const ranked = result?.ranked ?? [];
  if (ranked.length === 0) return papers;

  const rankedMap = new Map(ranked.map((item, index) => [item.canonicalKey, { index, whyRelevant: item.whyRelevant }]));

  return papers
    .map((paper) => {
      const rank = rankedMap.get(paper.canonicalKey);
      return {
        ...paper,
        whyRelevant: rank?.whyRelevant || paper.whyRelevant,
        _rank: rank?.index ?? Number.MAX_SAFE_INTEGER
      };
    })
    .sort((left, right) => (left as any)._rank - (right as any)._rank)
    .map(({ _rank, ...paper }) => paper as Paper);
}

async function callOpenAI<T>(prompt: string, apiKey: string, model = "gpt-5.4-mini"): Promise<T | null> {
  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt,
        text: {
          format: {
            type: "json_object"
          }
        }
      })
    });

    if (!response.ok) return null;
    const payload = await response.json() as Record<string, unknown>;
    const outputText = extractOutputText(payload);
    return outputText ? JSON.parse(outputText) as T : null;
  } catch {
    return null;
  }
}

function extractOutputText(payload: Record<string, unknown>): string | null {
  if (typeof payload.output_text === "string") return payload.output_text;

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as Array<Record<string, unknown>>
      : [];

    for (const part of content) {
      if (typeof part.text === "string") return part.text;
    }
  }

  return null;
}
