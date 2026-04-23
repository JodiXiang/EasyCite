import { formatInTextCitation, type CitationMode, type CitationStyle, type Paper } from "@citepilot/citation-core";
import { Router } from "express";
import { z } from "zod";
import { addCitation, getBibliography, getNextCitationOrder } from "../services/documentStore.js";

const citationSchema = z.object({
  paper: z.custom<Paper>(),
  style: z.enum(["apa", "ieee", "vancouver"]).default("apa"),
  mode: z.enum(["auto", "parenthetical", "narrative", "year-only"]).optional(),
  contextText: z.string().optional()
});

export const documentsRouter = Router();

documentsRouter.post("/:documentId/citations", (req, res, next) => {
  try {
    const { documentId } = req.params;
    const body = citationSchema.parse(req.body);
    const style = body.style as CitationStyle;
    const mode = body.mode as CitationMode | undefined;
    const order = getNextCitationOrder(documentId, body.paper);
    const insertedText = formatInTextCitation(body.paper, style, order, {
      mode,
      contextText: body.contextText
    });
    const citation = addCitation(documentId, body.paper, style, insertedText, order, mode);
    const bibliography = getBibliography(documentId, style);

    res.json({ citation, insertedText, bibliography });
  } catch (error) {
    next(error);
  }
});

documentsRouter.get("/:documentId/bibliography", (req, res) => {
  const style = req.query.style === "ieee" || req.query.style === "vancouver" ? req.query.style : "apa";
  res.json({ bibliography: getBibliography(req.params.documentId, style) });
});

documentsRouter.post("/:documentId/reformat", (_req, res) => {
  res.status(501).json({
    error: "Reformat is reserved for Phase 3. Bibliography re-rendering is already supported."
  });
});
