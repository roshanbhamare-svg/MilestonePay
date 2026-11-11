import net from "net";
import { HumanMessage } from "@langchain/core/messages";

const GITHUB_API_BASE = "https://api.github.com";
const MAX_TREE_PATHS = 220;
const MAX_FILES_TO_READ = 8;
const MAX_CHARS_PER_FILE = 3500;
const MAX_TOTAL_REPO_CHARS = 18000;
const MAX_EXTERNAL_DOC_CHARS = 5000;

const IGNORED_PATH_SEGMENTS = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

const TEXT_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".cs", ".rb", ".php",
  ".json", ".md", ".txt", ".yml", ".yaml", ".toml",
  ".env.example", ".html", ".css", ".scss", ".sql",
]);

function isPrivateHostname(hostname) {
  const lower = String(hostname || "").toLowerCase();
  if (
    !lower ||
    lower === "localhost" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower === "::1"
  ) {
    return true;
  }

  const ipType = net.isIP(lower);
  if (ipType === 4) {
    const parts = lower.split(".").map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }
  if (ipType === 6 && (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80"))) {
    return true;
  }
  return false;
}

export function isSafeExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    return !isPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export function parseGitHubUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") {
    return null;
  }

  const segments = parsed.pathname
    .replace(/\.git$/i, "")
    .split("/")
    .filter(Boolean);

  if (segments.length < 2) return null;

  const [owner, repo, kind, ...rest] = segments;
  let ref = null;
  let subpath = "";

  if ((kind === "tree" || kind === "commit" || kind === "blob") && rest.length > 0) {
    ref = rest[0];
    subpath = rest.slice(1).join("/");
  }

  return { owner, repo, ref, subpath };
}

function buildGitHubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MilestonePay-LangGraph-Evaluator/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function hasTextExtension(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith("readme") || lower.endsWith("dockerfile") || lower.endsWith(".env.example")) {
    return true;
  }
  const dot = lower.lastIndexOf(".");
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(lower.slice(dot));
}

function scoreRepoFile(path, keywords = []) {
  const lower = path.toLowerCase();
  if (IGNORED_PATH_SEGMENTS.some((seg) => lower.includes(seg))) return -1;
  if (!hasTextExtension(lower)) return -1;

  let score = 1;
  if (lower === "readme.md" || lower.endsWith("/readme.md")) score += 50;
  if (lower === "package.json" || lower.endsWith("/package.json")) score += 45;
  if (lower.includes("auth") || lower.includes("server") || lower.includes("app")) score += 18;
  if (lower.includes("route") || lower.includes("controller") || lower.includes("model")) score += 15;
  if (lower.includes("test") || lower.includes("spec")) score += 12;
  if (lower.includes(".env.example")) score += 15;

  for (const kw of keywords) {
    if (kw.length >= 3 && lower.includes(kw)) {
      score += 20;
    }
  }
  return score;
}

function extractMilestoneKeywords(milestone) {
  const text = `${milestone?.title || ""} ${milestone?.description || ""} ${
    (milestone?.acceptanceCriteria || []).map((c) => c.criteria).join(" ")
  }`.toLowerCase();
  return [...new Set(text.match(/[a-z0-9]{4,}/g) || [])].slice(0, 20);
}

/**
 * Inspect a GitHub repository via GitHub REST API (supports private repos when GITHUB_TOKEN is set).
 */
