import { FakeLLM } from "../../packages/engine/index.ts";

/**
 * Stand-in for a real model when no API key is set. Enough to exercise every branch in
 * the bundled examples, so the debugger is usable (and demoable) before anyone pays.
 */
export const demoLLM = () =>
  new FakeLLM(
    [
      ["Classify", "billing"],
      [
        "billing reply",
        "Sorry about the double charge. I have refunded the duplicate.",
      ],
      ["troubleshooting", "Try clearing the app cache, then reopen settings."],
      [
        "three concrete facts",
        "It survives vacuum. It predates trees. It is under a millimetre long.",
      ],
      ["Summarize", "Both subjects are older and stranger than they look."],
    ],
    "demo response (no API key set)",
  );
