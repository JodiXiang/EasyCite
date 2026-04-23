import { Router } from "express";
import { z } from "zod";
import { searchByContext, searchByManualQuery } from "../services/retrieval.js";

const searchSchema = z.object({
  query: z.string().optional(),
  selectedText: z.string().optional(),
  surroundingText: z.string().optional(),
  limit: z.number().int().min(1).max(10).optional(),
  providerMode: z.enum(["basic", "ai"]).optional(),
  openAIApiKey: z.string().optional(),
  openAIModel: z.string().optional()
});

export const searchRouter = Router();

searchRouter.post("/manual", async (req, res, next) => {
  try {
    const body = searchSchema.parse(req.body);
    const papers = await searchByManualQuery(body.query ?? "", body.limit ?? 5, {
      providerMode: body.providerMode,
      openAIApiKey: body.openAIApiKey,
      openAIModel: body.openAIModel
    });
    res.json({ papers });
  } catch (error) {
    next(error);
  }
});

searchRouter.post("/context", async (req, res, next) => {
  try {
    const body = searchSchema.parse(req.body);
    const papers = await searchByContext({
      selectedText: body.selectedText ?? "",
      surroundingText: body.surroundingText,
      limit: body.limit ?? 5,
      providerMode: body.providerMode,
      openAIApiKey: body.openAIApiKey,
      openAIModel: body.openAIModel
    });
    res.json({ papers });
  } catch (error) {
    next(error);
  }
});