export async function inspectGitHubRepository(
  githubUrl,
  { milestone = null, fetchImpl = fetch } = {}
) {
  const emptyResult = {
    provided: Boolean(githubUrl?.trim()),
    url: githubUrl || "",
    accessible: false,
    accessError: null,
    authMode: process.env.GITHUB_TOKEN?.trim() ? "authenticated" : "unauthenticated",
    repoInfo: null,
    fileTree: [],
    recentCommits: [],
    keyFiles: [],
  };

  if (!githubUrl?.trim()) {
    return emptyResult;
  }

  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) {
    return {
      ...emptyResult,
      accessError: "URL is not a valid GitHub repository URL (expected https://github.com/owner/repo).",
    };
  }

  const headers = buildGitHubHeaders();
  const { owner, repo, ref: urlRef, subpath } = parsed;

  try {
    const repoRes = await fetchImpl(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!repoRes.ok) {
      let reason = `GitHub API returned HTTP ${repoRes.status}`;
      if (repoRes.status === 404) {
        reason = process.env.GITHUB_TOKEN?.trim()
          ? "Repository not found (404) or GITHUB_TOKEN lacks read access."
          : "Repository not found or is private (404). Configure GITHUB_TOKEN in backend/.env for private repository access.";
      } else if (repoRes.status === 401 || repoRes.status === 403) {
        reason = `GitHub API access denied or rate-limited (${repoRes.status}). Check GITHUB_TOKEN.`;
      }
      return { ...emptyResult, accessError: reason };
    }

    const repoJson = await repoRes.json();
    const targetRef = urlRef || repoJson.default_branch || "main";

    const [treeRes, commitsRes] = await Promise.all([
      fetchImpl(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(targetRef)}?recursive=1`,
        { headers, signal: AbortSignal.timeout(10000) }
      ),
      fetchImpl(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(targetRef)}&per_page=5`,
        { headers, signal: AbortSignal.timeout(10000) }
      ),
    ]);

    let allPaths = [];
    if (treeRes.ok) {
      const treeJson = await treeRes.json();
      allPaths = (treeJson.tree || [])
        .filter((item) => item.type === "blob" && item.path)
        .map((item) => item.path)
        .filter((p) => !IGNORED_PATH_SEGMENTS.some((seg) => p.toLowerCase().includes(seg)))
        .filter((p) => !subpath || p.startsWith(subpath));
    }

    let recentCommits = [];
    if (commitsRes.ok) {
      const commitsJson = await commitsRes.json();
      if (Array.isArray(commitsJson)) {
        recentCommits = commitsJson.slice(0, 5).map((c) => ({
          sha: c.sha?.slice(0, 7),
          message: c.commit?.message?.split("\n")[0] || "",
          date: c.commit?.author?.date || "",
        }));
      }
    }

    const keywords = extractMilestoneKeywords(milestone);
    const rankedPaths = allPaths
      .map((p) => ({ path: p, score: scoreRepoFile(p, keywords) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_FILES_TO_READ)
      .map((x) => x.path);

    const keyFiles = [];
    let totalChars = 0;

    for (const filePath of rankedPaths) {
      if (totalChars >= MAX_TOTAL_REPO_CHARS) break;
      try {
        const contentRes = await fetchImpl(
          `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${filePath
            .split("/")
            .map(encodeURIComponent)
            .join("/")}?ref=${encodeURIComponent(targetRef)}`,
          { headers, signal: AbortSignal.timeout(8000) }
        );
        if (!contentRes.ok) continue;
        const fileJson = await contentRes.json();
        if (fileJson?.encoding === "base64" && fileJson?.content) {
          const decoded = Buffer.from(fileJson.content, "base64").toString("utf8");
          const snippet = decoded.slice(0, MAX_CHARS_PER_FILE);
          totalChars += snippet.length;
          keyFiles.push({
            path: filePath,
            truncated: decoded.length > MAX_CHARS_PER_FILE,
            content: snippet,
          });
        }
      } catch {
        // Ignore single-file fetch failures and continue inspecting remaining files
      }
    }

    return {
      ...emptyResult,
      accessible: true,
      repoInfo: {
        fullName: repoJson.full_name,
        private: Boolean(repoJson.private),
        defaultBranch: repoJson.default_branch,
        inspectedRef: targetRef,
        language: repoJson.language || "Unknown",
        description: repoJson.description || "",
        pushedAt: repoJson.pushed_at || null,
        totalFilesObserved: allPaths.length,
      },
      fileTree: allPaths.slice(0, MAX_TREE_PATHS),
      recentCommits,
      keyFiles,
    };
  } catch (err) {
    return {
      ...emptyResult,
      accessError: `Failed to connect to GitHub API: ${err?.message || "Network timeout"}`,
    };
  }
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;,]+)?(?:;(base64))?,([\s\S]*)$/i);
  if (!match) return null;
  const mimeType = (match[1] || "text/plain").toLowerCase();
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  const buffer = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  return { mimeType, buffer };
}

