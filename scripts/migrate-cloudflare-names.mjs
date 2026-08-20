const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!accountId || !token) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required");
}

const apiBase = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
const headers = { Authorization: `Bearer ${token}` };

async function request(path, options = {}, allow404 = false) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (allow404 && response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${body}`);
  }

  const type = response.headers.get("content-type") || "";
  return type.includes("application/json") ? response.json() : response;
}

async function renameD1() {
  const id = "e9ecf94f-fa71-4004-a5b8-f9317eb4d4e9";
  const current = await request(`/d1/database/${id}`);
  if (current.result?.name !== "politiker") {
    await request(`/d1/database/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "politiker" }),
    });
  }
  const verified = await request(`/d1/database/${id}`);
  if (verified.result?.name !== "politiker") throw new Error("D1 rename could not be verified");
  console.log("D1: politiker");
}

async function renameKv() {
  const id = "23255cc6e67a4a19b19e5ea67a676b40";
  await request(`/storage/kv/namespaces/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "politiker_sessions" }),
  });
  const namespaces = await request("/storage/kv/namespaces?per_page=1000");
  const verified = namespaces.result?.some((item) => item.id === id && item.title === "politiker_sessions");
  if (!verified) throw new Error("KV rename could not be verified");
  console.log("KV: politiker_sessions");
}

function objectPath(bucket, key) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `/r2/buckets/${bucket}/objects/${encodedKey}`;
}

async function ensureR2Bucket() {
  const oldBucket = "politiker-webapp-attachments";
  const newBucket = "politiker-attachments";
  const existing = await request(`/r2/buckets/${newBucket}`, {}, true);
  if (!existing) {
    await request("/r2/buckets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newBucket }),
    });
  }

  let cursor = "";
  let copied = 0;
  do {
    const query = new URLSearchParams({ per_page: "1000" });
    if (cursor) query.set("cursor", cursor);
    const page = await request(`/r2/buckets/${oldBucket}/objects?${query}`, {}, true);
    if (!page) {
      console.log("R2: old bucket is absent; new bucket is ready");
      return;
    }

    const objects = Array.isArray(page.result) ? page.result : page.result?.objects || [];
    for (const object of objects) {
      const source = await request(objectPath(oldBucket, object.key));
      const uploadHeaders = {};
      const contentType = source.headers.get("content-type");
      if (contentType) uploadHeaders["content-type"] = contentType;
      await request(objectPath(newBucket, object.key), {
        method: "PUT",
        headers: uploadHeaders,
        body: source.body,
        duplex: "half",
      });
      copied += 1;
    }
    cursor = page.result_info?.cursor || page.result?.cursor || "";
  } while (cursor);

  console.log(`R2: ${newBucket} ready; copied ${copied} object(s); old bucket retained`);
}

async function verifyWorker() {
  const worker = await request("/workers/workers/politiker", {}, true);
  if (!worker) throw new Error("Expected the already-renamed Worker politiker");
  console.log("Worker verified: politiker");
}

await ensureR2Bucket();
await renameD1();
await renameKv();
await verifyWorker();
console.log("Cloudflare name migration complete.");
