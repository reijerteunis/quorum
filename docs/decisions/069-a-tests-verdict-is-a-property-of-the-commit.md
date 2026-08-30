# A test's verdict is a property of the commit, not of the checkout or the account — 2026-08-30

**Decision:** A test's verdict must be a function of the commit under test, not of the checkout it
runs in or the account it runs as. Three merged changes have now violated this, each green through
implement, review, `integrate`'s `tests=ok` and at least one hand verification, and each found only
after landing: the existence of `.harness/worktrees` and `.quorum/runs`, which a working checkout
has and neither a fresh worktree nor a fresh clone does (Q-0072); `fs.existsSync` used to
*classify* a path, making a verdict a function of what the checkout happened to contain (Q-0073);
and `git merge --no-ff` resolving a committer identity, which macOS derives from the OS user record
and a Linux runner cannot (Q-0051's merge, which turned CI red).

**A test may read** the tracked-and-unignored inventory (`git ls-files --cached --others
--exclude-standard`, per *Membership is a git question, not a filesystem one*, 2026-08-28); its own
package's files; `os.tmpdir()`; the `git` binary's presence and its own output; a repository it
built itself; a `PATH` shim it installed itself; dependency versions the lockfiles declare; and
environment values it set itself.

**A test may not let its verdict depend on** git's identity resolution, in any config scope —
system, global, local, worktree — or from the OS user record; any other value from a git config it
did not set; the existence of a gitignored directory that *use* creates; the untracked or ignored
contents of the working tree; files in the runner's home directory; environment variables inherited
from a login shell; the operating system's user name, host name or locale; or state left by an
earlier test that is not an explicit shared fixture.

**Three uses of a machine property, and only one is the defect.** As a **fixture input** — building
a temp repository, choosing a temp path, pinning `git init -b main` — correct and unrestricted; a
test needing both a present and an absent case constructs both. To **refuse to run** — correct, and
required by *A check that skips its subject must not report success* (2026-08-25); this covers the
four checks Q-0073 deliberately left alone, `corpus.ts`'s `corpus missing: …`, and
`turbo-inputs.test.ts`'s *… proves nothing without it*. To **decide a verdict** — the defect. This
completes the ruling Q-0073 made half of: existence used to *refuse* is the rule, existence used to
*classify* is the defect, and the general form is that the machine may shape a fixture or stop a
run, and may never be the oracle.

**No single environment is strict, and an environment that certifies must first prove itself.**
Measured on git 2.55.0, darwin 25.3.0: ambient resolves the maintainer's identity; neutralising
global and system config still resolves `Ruud van Engelenhoven <…@Ruuds-MacBook-Pro.local>` from
the OS user record; adding `user.useConfigOnly=true` finally yields `Committer identity unknown`,
and the same environment with explicit `-c user.email=… -c user.name=…` yields `qa <q@a>`. Only
that last row discriminates. Two further holes were found in the strict row itself: an exported
`EMAIL` or `GIT_AUTHOR_NAME` survives every `GIT_CONFIG_*` variable, and `user.useConfigOnly`
forbids git from *inferring* an identity but not from *reading a configured* one, so a
repository-local or worktree-scoped `[user]` section makes a contributor's clone permissive while
this one is strict. **Therefore a hostile environment must demonstrate, before it certifies
anything, that it fails without explicit flags and succeeds with them.** `git var
GIT_COMMITTER_IDENT` is the probe: it resolves an identity and prints it without a repository, an
object, or a temp directory. A deliberate violation of the rule is entered in a register with a
per-entry reason, in the shape `turbo-inputs.test.ts`'s `NOT_READ` established — a list a reviewer
must approve, not a pattern that quietly excuses a class.

**The enforcement is a post-merge sweep plus one command at the gate, not `commands.test`.** This
repository has no pre-merge gate to attach one to: `main` advances by hand-made local merge commits
and CI runs on push, after the merge. Both requirement candidates called the guard "pre-merge" and
neither checked.

**Alternatives considered:** **Putting the hostile environment into `harness/harness.yaml`'s
`commands.test`, so `integrate` becomes the gate.** Rejected on three grounds: it makes an
unrelated ticket's gate red for a hazard its author cannot see in their own diff; it adds a second
reason that command differs from `package.json`'s, reversing part of *The test command defeats its
own cache, in configuration and not in the engine* (2026-08-27); and it runs the engine's own git
operations under a configuration no user's machine has. **A source scan as the primary instrument**
— every commit-creating git subcommand in a test must carry explicit identity flags. Rejected as
*primary* and kept as a successor: it catches the identity instance cheaply and cannot express the
other two, and this repository has measured what a scan guard costs — `turbo-inputs.test.ts` is
2,139 lines, took five implement rounds and four majors, and then produced Q-0073, an instance of
this very class, because the guard decided a verdict from `fs.existsSync`. Building the tripwire in
the same ticket as the oracle that would police it inverts the order. **A rule stated in
`harness/rules.md` and left to review to enforce.** Rejected: all three instances passed a
cross-vendor review that had the diff in front of it. **Naming the mechanism rather than the
shape** — "tests must set a git identity". Rejected: it describes instance 3 and neither of the
others, and the next instance will be a fourth mechanism.

**Why:** the three instances have a shape and no common mechanism, so a guard aimed at any one of
them would have missed the other two — which is why this is a rule with an environment behind it
rather than an assertion. The cost of the class is already measured: Q-0072 shipped a merge that
left `main` red and produced Q-0073; Q-0051's merge turned CI red four hours after Q-0038 closed a
different defect in the same subsystem. Each was invisible to every gate the project has, because
every gate runs on the machine that has the property. The rule is enforceable only by running the
suite somewhere the property is absent, which is why the decision names an environment and not a
lint. Its own drafting is the argument: the requirement had to defend the fix against this defect
three separate times — an exported `EMAIL`, a repository-local identity, and a proposal to put the
guard in `.github/scripts/port-freeze-guard.test.mjs`, a file nothing executes.