function isTextMime(mimeType, filename = "") {
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "application/xml"
  ) {
    return true;
  }
  return /\.(md|txt|json|js|jsx|ts|tsx|py|html|css|yml|yaml|csv|sql)$/i.test(filename);
}

/**
 * Inspect attached submission files (data URIs, documents, and screenshot images).
 */
export async function inspectSubmissionFiles(
  files = [],
  { milestone = null, visionModel = null, fetchImpl = fetch } = {}
) {
  const results = [];
  let imageInspectionsCount = 0;

  for (const file of files || []) {
    const filename = file?.filename || "unnamed-file";
    const fileType = file?.fileType || "document";
    const url = String(file?.url || "").trim();

    if (!url) {
      results.push({ filename, fileType, inspected: false, summary: "Empty file URL." });
      continue;
    }

    if (url.startsWith("data:")) {
      const decoded = decodeDataUrl(url);
      if (!decoded) {
        results.push({ filename, fileType, inspected: false, summary: "Malformed data URI." });
        continue;
      }

      if (decoded.mimeType.startsWith("image/")) {
        if (visionModel && imageInspectionsCount < 3) {
          imageInspectionsCount += 1;
          try {
            const criteriaText = (milestone?.acceptanceCriteria || [])
              .map((c, idx) => `${idx + 1}. ${c.criteria}`)
              .join("\n");
            const visionMsg = new HumanMessage({
              content: [
                {
                  type: "text",
                  text: `You are inspecting a submitted screenshot (${filename}) for milestone "${
                    milestone?.title || "Milestone"
                  }".\nAcceptance criteria:\n${
                    criteriaText || "General deliverable verification"
                  }\nConcisely describe the exact UI elements, text, errors, or functional evidence visible in this screenshot.`,
                },
                {
                  type: "image_url",
                  image_url: { url },
                },
              ],
            });
            const visionResp = await visionModel.invoke([visionMsg]);
            results.push({
              filename,
              fileType: "image",
              inspected: true,
              summary: `Screenshot visual analysis: ${String(visionResp?.content || "").slice(0, 1200)}`,
            });
            continue;
          } catch (err) {
            results.push({
              filename,
              fileType: "image",
              inspected: false,
              summary: `Image attached (${decoded.mimeType}, ${decoded.buffer.length} bytes), but vision inspection failed: ${err?.message || "Unavailable"}`,
            });
            continue;
          }
        }

        results.push({
          filename,
          fileType: "image",
          inspected: false,
          summary: `Inline image attached (${decoded.mimeType}, ${decoded.buffer.length} bytes); vision inspection skipped.`,
        });
        continue;
      }

      if (isTextMime(decoded.mimeType, filename)) {
        const text = decoded.buffer.toString("utf8").slice(0, MAX_EXTERNAL_DOC_CHARS);
        results.push({
          filename,
          fileType,
          inspected: true,
          summary: `Text/document content (${decoded.mimeType}):\n${text}`,
        });
      } else {
        results.push({
          filename,
          fileType,
          inspected: false,
          summary: `Binary document attached (${decoded.mimeType}, ${decoded.buffer.length} bytes).`,
        });
      }
      continue;
    }

    if (!isSafeExternalUrl(url)) {
      results.push({
        filename,
        fileType,
        inspected: false,
        summary: "External URL blocked by safety filter (must be public http/https URL).",
      });
      continue;
    }

    const looksLikeImage =
      fileType === "image" || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);

    if (looksLikeImage && visionModel && imageInspectionsCount < 3) {
      imageInspectionsCount += 1;
      try {
        const visionMsg = new HumanMessage({
          content: [
            {
              type: "text",
              text: `Describe factually what is visible in this submitted deliverable screenshot (${filename}) for milestone "${
                milestone?.title || "Milestone"
              }".`,
            },
            {
              type: "image_url",
              image_url: { url },
            },
          ],
        });
        const visionResp = await visionModel.invoke([visionMsg]);
        results.push({
          filename,
          fileType: "image",
          inspected: true,
          summary: `Screenshot visual analysis (${url}): ${String(visionResp?.content || "").slice(0, 1200)}`,
        });
        continue;
      } catch (err) {
        results.push({
          filename,
          fileType: "image",
          inspected: false,
          summary: `External image URL (${url}); visual inspection could not load image (${err?.message || "fetch error"}).`,
        });
        continue;
      }
    }

    try {
      const res = await fetchImpl(url, {
        method: "GET",
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) {
        results.push({
          filename,
          fileType,
          inspected: false,
          summary: `External URL (${url}) returned HTTP ${res.status}.`,
        });
        continue;
      }
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (isTextMime(contentType, filename)) {
        const text = (await res.text()).slice(0, MAX_EXTERNAL_DOC_CHARS);
        results.push({
          filename,
          fileType,
          inspected: true,
          summary: `Fetched document (${url}):\n${text}`,
        });
      } else {
        results.push({
          filename,
          fileType,
          inspected: false,
          summary: `External reference reachable (${url}, content-type: ${contentType || "unknown"}).`,
        });
      }
    } catch (err) {
      results.push({
        filename,
        fileType,
        inspected: false,
        summary: `External URL (${url}) could not be fetched: ${err?.message || "Network error"}.`,
      });
    }
  }

  return results;
}

