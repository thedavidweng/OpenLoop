const assert = require("node:assert/strict");
const check = require("./check-cla.cjs");
const user = { id: 101, login: "contributor", type: "User" };
const bot = { id: 41898282, login: "github-actions[bot]", type: "Bot" };
const marker = "<!-- openloop-cla:version1 -->\n";
const record = (overrides = {}, author = bot) => ({
  user: author,
  body:
    marker +
    JSON.stringify({
      agreement: check.agreement,
      signer_id: user.id,
      pull_number: 300,
      signed_at: "2026-10-06T00:00:00Z",
      ...overrides,
    }),
});
function fixture({
  ledger = [],
  authors = [user],
  comment,
  stale = false,
  storageFails = false,
  readbackFails = false,
  totalCommits = authors.length,
} = {}) {
  const statuses = [];
  const prompts = [
    {
      user: bot,
      body: "<!-- openloop-cla-prompt:version1 -->" + check.agreement,
      created_at: "2026-10-06T00:00:00Z",
    },
  ];
  let reads = 0;
  const pr = {
    state: "open",
    head: { sha: "checked-head" },
    user,
    created_at: "2026-10-07T00:00:00Z",
    commits: totalCommits,
  };
  const context = {
    repo: { owner: "thedavidweng", repo: "OpenLoop" },
    issue: { number: 300 },
    serverUrl: "https://github.com",
    runId: 1,
    eventName: comment ? "issue_comment" : "pull_request_target",
    payload: { comment },
  };
  const github = {
    rest: {
      pulls: {
        get: async () => ({
          data: { ...pr, head: { sha: stale && reads++ ? "new-head" : "checked-head" } },
        }),
        listCommits: async () => authors.map((author) => ({ author })),
      },
      repos: { createCommitStatus: async (value) => statuses.push(value) },
      issues: {
        listComments: async ({ issue_number }) => (issue_number === 262 ? ledger : prompts),
        createComment: async ({ issue_number, body }) => {
          if (issue_number === 262 && storageFails) throw new Error("Storage failed");
          const value = { id: ledger.length + 1, body, user: bot };
          (issue_number === 262 ? ledger : prompts).push(value);
          return { data: value };
        },
        getComment: async ({ comment_id }) => ({
          data: readbackFails
            ? { user, body: "altered" }
            : ledger.find((value) => value.id === comment_id),
        }),
      },
    },
    paginate: (method, args) => {
      assert.equal(args.per_page, 100);
      return method(args);
    },
  };
  return { github, context, statuses, ledger };
}
const signing = {
  body: check.consent,
  user,
  created_at: "2026-10-07T01:00:00Z",
  html_url: "https://github.com/thedavidweng/OpenLoop/pull/300#issuecomment-1",
};
(async () => {
  for (const options of [
    {},
    { totalCommits: 251 },
    { comment: signing, readbackFails: true },
    { comment: { ...signing, created_at: "2026-10-05T00:00:00Z" } },
    { ledger: [record({ pull_number: 299, signed_at: "2026-10-08T00:00:00Z" })] },
    { ledger: [record({}, user)] },
    { ledger: [record({ agreement: "wrong-version" })] },
    { ledger: [record({ signer_id: 102 })] },
    { authors: [null] },
    { ledger: [record()], authors: [user, { ...user, id: 102 }] },
    { ledger: [record()], stale: true },
    { comment: signing, storageFails: true },
    { comment: { ...signing, user: { ...user, id: 102 } } },
  ]) {
    const test = fixture(options);
    await assert.rejects(check(test));
    assert.equal(test.statuses.at(-1).state, "failure");
    assert(test.statuses.every((value) => value.sha === "checked-head"));
  }
  const test = fixture({ comment: signing });
  await check(test);
  assert.equal(test.ledger.length, 1);
  assert.equal(test.statuses.at(-1).state, "success");
  const later = fixture({ ledger: [record({ pull_number: 299 })] });
  await check(later);
  assert.equal(later.statuses.at(-1).state, "success");
  const many = fixture({
    ledger: [...Array.from({ length: 101 }, () => ({ user, body: "noise" })), record()],
  });
  await check(many);
  assert.equal(many.statuses.at(-1).state, "success");
  console.log(
    "CLA checks passed: identity, forged/versioned records, all authors, persistence, stale head and reuse.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
