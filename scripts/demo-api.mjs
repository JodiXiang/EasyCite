const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:8787";

const search = await post("/api/search/manual", {
  query: "large language models few-shot learners",
  limit: 3
});

console.log("Search candidates:");
for (const paper of search.papers) {
  console.log(`- ${paper.title} (${paper.year || "n.d."})`);
}

const firstPaper = search.papers[0];
if (!firstPaper) {
  console.log("No papers returned.");
  process.exit(0);
}

const inserted = await post("/api/documents/demo-doc/citations", {
  paper: firstPaper,
  style: "apa"
});

console.log("\nInserted citation:");
console.log(inserted.insertedText);

console.log("\nBibliography:");
for (const entry of inserted.bibliography) {
  console.log(entry.formattedText);
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  return response.json();
}
