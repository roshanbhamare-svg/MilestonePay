import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ChatGroq } from "@langchain/groq";

import {
  RequirementAnalysisSchema,
  TaskBreakdownSchema,
  MilestonePlanSchema,
  DeliverableEvaluationSchema,
  AssistantIntentSchema,
  ProjectAssistantSchema,
} from "../src/ai/schemas.js";
import {
  reconcileMilestoneBudgets,
  reconcileMilestoneDeadlines,
  validateMilestonePlan,
} from "../src/ai/utils/budgetAndSchedule.js";
import {
  parseGitHubUrl,
  isSafeExternalUrl,
  inspectGitHubRepository,
  inspectSubmissionFiles,
} from "../src/ai/tools/submissionInspector.js";
import { generateMilestonePlan } from "../src/ai/graphs/milestoneGeneratorGraph.js";
import { evaluateDeliverableSubmission } from "../src/ai/graphs/deliverableEvaluationGraph.js";
import { askProjectAssistant } from "../src/ai/graphs/projectAssistantGraph.js";
import {
  previewMilestonesHandler,
  generateMilestonesHandler,
  evaluateSubmissionHandler,
  getEvaluation,
  projectAssistantHandler,
} from "../src/controllers/aiController.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("Zod v4 + ChatGroq structured output compatibility", () => {
  it("binds all LangGraph Zod schemas to ChatGroq.withStructuredOutput cleanly", () => {
    const groq = new ChatGroq({
      apiKey: "gsk_test_placeholder_for_schema_check",
      model: "llama-3.3-70b-versatile",
    });

    const schemas = [
      ["RequirementAnalysisSchema", RequirementAnalysisSchema],
      ["TaskBreakdownSchema", TaskBreakdownSchema],
      ["MilestonePlanSchema", MilestonePlanSchema],
      ["DeliverableEvaluationSchema", DeliverableEvaluationSchema],
      ["AssistantIntentSchema", AssistantIntentSchema],
      ["ProjectAssistantSchema", ProjectAssistantSchema],
    ];

    for (const [name, schema] of schemas) {
      const runnable = groq.withStructuredOutput(schema, { name });
      assert.equal(typeof runnable.invoke, "function", `${name} failed to bind`);
    }
  });
});

describe("Deterministic budget & schedule reconciliation", () => {
  it("reconciles fractional and integer budgets to exact cent parity", () => {
    const budgets = [10, 300, 333.33, 1.03, 99.99];
    for (const totalBudget of budgets) {
      const milestones = [
        { title: "M1", weightPercentage: 20 },
        { title: "M2", weightPercentage: 25 },
        { title: "M3", weightPercentage: 30 },
        { title: "M4", weightPercentage: 25 },
      ];
      const allocated = reconcileMilestoneBudgets(milestones, totalBudget);
      const sum = allocated.reduce((acc, m) => acc + m.paymentAmount, 0);
      assert.ok(Math.abs(sum - totalBudget) < 0.001, `Sum mismatch for ${totalBudget}: ${sum}`);
      assert.ok(allocated.every((m) => m.paymentAmount > 0));
    }
  });

  it("distributes monotonic deadlines bounded by project deadline", () => {
    const start = new Date("2026-11-01T00:00:00.000Z");
    const end = "2026-12-01T00:00:00.000Z";
    const scheduled = reconcileMilestoneDeadlines(
      [
        { estimatedDaysRatio: 0.25 },
        { estimatedDaysRatio: 0.6 },
        { estimatedDaysRatio: 0.9 },
      ],
      end,
      start
    );

    assert.equal(scheduled.length, 3);
    assert.ok(new Date(scheduled[0].deadline) <= new Date(scheduled[1].deadline));
    assert.ok(new Date(scheduled[1].deadline) <= new Date(scheduled[2].deadline));
    assert.equal(scheduled[2].deadline, end);
  });

  it("validates milestone integrity and flags errors", () => {
    const valid = validateMilestonePlan(
      [
        {
          title: "Setup",
          description: "Init repo",
          paymentAmount: 100,
          deadline: "2026-12-01T00:00:00.000Z",
          deliverables: [{ title: "Repo", description: "Code" }],
          acceptanceCriteria: [{ criteria: "Builds cleanly" }],
        },
        {
          title: "Auth",
          description: "Add JWT",
          paymentAmount: 200,
          deadline: "2026-12-15T00:00:00.000Z",
          deliverables: [{ title: "Auth API", description: "Routes" }],
          acceptanceCriteria: [{ criteria: "Tests pass" }],
        },
      ],
      300
    );
    assert.equal(valid.isValid, true);

    const invalid = validateMilestonePlan(
      [
        {
          title: "",
          description: "Init",
          paymentAmount: 100,
          deadline: "2026-12-01T00:00:00.000Z",
          deliverables: [],
          acceptanceCriteria: [],
        },
      ],
      300
    );
    assert.equal(invalid.isValid, false);
    assert.ok(invalid.errors.length >= 3);
  });
});