/**
 * Format all observed submission artifacts into a structured prompt digest.
 */
export function formatSubmissionEvidenceDigest({ submission, repoInspection, fileInspections }) {
  const lines = [];
  lines.push(`Submission Version: v${submission?.version || 1}`);
  lines.push(`Submission Notes: ${submission?.notes?.trim() || "(none provided)"}`);
  lines.push("");

  if (!repoInspection?.provided) {
    lines.push("GitHub Repository: NONE PROVIDED");
  } else if (!repoInspection.accessible) {
    lines.push(`GitHub Repository URL: ${repoInspection.url}`);
    lines.push(`GitHub Repository Access: INACCESSIBLE (${repoInspection.accessError})`);
    lines.push(
      "CRITICAL RULE: Because the repository could not be accessed, you MUST NOT claim that source code inside the repo was verified."
    );
  } else {
    const info = repoInspection.repoInfo;
    lines.push(
      `GitHub Repository: ${info.fullName} (branch/ref: ${info.inspectedRef}, private: ${info.private}, primary language: ${info.language}, total files: ${info.totalFilesObserved})`
    );
    if (repoInspection.recentCommits.length > 0) {
      lines.push("Recent Commits:");
      repoInspection.recentCommits.forEach((c) => {
        lines.push(`  - [${c.sha}] ${c.message} (${c.date})`);
      });
    }
    if (repoInspection.fileTree.length > 0) {
      lines.push(`Observed File Tree (up to ${MAX_TREE_PATHS} files):`);
      lines.push(repoInspection.fileTree.join("\n"));
    }
    if (repoInspection.keyFiles.length > 0) {
      lines.push("\nInspected File Contents:");
      repoInspection.keyFiles.forEach((f) => {
        lines.push(`--- FILE: ${f.path}${f.truncated ? " (truncated)" : ""} ---`);
        lines.push(f.content);
      });
    }
  }

  lines.push("");
  if (!fileInspections || fileInspections.length === 0) {
    lines.push("Attached Files & Screenshots: NONE PROVIDED");
  } else {
    lines.push(`Attached Files & Screenshots (${fileInspections.length}):`);
    fileInspections.forEach((f, idx) => {
      lines.push(`[${idx + 1}] ${f.filename} (${f.fileType}, inspected=${f.inspected}): ${f.summary}`);
    });
  }

  return lines.join("\n");
}

