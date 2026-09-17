import { lazy, Suspense } from "react";
import { AnnotatedText } from "@/components/ui/annotated-text";
import { SplitFlapDisplay } from "@/components/ui/split-flap-display";
import {
  Blocks,
  Bug,
  ChartNoAxesColumn,
  Code2,
  type LucideIcon,
} from "lucide-react";
import { Link } from "../router.tsx";
import { Mark, ThemeToggle, WhenSeen } from "../ui.tsx";
import { LiveRun } from "./LiveRun.tsx";

const AsciiObserver = lazy(() => import("./AsciiObserver.tsx"));
const LoomField = lazy(() => import("./LoomField.tsx"));

const REPO = "https://github.com/Hrithik0112/AgentLoom";

/** Real log lines, in the shape and volume you actually get back from a framework. */
const LOG_WALL = [
  '[14:23:01.204] node=classify_intent state={"ticket":"I was charged twi...',
  "[14:23:01.208] llm.request model=claude-opus-5 tokens_in=284",
  "[14:23:02.611] llm.response tokens_out=3 stop_reason=end_turn",
  '[14:23:02.613] node=classify_intent result={"intent":"billing","conf":0.73}',
  "[14:23:02.615] node=route_by_intent evaluating 3 conditions",
  '[14:23:02.615] cond[0] intent=="billing" && conf>0.85 -> false',
  '[14:23:02.616] cond[1] intent=="technical" -> false',
  "[14:23:02.616] cond[2] fallback -> true",
  "[14:23:02.617] edge route_by_intent --else--> escalate_to_human",
  '[14:23:02.619] node=escalate_to_human state={"ticket":"I was charged t...',
  "[14:23:02.620] queue.push channel=support-tier2 priority=normal",
  '[14:23:02.622] node=escalate_to_human result={"queued":true}',
  "[14:23:02.624] edge escalate_to_human --> compose_holding_reply",
  '[14:23:02.625] node=compose_holding_reply state={"ticket":"I was charg...',
  "[14:23:02.628] llm.request model=claude-opus-5 tokens_in=412",
];

const STEPS = [
  { n: 0, label: "ticket in", note: "" },
  { n: 1, label: "classify intent", note: "billing, 0.73" },
  { n: 2, label: "route", note: "else", flagged: true },
  { n: 3, label: "human gate", note: "queued" },
  { n: 4, label: "holding reply", note: "" },
];

const MODES: { name: string; icon: LucideIcon; body: string }[] = [
  {
    name: "Build",
    icon: Blocks,
    body: "Seven node types, wired on a canvas. Every card shows what it reads, what it writes, and what it has actually cost you so far.",
  },
  {
    name: "Debug",
    icon: Bug,
    body: "Breakpoints, a state diff per step, and the fully rendered prompt for every model call. Post interpolation, exactly what went over the wire.",
  },
  {
    name: "Analyze",
    icon: ChartNoAxesColumn,
    body: "Where requests actually go across many runs, which nodes burn the time and money, and a scorecard comparing two versions on one test suite.",
  },
];

function Command({ children }: { children: string }) {
  return (
    <code className="block font-mono text-ui text-text">
      <span className="select-none text-text-faint">$ </span>
      {children}
    </code>
  );
}

