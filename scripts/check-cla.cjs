const agreement =
  "https://github.com/thedavidweng/OpenLoop/blob/e63bda294370bbb27cc854934cc2607acc17441b/CLA.md";
const consent = "I have read the CLA Document and I hereby sign the CLA";
const marker = "<!-- openloop-cla:version1 -->\n";
const promptMarker = "<!-- openloop-cla-prompt:version1 -->";
const botID = 41898282;
const maintainerID = 95214375;
const exemptBots = new Set(["dependabot[bot]", "github-actions[bot]"]);
const isBot = (comment) => comment.user.id === botID && comment.user.type === "Bot";

module.exports = async ({ github, context }) => {
  const repo = context.repo;
  const number = context.issue.number;
  const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: number });
  if (pr.state !== "open") return;
  const sha = pr.head.sha;
  const status = (state, description) =>
    github.rest.repos.createCommitStatus({
      ...repo,
      sha,
      context: "CLA",
      state,
      description,
      target_url: `${context.serverUrl}/${repo.owner}/${repo.repo}/actions/runs/${context.runId}`,
    });
  await status("pending", "Checking contributor agreement signatures");
  let passed = false;
  try {
    const commits = await github.paginate(github.rest.pulls.listCommits, {
      ...repo,
      pull_number: number,
      per_page: 100,
    });
    if (commits.length !== pr.commits) throw new Error("GitHub did not return every PR commit");
    const authors = new Map();
    for (const commit of commits) {
      const author = commit.author;
      if (!author) throw new Error("A commit author has no linked GitHub identity");
      if (author.id === maintainerID) continue;
      if (author.type === "Bot" && exemptBots.has(author.login)) continue;
      if (author.type !== "User") throw new Error("Unrecognized contributor identity");
      authors.set(author.id, author);
    }
    if (pr.user.type === "User" && pr.user.id !== maintainerID && !authors.has(pr.user.id)) {
      throw new Error("The PR opener must be a linked commit author");
    }
    const comments = await github.paginate(github.rest.issues.listComments, {
      ...repo,
      issue_number: number,
      per_page: 100,
    });
    const prompts = comments.filter(
      (comment) =>
        isBot(comment) && comment.body.includes(promptMarker) && comment.body.includes(agreement),
    );
    const ledger = await github.paginate(github.rest.issues.listComments, {
      ...repo,
      issue_number: 262,
      per_page: 100,
    });
    const records = ledger
      .filter((comment) => isBot(comment) && comment.body.startsWith(marker))
      .map((comment) => JSON.parse(comment.body.slice(marker.length)))
      .filter((record) => record.agreement === agreement);
    const signing = context.payload.comment;
    if (context.eventName === "issue_comment" && signing.body === consent) {
      if (signing.user.type !== "User" || !authors.has(signing.user.id)) {
        throw new Error("Only a linked contributor may sign for their own GitHub identity");
      }
      if (
        !prompts.some((prompt) => Date.parse(prompt.created_at) <= Date.parse(signing.created_at))
      ) {
        throw new Error("Read the versioned CLA prompt before signing");
      }
      const record = {
        agreement,
        signer_id: signing.user.id,
        login: signing.user.login,
        pull_number: number,
        signed_at: signing.created_at,
        comment_url: signing.html_url,
      };
      if (
        !records.some(
          (entry) => entry.signer_id === record.signer_id && entry.pull_number === number,
        )
      ) {
        const body = marker + JSON.stringify(record);
        const saved = await github.rest.issues.createComment({ ...repo, issue_number: 262, body });
        const verified = await github.rest.issues.getComment({
          ...repo,
          comment_id: saved.data.id,
        });
        if (!isBot(verified.data) || verified.data.body !== body)
          throw new Error("CLA signature persistence could not be verified");
        records.push(record);
      }
    }
    const missing = [...authors.values()].filter(
      (author) =>
        !records.some(
          (record) =>
            record.signer_id === author.id &&
            (record.pull_number === number ||
              Date.parse(record.signed_at) <= Date.parse(pr.created_at)),
        ),
    );
    if (missing.length) {
      if (!prompts.length)
        await github.rest.issues.createComment({
          ...repo,
          issue_number: number,
          body: `${promptMarker}\n${missing.map((author) => "@" + author.login).join(", ")}: read the [CLA v1](${agreement}), then comment exactly:\n\n${consent}\n\nSignatures are recorded on #262. Historical contributions are not automatically signed.`,
        });
      throw new Error(
        "Contributor agreements are missing: " + missing.map((author) => author.login).join(", "),
      );
    }
    const latest = await github.rest.pulls.get({ ...repo, pull_number: number });
    if (latest.data.head.sha !== sha) throw new Error("The PR head changed during the CLA check");
    passed = true;
  } finally {
    await status(
      passed ? "success" : "failure",
      passed ? "Contributor agreements verified" : "Contributor agreements not verified",
    );
  }
};
module.exports.agreement = agreement;
module.exports.consent = consent;