describe("Submission inspector (GitHub + SSRF + Multimodal files)", () => {
  it("parses GitHub URLs and rejects SSRF private/local targets", () => {
    assert.deepEqual(parseGitHubUrl("https://github.com/acme/webapp/tree/dev/src"), {
      owner: "acme",
      repo: "webapp",
      ref: "dev",
      subpath: "src",
    });
    assert.equal(parseGitHubUrl("https://evil.com/acme/webapp"), null);

    assert.equal(isSafeExternalUrl("https://example.com/diagram.png"), true);
    assert.equal(isSafeExternalUrl("http://localhost:5001/api/health"), false);
    assert.equal(isSafeExternalUrl("http://127.0.0.1:8080/secret"), false);
    assert.equal(isSafeExternalUrl("http://169.254.169.254/latest/meta-data"), false);
    assert.equal(isSafeExternalUrl("http://10.0.0.5/internal"), false);
    assert.equal(isSafeExternalUrl("file:///etc/passwd"), false);
  });

  it("inspects accessible GitHub repo and uses GITHUB_TOKEN when configured", async () => {
    const authHeadersSeen = [];
    const mockFetch = async (url, init) => {
      authHeadersSeen.push(init?.headers?.Authorization || null);
      if (url.endsWith("/repos/acme/app")) {
        return new Response(
          JSON.stringify({
            full_name: "acme/app",
            private: true,
            default_branch: "main",
            language: "JavaScript",
            description: "Demo app",
          }),
          { status: 200 }
        );
      }
      if (url.includes("/git/trees/")) {
        return new Response(
          JSON.stringify({
            tree: [
              { type: "blob", path: "README.md" },
              { type: "blob", path: "src/auth.js" },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/commits")) {
        return new Response(
          JSON.stringify([{ sha: "abc12345", commit: { message: "feat: add jwt auth", author: { date: "2026-11-10T00:00:00Z" } } }]),
          { status: 200 }
        );
      }
      if (url.includes("/contents/")) {
        return new Response(
          JSON.stringify({
            encoding: "base64",
            content: Buffer.from("export const verifyJwt = () => true;").toString("base64"),
          }),
          { status: 200 }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    const prevToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "ghp_test_token";
    try {
      const report = await inspectGitHubRepository("https://github.com/acme/app", {
        milestone: { title: "JWT Auth", acceptanceCriteria: [{ criteria: "JWT auth middleware" }] },
        fetchImpl: mockFetch,
      });

      assert.equal(report.accessible, true);
      assert.equal(report.authMode, "authenticated");
      assert.ok(authHeadersSeen.every((h) => h === "Bearer ghp_test_token"));
      assert.equal(report.keyFiles.length, 2);
      assert.match(report.keyFiles[1].content, /verifyJwt/);
    } finally {
      if (prevToken === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = prevToken;
    }
  });

  it("reports private/inaccessible GitHub repo honestly instead of hallucinating", async () => {
    const mockFetch = async () => new Response("Not Found", { status: 404 });
    const prevToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    try {
      const report = await inspectGitHubRepository("https://github.com/acme/private-repo", {
        fetchImpl: mockFetch,
      });
      assert.equal(report.accessible, false);
      assert.match(report.accessError, /GITHUB_TOKEN/);
    } finally {
      if (prevToken !== undefined) process.env.GITHUB_TOKEN = prevToken;
    }
  });

  it("decodes inline text documents and inspects screenshots with vision model", async () => {
    const fakeVisionModel = {
      async invoke() {
        return { content: "Screenshot shows a login form with JWT validation success banner." };
      },
    };
    const files = [
      {
        filename: "notes.md",
        fileType: "document",
        url: `data:text/markdown;base64,${Buffer.from("# Test Pass\nAll 12 tests passed.").toString("base64")}`,
      },
      {
        filename: "login.png",
        fileType: "image",
        url: "data:image/png;base64,iVBORw0KGgo=",
      },
      {
        filename: "internal.txt",
        fileType: "document",
        url: "http://127.0.0.1:5001/secret",
      },
    ];

    const inspected = await inspectSubmissionFiles(files, {
      milestone: { title: "Auth", acceptanceCriteria: [{ criteria: "Login screen works" }] },
      visionModel: fakeVisionModel,
    });

    assert.equal(inspected[0].inspected, true);
    assert.match(inspected[0].summary, /All 12 tests passed/);
    assert.equal(inspected[1].inspected, true);
    assert.match(inspected[1].summary, /JWT validation success banner/);
    assert.equal(inspected[2].inspected, false);
    assert.match(inspected[2].summary, /blocked by safety filter/i);
  });
});

describe("LangGraph Milestone Generator workflow", () => {
  it("runs all nodes, retries validation via conditional edge, and matches budget exactly", async () => {
    let planningCalls = 0;

    const fakeInvokeStructured = async (schema, _messages, { name }) => {
      if (name === "requirement_analysis") {
        return {
          objectives: ["Build React site with auth and dashboard"],
          extractedBudget: 300,
          extractedCurrency: "USD",
          extractedDeadline: null,
          coreFeatures: ["Frontend Setup", "Auth", "Backend", "Dashboard"],
          technicalDependencies: ["Auth before Dashboard"],
          missingOrAmbiguousRequirements: ["Clarify OAuth providers"],
          riskFlags: ["Tight timeline"],
        };
      }
      if (name === "task_breakdown") {
        return {
          tasks: [
            {
              id: "T1",
              title: "React + Vite Setup",
              description: "Scaffold UI",
              phase: "foundation",
              complexityWeight: 4,
              dependencies: [],
              deliverables: ["Frontend repo"],
            },
            {
              id: "T2",
              title: "JWT Authentication",
              description: "Auth endpoints",
              phase: "backend",
              complexityWeight: 6,
              dependencies: ["T1"],
              deliverables: ["Auth API"],
            },
          ],
        };
      }
      if (name === "milestone_planning") {
        planningCalls += 1;
        if (planningCalls === 1) {
          // Force validation failure on attempt 1 (only 1 milestone for $300 budget)
          return {
            milestones: [
              {
                title: "Monolith Milestone",
                description: "Everything at once",
                weightPercentage: 100,
                estimatedDaysRatio: 1,
                deliverables: [{ title: "All code", description: "Everything" }],
                acceptanceCriteria: [{ criteria: "Works" }],
              },
            ],
          };
        }
        return {
          milestones: [
            {
              title: "Frontend Setup",
              description: "Setup React + Vite UI",
              weightPercentage: 20,
              estimatedDaysRatio: 0.25,
              deliverables: [{ title: "UI Skeleton", description: "Routes and layout" }],
              acceptanceCriteria: [{ criteria: "Builds without errors" }],
            },
            {
              title: "Authentication",
              description: "JWT login & registration",
              weightPercentage: 25,
              estimatedDaysRatio: 0.5,
              deliverables: [{ title: "Auth API", description: "Login & register" }],
              acceptanceCriteria: [{ criteria: "Passwords hashed with bcrypt" }],
            },
            {
              title: "Backend Integration",
              description: "Connect frontend & APIs",
              weightPercentage: 30,
              estimatedDaysRatio: 0.75,
              deliverables: [{ title: "API Client", description: "Connected flows" }],
              acceptanceCriteria: [{ criteria: "CRUD verified end-to-end" }],
            },
            {
              title: "Dashboard & Deployment",
              description: "Analytics and release",
              weightPercentage: 25,
              estimatedDaysRatio: 1,
              deliverables: [{ title: "Production Build", description: "Deployed app" }],
              acceptanceCriteria: [{ criteria: "Dashboard metrics match DB" }],
            },
          ],
        };
      }
      throw new Error(`Unexpected schema call: ${name}`);
    };

    const result = await generateMilestonePlan(
      {
        title: "React Website",
        description: "Build a React website with authentication and dashboard. Budget: $300.",
        budget: 300,
        currency: "USD",
        deadline: "2026-12-31T00:00:00.000Z",
      },
      { invokeStructured: fakeInvokeStructured }
    );

    assert.equal(planningCalls, 2);
    assert.equal(result.validation.passed, true);
    assert.equal(result.validation.attempts, 2);
    assert.equal(result.milestones.length, 4);

    const total = result.milestones.reduce((s, m) => s + m.paymentAmount, 0);
    assert.equal(total, 300);
    assert.deepEqual(result.requirementAnalysis.missingOrAmbiguousRequirements, [
      "Clarify OAuth providers",
    ]);
  });
});

describe("LangGraph Deliverable Evaluation workflow", () => {
  it("retrieves context, inspects repo & files, retries missing criteria, and computes deterministic score", async () => {
    let evalCalls = 0;

    const fakeContextLoader = async () => ({
      project: { _id: "p1", title: "React Website", description: "Auth & Dashboard" },
      milestone: {
        _id: "m1",
        order: 2,
        title: "Authentication System",
        description: "Implement auth",
        deliverables: [{ title: "Auth Routes", description: "JWT & bcrypt" }],
        acceptanceCriteria: [
          { criteria: "Login and registration working" },
          { criteria: "JWT authentication implemented" },
          { criteria: "MongoDB integration complete" },
        ],
      },
      submission: {
        _id: "s1",
        version: 1,
        githubUrl: "https://github.com/acme/auth-repo",
        files: [],
        notes: "Implemented login, registration, and JWT middleware. MongoDB pending.",
      },
      submissionHistory: [],
    });

    const fakeInspectRepo = async () => ({
      provided: true,
      url: "https://github.com/acme/auth-repo",
      accessible: true,
      accessError: null,
      repoInfo: { fullName: "acme/auth-repo", private: false, inspectedRef: "main", language: "JavaScript", totalFilesObserved: 5 },
      fileTree: ["src/auth.js", "src/jwt.js"],
      recentCommits: [{ sha: "1234567", message: "add login and jwt", date: "2026-11-10" }],
      keyFiles: [{ path: "src/auth.js", truncated: false, content: "login(); register(); verifyJwt();" }],
    });

    const fakeInvokeStructured = async (_schema, _messages, { name }) => {
      assert.equal(name, "deliverable_evaluation");
      evalCalls += 1;
      if (evalCalls === 1) {
        // Deliberately omit 3rd criterion to trigger verification conditional loop
        return {
          criteriaResults: [
            { criteria: "Login and registration working", met: true, comments: "Observed in src/auth.js" },
          ],
          improvementSuggestions: ["Connect MongoDB user store"],
          recommendations: "Request modifications.",
        };
      }
      return {
        criteriaResults: [
          { criteria: "Login and registration working", met: true, comments: "Observed login/register in src/auth.js" },
          { criteria: "JWT authentication implemented", met: true, comments: "Observed verifyJwt in src/auth.js" },
          { criteria: "MongoDB integration complete", met: false, comments: "Notes state MongoDB pending; no DB model found" },
        ],
        improvementSuggestions: ["Persist user accounts in MongoDB User collection"],
        recommendations: "Request modifications to complete MongoDB integration before approval.",
      };
    };

    const result = await evaluateDeliverableSubmission(
      { milestoneId: "m1" },
      {
        loadContext: fakeContextLoader,
        inspectGitHubRepository: fakeInspectRepo,
        inspectSubmissionFiles: async () => [],
        invokeStructured: fakeInvokeStructured,
      }
    );

    assert.equal(evalCalls, 2);
    assert.equal(result.verification.passed, true);
    assert.equal(result.evaluation.overallScore, 67);
    assert.equal(result.evaluation.completedRequirements.length, 2);
    assert.equal(result.evaluation.missingRequirements.length, 1);
    assert.match(result.evaluation.missingRequirements[0], /MongoDB integration complete/);
    assert.equal(result.evaluation.analysisMetadata.githubAccessible, true);
  });
});

describe("LangGraph Project Assistant workflow", () => {
  it("routes disagreement questions through disputeFocus and grounds answer in DB snapshot", async () => {
    const fakeContextLoader = async () => ({
      project: {
        _id: "p1",
        title: "SaaS Portal",
        description: "Full stack app",
        budget: 300,
        currency: "USD",
        deadline: "2026-12-31T00:00:00.000Z",
        status: "ACTIVE",
        agreement: { clientAccepted: true, freelancerAccepted: true },
        clientId: { name: "Alex" },
        freelancerId: { name: "Sam" },
      },
      milestones: [
        {
          _id: "m1",
          order: 1,
          title: "Auth",
          description: "JWT auth",
          paymentAmount: 100,
          status: "CHANGES_REQUESTED",
          deadline: "2026-11-01T00:00:00.000Z",
          deliverables: [],
          acceptanceCriteria: [{ criteria: "MongoDB integration", completed: false }],
        },
      ],
      submissions: [
        {
          _id: "s1",
          milestoneId: "m1",
          version: 1,
          status: "CHANGES_REQUESTED",
          githubUrl: "https://github.com/acme/repo",
          notes: "Auth ready",
          files: [],
        },
      ],
      evaluations: [
        {
          _id: "e1",
          milestoneId: "m1",
          overallScore: 67,
          completedRequirements: ["JWT"],
          missingRequirements: ["MongoDB integration — missing User schema"],
          recommendations: "Request modifications.",
          improvementSuggestions: ["Add Mongoose User model"],
        },
      ],
      payment: {
        status: "AUTHORIZED",
        totalAuthorized: 300,
        totalCaptured: 0,
        currency: "USD",
        captures: [],
      },
    });

    const promptsSeen = [];
    const fakeInvokeStructured = async (_schema, messages, { name }) => {
      if (name === "assistant_intent") {
        return { intent: "evaluation_disagreement", focusAreas: ["Auth"] };
      }
      if (name === "project_assistant_response") {
        promptsSeen.push(messages[1].content);
        return {
          answer: "Milestone #1 (Auth) was flagged because MongoDB integration lacked a User schema.",
          highlights: ["Status: CHANGES_REQUESTED", "Score: 67%"],
          suggestedNextSteps: ["Freelancer should add the Mongoose User model and resubmit v2."],
        };
      }
      throw new Error(`Unexpected schema: ${name}`);
    };

    const reply = await askProjectAssistant(
      {
        projectId: "p1",
        question: "Why did the evaluation flag missing requirements on Auth?",
        userRole: "freelancer",
      },
      { loadContext: fakeContextLoader, invokeStructured: fakeInvokeStructured }
    );

    assert.equal(reply.intent, "evaluation_disagreement");
    assert.match(reply.answer, /MongoDB integration/);
    assert.match(promptsSeen[0], /Agreement, Submission History, Evaluation Reports & Disagreement Analysis/);
  });
});

describe("aiController validation & security boundaries", () => {
  it("rejects invalid ObjectIds, missing questions, and missing GROQ_API_KEY cleanly", async () => {
    const prevGroq = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    try {
      // 1. Missing GROQ_API_KEY on preview returns 503 AIConfigError
      const previewRes = createMockRes();
      await previewMilestonesHandler(
        {
          user: { _id: "u1", role: "client" },
          body: { title: "App", description: "Build app", budget: 100 },
        },
        previewRes
      );
      assert.equal(previewRes.statusCode, 503);
      assert.match(previewRes.body.error, /GROQ_API_KEY/);

      // 2. Invalid projectId returns 400
      const genRes = createMockRes();
      await generateMilestonesHandler(
        { params: { projectId: "not-an-id" }, user: { _id: "u1" }, body: {} },
        genRes
      );
      assert.equal(genRes.statusCode, 400);

      // 3. Invalid milestoneId on evaluate & getEvaluation returns 400
      const evalRes = createMockRes();
      await evaluateSubmissionHandler(
        { params: { milestoneId: "bad-id" }, user: { _id: "u1" }, body: {} },
        evalRes
      );
      assert.equal(evalRes.statusCode, 400);

      const getEvalRes = createMockRes();
      await getEvaluation({ params: { milestoneId: "bad-id" }, user: { _id: "u1" } }, getEvalRes);
      assert.equal(getEvalRes.statusCode, 400);

      // 4. Missing question on assistant returns 400
      const assistRes = createMockRes();
      await projectAssistantHandler(
        {
          params: { projectId: "507f1f77bcf86cd799439011" },
          user: { _id: "u1", role: "client" },
          body: { question: "   " },
        },
        assistRes
      );
      assert.equal(assistRes.statusCode, 400);
    } finally {
      if (prevGroq !== undefined) process.env.GROQ_API_KEY = prevGroq;
    }
  });
});

