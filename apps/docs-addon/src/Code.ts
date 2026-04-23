const DEFAULT_API_BASE_URL = "http://localhost:8787";
const REFERENCES_START = "[CITEPILOT_REFERENCES_START]";
const REFERENCES_END = "[CITEPILOT_REFERENCES_END]";

function onOpen() {
  DocumentApp.getUi()
    .createMenu("EasyCite")
    .addItem("Open sidebar", "showSidebar")
    .addItem("Find citation", "showSidebar")
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("Sidebar")
    .setTitle("EasyCite");
  DocumentApp.getUi().showSidebar(html);
}

function getSelectedContext() {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  if (selection) {
    const selectedText = selection.getRangeElements()
      .map((rangeElement) => readRangeElementText(rangeElement))
      .join(" ")
      .trim();
    if (selectedText) return { selectedText, documentId: doc.getId() };
  }

  const cursor = doc.getCursor();
  const surroundingText = cursor?.getElement().getParent().asParagraph?.().getText?.() ?? "";
  return { selectedText: surroundingText, surroundingText, documentId: doc.getId() };
}

function setApiBaseUrl(apiBaseUrl: string) {
  PropertiesService.getScriptProperties().setProperty("CITEPILOT_API_BASE_URL", apiBaseUrl);
  return { ok: true, apiBaseUrl };
}

function getApiBaseUrl() {
  return PropertiesService.getScriptProperties().getProperty("CITEPILOT_API_BASE_URL") || DEFAULT_API_BASE_URL;
}

function saveAiSettings(providerMode: "basic" | "ai", openAIApiKey: string, openAIModel: string) {
  const properties = PropertiesService.getUserProperties();
  properties.setProperty("EASYCITE_PROVIDER_MODE", providerMode);
  properties.setProperty("EASYCITE_OPENAI_API_KEY", openAIApiKey.trim());
  properties.setProperty("EASYCITE_OPENAI_MODEL", openAIModel.trim() || "gpt-5.4-mini");
  return getAiSettings();
}

function getAiSettings() {
  const properties = PropertiesService.getUserProperties();
  return {
    providerMode: properties.getProperty("EASYCITE_PROVIDER_MODE") || "basic",
    openAIApiKey: properties.getProperty("EASYCITE_OPENAI_API_KEY") || "",
    openAIModel: properties.getProperty("EASYCITE_OPENAI_MODEL") || "gpt-5.4-mini"
  };
}

function searchManual(query: string, limit = 5) {
  return postJson("/api/search/manual", { query, limit, ...getAiSettings() });
}

function searchContext(limit = 5) {
  const context = getSelectedContext();
  return postJson("/api/search/context", { ...context, limit, ...getAiSettings() });
}

function insertCitation(paper: unknown, style: "apa" | "ieee" | "vancouver", mode: "auto" | "parenthetical" | "narrative" | "year-only") {
  const doc = DocumentApp.getActiveDocument();
  const result = postJson(`/api/documents/${doc.getId()}/citations`, {
    paper,
    style,
    mode,
    contextText: getSelectedContext().selectedText
  });
  insertTextAtCursorOrEnd(result.insertedText);
  rewriteReferences(result.bibliography.map((entry: { formattedText: string }) => entry.formattedText));
  return result;
}

function insertTextAtCursorOrEnd(text: string) {
  const doc = DocumentApp.getActiveDocument();
  const cursor = doc.getCursor();
  if (cursor) {
    cursor.insertText(` ${text}`);
    return;
  }

  doc.getBody().appendParagraph(text);
}

function rewriteReferences(entries: string[]) {
  const body = DocumentApp.getActiveDocument().getBody();
  const blockLines = ["References", REFERENCES_START, ...entries, REFERENCES_END];
  const bounds = findReferencesBlock(body);

  if (!bounds) {
    body.appendParagraph("");
    blockLines.forEach((line) => body.appendParagraph(line));
    return;
  }

  for (let index = bounds.end; index >= bounds.start; index -= 1) {
    body.removeChild(body.getChild(index));
  }

  blockLines.reverse().forEach((line) => body.insertParagraph(bounds.start, line));
}

function postJson(path: string, payload: unknown) {
  try {
    const response = UrlFetchApp.fetch(`${getApiBaseUrl()}${path}`, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const text = response.getContentText();
    if (code >= 400) throw new Error(text);
    return JSON.parse(text);
  } catch (error) {
    const message = String(error);
    if (message.includes("DNS")) {
      throw new Error("EasyCite could not reach the API URL. Your temporary tunnel may have expired; restart cloudflared and update the API URL.");
    }
    throw error;
  }
}

function readRangeElementText(rangeElement: GoogleAppsScript.Document.RangeElement) {
  const element = rangeElement.getElement();
  if (element.getType() !== DocumentApp.ElementType.TEXT) return "";

  const textElement = element.asText();
  const text = textElement.getText();
  if (!rangeElement.isPartial()) return text;

  const start = rangeElement.getStartOffset();
  const end = rangeElement.getEndOffsetInclusive();
  return text.slice(start, end + 1);
}

function findReferencesBlock(body: GoogleAppsScript.Document.Body) {
  let start = -1;
  let end = -1;

  for (let index = 0; index < body.getNumChildren(); index += 1) {
    const childText = readElementText(body.getChild(index));
    if (childText.trim() === REFERENCES_START) start = index - 1 >= 0 ? index - 1 : index;
    if (childText.trim() === REFERENCES_END) {
      end = index;
      break;
    }
  }

  return start >= 0 && end >= start ? { start, end } : null;
}

function readElementText(element: GoogleAppsScript.Document.Element) {
  const type = element.getType();
  if (type === DocumentApp.ElementType.TEXT) return element.asText().getText();
  if (type === DocumentApp.ElementType.PARAGRAPH) return element.asParagraph().getText();
  if (type === DocumentApp.ElementType.LIST_ITEM) return element.asListItem().getText();
  return "";
}
