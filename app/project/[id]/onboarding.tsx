"use client";

import { useState } from "react";
import { useProject } from "./project-context";
import IntakeStage from "./intake";
import InterviewStage from "./interview";
import SynthesisStage from "./synthesis";

type Step = "intake" | "interview" | "synthesis";

export function Onboarding() {
  const { project, setOnboarded } = useProject();
  const initial: Step = (["intake", "interview", "synthesis"].includes(project.status)
    ? project.status
    : "intake") as Step;
  const [step, setStep] = useState<Step>(initial);

  async function finishOnboarding() {
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarded: true }),
    });
    setOnboarded();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Setup {step === "intake" ? "1" : step === "interview" ? "2" : "3"} of 3
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {step === "intake" ? "Client brief" : step === "interview" ? "A few questions" : "Business profile"}
        </h1>
      </div>
      {step === "intake" && (
        <IntakeStage
          project={project}
          onUpdate={(u) => {
            if (u && u.status === "interview") setStep("interview");
          }}
        />
      )}
      {step === "interview" && (
        <InterviewStage
          projectId={project.id}
          onUpdate={(u) => {
            if (u.status === "synthesis") setStep("synthesis");
          }}
        />
      )}
      {step === "synthesis" && (
        <SynthesisStage
          projectId={project.id}
          onUpdate={async (u) => {
            if (u.status === "research") await finishOnboarding();
            else if (u.status === "interview") setStep("interview");
          }}
        />
      )}
    </div>
  );
}
