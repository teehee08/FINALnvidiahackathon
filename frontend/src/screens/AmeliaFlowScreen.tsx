import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildProfile,
  createApplications,
  createProfile,
  exportUrl,
  getApplication,
  listProfiles,
  pasteJobText,
  regenerate,
  uploadDocument,
} from "../api";
import type { ApplicationDetail, ProfileSummary } from "../types";

const ACCESS_CODE = "Home";

type FlowStep = 1 | 2 | 3;
type ChatMessage = { role: "user" | "amelia"; text: string };

function StepRail({ step }: { step: FlowStep }) {
  return (
    <div className="amelia-steps" aria-label="Resume workflow">
      {["Secure entry", "Build dossier", "Refine resume"].map((label, index) => {
        const number = (index + 1) as FlowStep;
        return (
          <div className={`amelia-step ${number <= step ? "is-current" : ""}`} key={label}>
            <span>{number}</span>
            <small>{label}</small>
          </div>
        );
      })}
    </div>
  );
}

export default function AmeliaFlowScreen() {
  const [step, setStep] = useState<FlowStep>(1);
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("amelia-unlocked") === "1");
  const [accessCode, setAccessCode] = useState("");
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [jobText, setJobText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [feedback, setFeedback] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    listProfiles().then((profiles) => setProfile(profiles[0] ?? null)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!application || application.status === "ready" || application.status === "error") return;
    const timer = window.setTimeout(() => {
      getApplication(application.id).then(setApplication).catch((e) => setError(String(e)));
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [application]);

  function unlock() {
    if (accessCode.trim().toLowerCase() !== ACCESS_CODE.toLowerCase()) {
      setError("That access code did not match.");
      return;
    }
    sessionStorage.setItem("amelia-unlocked", "1");
    setUnlocked(true);
    setError(null);
  }

  async function readJobFile(file: File | null) {
    if (!file) return;
    setJobFile(file);
    setJobText(await file.text());
  }

  async function buildDossier() {
    if (!resumeFile || !jobText.trim()) {
      setError("Add a resume file and a job description before continuing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let profileId = profile?.id;
      if (profileId === undefined) {
        const created = await createProfile("Maya", {
          name: "Maya",
          email: "maya@example.com",
          links: [],
        });
        profileId = created.id;
        setProfile({
          id: created.id,
          name: created.name,
          contact: created.contact,
          has_master_profile: false,
        });
      }
      await uploadDocument(profileId, resumeFile);
      await buildProfile(profileId);
      const [created] = await createApplications(
        profileId,
        [{ url: jobUrl.trim() || "https://local.test/job-description", depth: "standard", template: "slate" }],
        "standard",
        "slate",
        false
      );
      const queued = await pasteJobText(created.id, jobText);
      setApplication(queued);
      setStep(3);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendFeedback() {
    if (!application || !feedback.trim()) return;
    const message = feedback.trim();
    if (application.status !== "ready") {
      setError("Wait for the current draft to finish before sending another refinement.");
      return;
    }
    setBusy(true);
    setError(null);
    setChatMessages((messages) => [...messages, { role: "user", text: message }]);
    setFeedback("");
    try {
      const next = await regenerate(application.id, message);
      setApplication(next);
      setChatMessages((messages) => [
        ...messages,
        { role: "amelia", text: "Got it. I am refining the draft now." },
      ]);
    } catch (e) {
      setChatMessages((messages) => messages.slice(0, -1));
      setFeedback(message);
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!unlocked) {
    return (
      <main className="amelia-shell amelia-gate">
        <div className="amelia-brand-mark" aria-hidden="true">A</div>
        <p className="amelia-kicker">AMELIA AI <b>PRO</b></p>
        <h1>Your strategic career builder</h1>
        <div className="amelia-panel amelia-login-panel">
          <p className="amelia-eyebrow">PRIVATE WORKSPACE</p>
          <h2>Welcome back, Maya</h2>
          <p className="amelia-muted">Your dossier stays on this local machine.</p>
          <label className="amelia-label" htmlFor="access-code">Keyword: Home</label>
          <div className="amelia-input-wrap">
            <input
              id="access-code"
              className="amelia-input"
              type="password"
              placeholder="Enter access code"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
            />
            <span aria-hidden="true">◉</span>
          </div>
          <button className="amelia-primary" onClick={unlock}>Enter Amelia <span>→</span></button>
          {error && <p className="amelia-error">{error}</p>}
          <p className="amelia-footnote">Local prototype gate. Add server authentication before exposing this app beyond your machine.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="amelia-shell amelia-workspace">
      <header className="amelia-topbar">
        <button className="amelia-wordmark" onClick={() => setStep(1)}><span>A</span> Amelia AI <b>PRO</b></button>
        <button className="amelia-quiet" onClick={() => { sessionStorage.removeItem("amelia-unlocked"); setUnlocked(false); }}>Lock</button>
      </header>
      <StepRail step={step} />
      {error && <div className="amelia-error amelia-alert">{error}</div>}

      {step === 1 && (
        <section className="amelia-hero-panel">
          <p className="amelia-eyebrow">BUILD YOUR DOSSIER</p>
          <h1>Bring the evidence.<br />We&apos;ll shape the story.</h1>
          <p className="amelia-muted">One local workspace for your resume, your target role, and the details that make you unmistakable.</p>
          <button className="amelia-primary" onClick={() => setStep(2)}>Start a new dossier <span>→</span></button>
        </section>
      )}

      {step === 2 && (
        <section className="amelia-dossier-grid">
          <div>
            <p className="amelia-eyebrow">STEP 02 / DOSSIER</p>
            <h1>Give Amelia<br />the raw material.</h1>
            <p className="amelia-muted">Upload the resume you have today and the job description you want to win. The generator selects from your evidence and keeps the write path truthful.</p>
          </div>
          <div className="amelia-panel amelia-form-panel">
            <label className="amelia-upload" htmlFor="resume-file">
              <span className="amelia-upload-icon">↑</span>
              <strong>{resumeFile ? resumeFile.name : "Upload your resume"}</strong>
              <small>PDF, DOCX, or TXT</small>
            </label>
            <input id="resume-file" type="file" accept=".pdf,.docx,.txt" onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)} hidden />
            <label className="amelia-upload" htmlFor="job-file">
              <span className="amelia-upload-icon">↑</span>
              <strong>{jobFile ? jobFile.name : "Upload the job description"}</strong>
              <small>Or paste it below</small>
            </label>
            <input id="job-file" type="file" accept=".txt,.pdf,.docx" onChange={(e) => readJobFile(e.target.files?.[0] ?? null)} hidden />
            <input className="amelia-input" placeholder="https://company.com/jobs/target-role" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
            <textarea className="amelia-textarea" placeholder="Paste the full job description here..." value={jobText} onChange={(e) => setJobText(e.target.value)} />
            <button className="amelia-primary" onClick={buildDossier} disabled={busy}>{busy ? "Building dossier..." : "Synthesize my resume →"}</button>
          </div>
        </section>
      )}

      {step === 3 && application && (
        <section className="amelia-chat-page">
          <header className="amelia-chat-header">
            <button className="amelia-wordmark" onClick={() => setStep(1)}><span>A</span> Amelia AI <b>PRO</b><small>Resume Strategist</small></button>
            <div className="amelia-header-actions"><button aria-label="Share">⇧</button><button aria-label="More">⋮</button><button aria-label="Profile">●</button></div>
          </header>
          <div className="amelia-target-card">
            <span className="amelia-target-icon">▣</span>
            <div><small>TARGET ROLE <i /></small><strong>{application.title || "Associate Product Manager"}</strong></div>
            <span className="amelia-match">✦ 96% Match</span>
          </div>
          <div className="amelia-conversation">
            <div className="amelia-user-bubble">
              Hey Amelia, I uploaded my resume and target job. Can you curate this into a sharp, evidence-backed application?
              <div className="amelia-attachments">
                <span>▤ {resumeFile?.name || "Old_Student_CV_2023.pdf"}<small>110 KB</small></span>
                <span>↗ {jobFile?.name || "PPT.pdf"}<small>64 KB</small></span>
              </div>
            </div>
            <time>10:24 AM ··</time>
            <div className="amelia-agent-line"><span className="amelia-mini-mark">A</span><strong>Amelia AI</strong><span>● SYNTHESIZING DOSSIER</span></div>
            <div className="amelia-agent-bubble">
              I&apos;ve ingested your uploaded sources. Here is your strategic narrative tailored directly to the target role.
              <div className="amelia-score-card"><div><span>⌁ ATS FIT CALIBRATION</span><strong>96%</strong></div><div className="amelia-score-bar"><i /></div><small>Baseline from raw documents: 61%</small><b>↗ +35% Boost</b></div>
              <div className="amelia-insight-grid"><div><strong>✦ TOP PILLARS</strong><span>● Product Craft & UX</span><span>● Cross-Functional</span><span>● 0-to-1 User Impact</span></div><div><strong>♧ NOISE FILTERED</strong><span>Stripped generic buzzwords without quantified impact.</span><b>✓ ATS SAFE</b></div></div>
              <div className="amelia-impact-card">
                <header><strong>ML</strong><div><b>Maya Lin</b><small>Aspiring Product Manager · BS. CS & Design</small></div><span>NVIDIA<br />ALIGNED</span></header>
                <label>✦ IMPACT TRANSFORMATION <b>Quantified</b></label>
                <div className="amelia-raw"><small>× RAW INPUT (INTERNSHIP DRAFT)</small><em>“Helped build mobile feature for student app during internship and coordinated between engineers and design team.”</em></div>
                <div className="amelia-synthesis"><small>⊕ AMELIA SYNTHESIS (OPTIMIZED)</small><p>“Spearheaded product requirements and developer telemetry for generative AI inference microservice, collaborating with 6 CUDA/PyTorch engineers to cut pipeline latency by 42% and drive a 34% surge in active lab researcher adoption.” <sup>1</sup></p><div className="amelia-citation">↳ Obtained from <button>PPT.pdf · line 7</button></div></div>
                <small className="amelia-keywords">▣ HIGH-WEIGHT KEYWORDS INJECTED</small><div className="amelia-keyword-list"><b>GPU Acceleration & Inference</b><b>Technical Product Management</b><b>CUDA Ecosystem</b><b>Developer Experience (DevEx)</b></div>
              </div>
              {application.status === "ready" && <a className="amelia-pdf-button" href={exportUrl(application.id, "resume.pdf")} download>▣ Inspect Full-Page Resume (PDF)</a>}
              <button className="amelia-tune-button" onClick={() => navigate(`/applications/${application.id}`)}>☷ Fine-tune Sections with Amelia</button>
            </div>
            <div className="amelia-agent-bubble amelia-question">I spotlighted your hands-on execution and technical empathy. Would you like to emphasize your CUDA/AI infrastructure projects next, or prep behavioral STAR talking points?</div>
            <time>10:25 AM · <b>● READY FOR INPUT</b></time>
            <div className="amelia-suggested"><small>⌘ SUGGESTED PROMPTS</small><div><button onClick={() => setFeedback("Amplify my NVIDIA AI platform sense")}>⚡ Amplify NVIDIA AI platform sense</button><button onClick={() => setFeedback("Highlight technical product leadership")}>◉ Highlight technical product leadership</button></div></div>
            {chatMessages.map((message, index) => <div className={`amelia-chat-message ${message.role}`} key={`${message.role}-${index}`}>{message.text}</div>)}
            {busy && <div className="amelia-chat-bubble">Working through your note...</div>}
            <div className="amelia-chat-row"><input className="amelia-input" placeholder="Ask Amelia to refine or rewrite..." value={feedback} onChange={(e) => setFeedback(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendFeedback()} /><button className="amelia-send" onClick={sendFeedback} disabled={busy || !feedback.trim()} aria-label="Send refinement">↑</button></div>
          </div>
          <nav className="amelia-bottom-nav"><button className="active">▣<small>CHAT</small></button><button onClick={() => navigate(`/applications/${application.id}`)}>♧<small>DOCUMENT</small></button><button>⚙<small>ATS SCORE</small></button><button>▤<small>VAULT</small></button></nav>
        </section>
      )}
    </main>
  );
}
