import type { ReactNode } from "react";
import type { ApplicationDetail } from "../types";
import { exportUrl } from "../api";

type Props = {
  logo: ReactNode;
  application: ApplicationDetail | null;
  targetTitle: string;
  files: File[];
  wordCount: number;
  rawText: string;
  feedback: string;
  messages: { role: "user" | "amelia"; text: string }[];
  busy: boolean;
  onFeedback: (text: string) => void;
  onSend: () => void;
  onBuild: () => void;
  onVault: () => void;
  onDocument: () => void;
};

export default function AmeliaConversation(p: Props) {
  const app = p.application;
  const resume = app?.resume;
  const ready = app?.status === "ready";
  const failed = app?.status === "error";
  const processing = Boolean(app && !ready && !failed);
  const title = app?.title || p.targetTitle || "Choose your target role";
  const keywords = app?.parsed?.keywords ?? [];
  const pillars = resume?.sections.filter((section) => section.type === "skills")
    .flatMap((section) => section.type === "skills" ? section.groups.map((group) => group.label) : []).slice(0, 3) ?? [];
  const bullets = resume?.sections.flatMap((section) =>
    section.type === "experience" || section.type === "projects" ? section.items.flatMap((item) => item.bullets) : []).slice(0, 2) ?? [];
  const status = ready ? "RESUME READY" : failed ? "NEEDS ATTENTION" : processing ? "SYNTHESIZING RESUME" : "READY TO BUILD";
  return (
    <section className="amelia-conversation-view" aria-label="Chat with Amelia">
      <header className="conversation-header"><div>{p.logo}<small>Resume Strategist</small></div><button aria-label="Open Document Vault" onClick={p.onVault}>▱</button></header>
      <div className="conversation-target"><span>▢</span><div><small>TARGET ROLE <i /></small><strong>{title}</strong></div></div>
      <div className="conversation-thread">
        <div className="conversation-user">
          {app ? `Hey Amelia, can you curate my experience into a sharp, evidence-backed resume for ${title}?` : "Hey Amelia, help me turn my coursework, projects, and experience into a resume for my next role."}
          {p.files.length > 0 && <div className="conversation-attachments">{p.files.map((file, index) => <div key={index}><span>▤</span><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div>)}</div>}
        </div>
        <div className="conversation-agent-label">{p.logo}<span><i />{status}</span></div>
        <div className="conversation-agent">
          <p>{resume?.summary || (ready ? "Your tailored resume is ready to review." : failed ? app?.error_message || "Generation could not finish. Return to Build Resume to try again." : processing ? `I’m working through your uploaded evidence (${p.wordCount.toLocaleString()} words) and target role to prepare your resume.` : "Welcome! Add your source documents, current resume, and target role in Build Resume. I’ll help you shape and refine the result here.")}</p>
          <div className="conversation-fit"><header><span>⌁ ATS FIT CALIBRATION</span><strong>—</strong></header><div /><small>ATS score not yet available</small></div>
          <div className="conversation-insights"><div><h3>⊕ TOP PILLARS</h3>{pillars.length ? pillars.map((pillar) => <p key={pillar}>● {pillar}</p>) : <p>Your strongest themes will appear after generation.</p>}</div><div><h3>♧ EVIDENCE FIRST</h3><p>Refine your story using the experience in your uploaded sources.</p><span>SOURCE-BASED</span></div></div>
          <div className="conversation-resume-card">
            <header><span>{resume?.contact.name?.split(" ").map((part) => part[0]).slice(0, 2).join("") || "CV"}</span><div><strong>{resume?.contact.name || "Your resume"}</strong><small>{resume?.headline || "A tailored draft built from your experience"}</small></div>{app?.company && <b>{app.company} ALIGNED</b>}</header>
            <div className="conversation-transformation"><h3>✧ IMPACT TRANSFORMATION</h3><div className="conversation-raw"><h4>× YOUR SOURCE MATERIAL</h4><p>{p.rawText.trim().slice(0, 350) || "Upload your resume and project notes to give Amelia your starting point."}</p></div><div className="conversation-optimized"><h4>⊕ AMELIA SYNTHESIS</h4>{bullets.length ? bullets.map((bullet, index) => <p key={index}>{bullet}</p>) : <p>{processing ? "Your tailored draft is being prepared…" : "Your generated experience highlights will appear here."}</p>}</div><h4>TARGET ROLE KEYWORDS</h4><div className="conversation-keywords">{keywords.length ? keywords.slice(0, 8).map((word) => <span key={word}>{word}</span>) : <small>Available once the job description is analyzed.</small>}</div></div>
            {ready ? <><a className="conversation-pdf" href={exportUrl(app!.id, "resume.pdf")} download>▧ Inspect Full-Page Resume (PDF)</a><button className="conversation-edit" onClick={p.onDocument}>☷ Fine-tune Sections with Amelia</button></> : <button className="conversation-pdf" disabled={processing || p.busy} onClick={p.onBuild}>{processing ? "Preparing your resume…" : "Start building your resume →"}</button>}
          </div>
        </div>
        <div className="conversation-agent conversation-question">{ready ? "What would you like to emphasize next? I can refine a section, highlight a project, or make your experience more concise." : "Once your draft is ready, we can work together on the details that matter most for your target role."}</div>
        <p className="conversation-status" role="status">● {status}</p>
        <div className="conversation-prompts"><small>♧ SUGGESTED PROMPTS</small><div><button onClick={() => p.onFeedback("Highlight my strongest relevant project experience")}>ϟ Highlight project experience</button><button onClick={() => p.onFeedback("Make my resume more concise without losing evidence")}>◎ Make my resume more concise</button></div></div>
        {p.messages.map((message, index) => <div className={message.role === "user" ? "conversation-user" : "conversation-agent"} key={index}>{message.text}</div>)}
        <form className="conversation-composer" onSubmit={(event) => { event.preventDefault(); p.onSend(); }}><button type="button" aria-label="Add source documents" onClick={p.onBuild}>⊕</button><input aria-label="Refinement message" placeholder="Ask Amelia to refine or rewrite…" value={p.feedback} onChange={(event) => p.onFeedback(event.target.value)} /><button type="submit" aria-label="Send refinement" disabled={!ready || p.busy || !p.feedback.trim()}>↑</button></form>
      </div>
      <nav className="conversation-bottom" aria-label="Chat shortcuts"><button aria-current="page">▤<small>CHAT</small></button><button disabled={!ready} onClick={p.onDocument}>♧<small>DOCUMENT</small></button><button onClick={p.onVault}>▱<small>VAULT</small></button></nav>
    </section>
  );
}