export default function Landing() {
  return (
    <div className="min-h-full bg-surface font-grotesk">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5">
        <Mark size={20} />
        <span className="text-title font-semibold tracking-tight text-text">
          agentloom
        </span>
        <nav className="ml-auto flex items-center gap-1">
          <a
            href={REPO}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-meta text-text-dim transition-colors hover:bg-raised hover:text-text"
          >
            <Code2 size={14} aria-hidden />
            Source
          </a>
          <Link
            to="/app"
            className="rounded-md border border-line bg-raised px-3 py-1.5 text-meta text-text transition-colors hover:border-line-strong hover:bg-elevated"
          >
            Open the debugger
          </Link>
          <div className="ml-1">
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="pt-16 pb-12">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <div>
              <h1 className="m-0 max-w-3xl text-h1 font-semibold tracking-[-0.025em] text-text">
                Your agent answered wrong at step 12. Which of{" "}
                <AnnotatedText
                  variant="underline"
                  color="text-halt"
                  delay={0.35}
                  duration={0.9}
                  className="whitespace-nowrap"
                >
                  the other eleven
                </AnnotatedText>{" "}
                broke it?
              </h1>
              <p className="mt-6 max-w-[58ch] text-lede text-text-dim">
                AgentLoom is a debugger for AI agent workflows. Step through a
                run, read the state at every node, change it mid flight, and
                replay from that point without paying again for the steps in
                front of it.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/app"
                  className="rounded-lg border border-live/40 bg-live/12 px-4 py-2 text-ui font-medium text-live transition-colors hover:bg-live/20"
                >
                  Open the debugger
                </Link>
                <a
                  href={REPO}
                  className="rounded-lg border border-line bg-raised px-4 py-2 text-ui text-text transition-colors hover:border-line-strong hover:bg-elevated"
                >
                  Read the source
                </a>
                <span className="text-meta text-text-faint">
                  No sign up. No API key to look around.
                </span>
              </div>
            </div>

            <div className="hidden justify-self-center lg:block">
              <Suspense
                fallback={
                  <div className="aspect-square w-full max-w-[340px]" />
                }
              >
                <AsciiObserver />
              </Suspense>
            </div>
          </div>

          <div className="mt-12">
            <LiveRun />
          </div>
        </section>

        <section className="border-t border-line py-16">
          <h2 className="m-0 max-w-2xl text-h2 font-semibold tracking-[-0.02em] text-text">
            You have logs. You do not have a debugger.
          </h2>
          <p className="mt-4 max-w-[60ch] text-ui leading-relaxed text-text-dim">
            Both panels below describe the same failing run. On the left is what
            the framework gave you. On the right is the same execution as steps,
            with the branch that went the wrong way marked.
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-xl border border-line bg-panel">
              <div className="border-b border-line px-4 py-2.5 text-meta text-text-dim">
                agent.log
              </div>
              <div className="space-y-0.5 px-4 py-3">
                {LOG_WALL.map((line) => (
                  <p
                    key={line}
                    className="m-0 truncate font-mono text-micro text-text-faint"
                  >
                    {line}
                  </p>
                ))}
              </div>
              {/* The fade is the honest part: the wall does not end, you just stop reading. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-panel to-transparent" />
            </div>

            <div className="overflow-hidden rounded-xl border border-line bg-panel">
              <div className="border-b border-line px-4 py-2.5 text-meta text-text-dim">
                Same run, as steps
              </div>
              <ol className="m-0 list-none p-0">
                {STEPS.map((s) => (
                  <li
                    key={s.n}
                    className={`flex items-center gap-3 border-b border-line/50 px-4 py-2.5 last:border-b-0 ${
                      s.flagged ? "bg-halt/10" : ""
                    }`}
                  >
                    <span className="tnum w-4 text-right font-mono text-micro text-text-faint">
                      {s.n}
                    </span>
                    <span
                      className={`flex-1 text-ui ${s.flagged ? "text-halt" : "text-text"}`}
                    >
                      {s.label}
                    </span>
                    {s.note && (
                      <span
                        className={`font-mono text-micro ${s.flagged ? "text-halt" : "text-text-faint"}`}
                      >
                        {s.note}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              <p className="m-0 border-t border-line px-4 py-3 text-meta text-text-dim">
                Confidence came back at 0.73. The threshold was 0.85, so routing
                fell through to the human queue.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-line py-16">
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_auto]">
            <div>
              <h2 className="m-0 max-w-2xl text-h2 font-semibold tracking-[-0.02em] text-text">
                Change the threshold at step 3. Do not re-pay for steps 1 and 2.
              </h2>
              <p className="mt-4 max-w-[60ch] text-ui leading-relaxed text-text-dim">
                AgentLoom snapshots the full state before every step. Rewinding
                means starting a fresh run from one of those snapshots, so the
                steps in front of your change never execute a second time. Edit
                the state by hand, resume, and watch the run take the other
                branch.
              </p>
              <p className="mt-4 max-w-[60ch] text-ui leading-relaxed text-text-dim">
                The same machinery gives you breakpoints and human approval
                gates, because pausing is just the caller deciding not to ask
                for the next step yet.
              </p>
            </div>

            <div className="min-w-0 justify-self-stretch lg:justify-self-end">
              {/* The board is a fixed 643px. Without its own scroller it drags the whole
                  page sideways on a phone. */}
              {/* The board flips from blank on mount, so it waits until it is on screen.
                  Otherwise the flip is over before anyone has scrolled this far. */}
              <WhenSeen
                minHeight={116}
                className="-mx-6 overflow-x-auto px-6 lg:mx-0 lg:px-0"
              >
                <SplitFlapDisplay
                  size="sm"
                  columns={20}
                  accentColor="#4ade80"
                  rows={[
                    { label: "FULL RERUN", value: "$0.42" },
                    { label: "REPLAY AT 3", value: "$0.06" },
                  ]}
                />
              </WhenSeen>
              <p className="mt-3 max-w-[26ch] text-meta text-text-faint">
                One twelve step run, changed at step three, on Claude Opus.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-line py-16">
          <h2 className="m-0 text-h2 font-semibold tracking-[-0.02em] text-text">
            Three modes, one graph
          </h2>
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
            {MODES.map((m) => (
              <div key={m.name} className="bg-panel p-5">
                <m.icon size={18} aria-hidden className="mb-3 text-text-dim" />
                <h3 className="m-0 text-title font-medium text-text">
                  {m.name}
                </h3>
                <p className="mt-2 m-0 text-meta leading-relaxed text-text-dim">
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line py-16">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div>
              <h2 className="m-0 text-h2 font-semibold tracking-[-0.02em] text-text">
                Run it locally
              </h2>
              <p className="mt-4 max-w-[52ch] text-ui leading-relaxed text-text-dim">
                It is a static site. The workflow engine runs in your browser,
                your API key stays in that browser, and nothing is sent anywhere
                except to Anthropic.
              </p>
              <p className="mt-4 max-w-[52ch] text-ui leading-relaxed text-text-dim">
                Leave the key out and runs execute against canned responses
                instead, which is enough to walk every branch in the bundled
                examples.
              </p>
            </div>
            <div className="space-y-1.5 rounded-xl border border-line bg-panel p-5">
              <Command>git clone github.com/Hrithik0112/AgentLoom</Command>
              <Command>npm install</Command>
              <Command>npm run dev</Command>
              <p className="mt-4 m-0 border-t border-line pt-4 text-meta text-text-faint">
                <code className="font-mono text-text-dim">npm run check</code>{" "}
                runs the engine's self checks with no browser and no key.
              </p>
            </div>
          </div>
        </section>
        <section className="relative overflow-hidden border-t border-line py-24">
          {/* A loom is threads under tension finding their alignment. These do the same
              thing against the cursor, which is the only decoration on the page that
              earns its place by being about the subject. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-45"
          >
            <Suspense fallback={null}>
              <LoomField />
            </Suspense>
          </div>

          <div className="relative flex flex-col items-center gap-5 text-center">
            <h2 className="m-0 max-w-[22ch] text-h2 font-semibold tracking-[-0.02em] text-text">
              Stop reading logs to find step seven.
            </h2>
            <p className="m-0 max-w-[46ch] text-lede text-text-dim">
              Open a workflow, set a breakpoint, and watch the state change.
            </p>
            <Link
              to="/app"
              className="rounded-lg border border-live/40 bg-live/12 px-5 py-2.5 text-ui font-medium text-live transition-colors hover:bg-live/20"
            >
              Open the debugger
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6">
        {/* Border on the inner element so it lines up with the section rules above it. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line py-8 text-meta text-text-faint">
          <span>AgentLoom</span>
          <a href={REPO} className="transition-colors hover:text-text-dim">
            Source
          </a>
          <Link to="/app" className="transition-colors hover:text-text-dim">
            Debugger
          </Link>
          <span className="ml-auto">
            Built with React Flow and the Claude API.
          </span>
        </div>
      </footer>
    </div>
  );
}
