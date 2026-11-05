import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { client } from "@/engine/client";
import { NoteUnavailableError } from "@/engine/static-client";
import type { ReconstructRequest } from "@/engine/types";

type Status = "idle" | "writing" | "done" | "failed" | "unavailable";

/** A short written reading of the computed values, generated on request. */
export function ExplainNote({ request }: { request: ReconstructRequest }) {
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  async function explain() {
    setStatus("writing");
    setText("");
    try {
      for await (const chunk of client.explain(request)) {
        if (!live.current) return;
        setText((t) => t + chunk);
      }
      if (live.current) setStatus("done");
    } catch (err) {
      if (live.current) setStatus(err instanceof NoteUnavailableError ? "unavailable" : "failed");
    }
  }

  const action = (label: string) => (
    <button
      type="button"
      onClick={() => void explain()}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm text-xs underline-offset-2 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      {label}
    </button>
  );

  return (
    <div className="mt-2.5 border-t pt-2.5" aria-live="polite">
      {status === "idle" ? (
        <Button
          variant="outline"
          className="h-[29px] w-full text-[12.5px] font-normal"
          onClick={() => void explain()}
        >
          Explain result
        </Button>
      ) : null}
      {status === "failed" ? (
        <p className="text-muted-foreground text-xs">
          Couldn&rsquo;t write a note. {action("Try again")}
        </p>
      ) : null}
      {status === "unavailable" ? (
        <p className="text-muted-foreground text-xs">A note isn&rsquo;t available for this run.</p>
      ) : null}
      {status === "writing" && !text ? (
        <p className="text-muted-foreground text-xs">Writing a note&hellip;</p>
      ) : null}
      {text && status !== "failed" && status !== "unavailable" ? (
        <>
          <p className="text-[12.5px] leading-[1.5]">{text}</p>
          {status === "done" ? (
            <p className="text-subtle mt-1.5 text-[11px]">
              Written by Gemini from RDKit facts and this run.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
