import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildProfile,
  createApplications,
  createProfile,
  exportUrl,
  getApplication,
  listProfiles,
  listVaultDocuments,
  saveVaultDocument,
  pasteJobText,
  regenerate,
  uploadDocument,
} from "../api";
import type { VaultDocument } from "../api";
import type { ApplicationDetail, ProfileSummary } from "../types";

import AmeliaChatWorkspace from "../components/AmeliaChatWorkspace";
import type { SourceFile } from "../components/AmeliaChatWorkspace";

const ACCESS_CODE = "Home";

type FlowStep = 2 | 3 | 4;
type ChatMessage = { role: "user" | "amelia"; text: string };

function AmeliaLogo() {
  return (
    <span className="amelia-logo">
      <svg className="amelia-logo-symbol" viewBox="35 35 565 525" aria-hidden="true" focusable="false">
        <path fill="#334394" d="M327 40 C378 37 406 57 430 108 L584 458 C600 488 598 510 580 529 C563 548 538 553 506 553 L485 553 C450 553 433 543 420 518 L306 260 Z" />
        <path fill="#222955" d="M316 278 C336 335 358 358 407 378 C472 405 558 423 584 458 C602 482 598 510 580 529 C563 548 538 553 506 553 L485 553 C450 553 433 543 420 518 Z" />
        <path fill="#465BA1" d="M327 40 C357 38 379 44 391 55 C419 81 383 157 360 202 L209 511 C195 540 173 553 136 554 L115 554 C83 553 63 546 50 526 C36 506 41 486 51 465 L238 100 C257 60 281 41 327 40 Z" />
      </svg>
      <span className="amelia-logo-name">Amelia AI <b>PRO</b></span>
    </span>
  );
}

function StepRail({ step, onSelect }: { step: FlowStep; onSelect: (step: FlowStep) => void }) {
  return (
    <nav className="amelia-steps" aria-label="Resume workspace">
      {([{ step: 2, label: "Build resume" }, { step: 3, label: "Chat" }, { step: 4, label: "Document Vault" }] as const).map((item) => (
        <button type="button" className={`amelia-step ${item.step === step ? "is-current" : ""}`}
          key={item.step} aria-current={item.step === step ? "page" : undefined}
          onClick={() => onSelect(item.step)}>
          <small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
}

export default function AmeliaFlowScreen() {
  const [step, setStep] = useState<FlowStep>(2);
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("amelia-unlocked") === "1");
  const [accessCode, setAccessCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [jobText, setJobText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [targetTitle, setTargetTitle] = useState("");
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [resumeText, setResumeText] = useState("");
  const wordCount = [resumeText, jobText, ...sources.map((source) => source.text)].join(" ").trim().split(/\s+/).filter(Boolean).length;
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [feedback, setFeedback] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  useEffect(() => {
    if (!unlocked || step !== 4) return;
    let cancelled = false;
    setVaultLoading(true);
    listVaultDocuments()
      .then((items) => { if (!cancelled) setDocuments(items); })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setVaultLoading(false); });
    return () => { cancelled = true; };
  }, [step, unlocked]);

  function unlock() {
    if (accessCode.trim().toLowerCase() !== ACCESS_CODE.toLowerCase()) {
      setError("That access code did not match.");
      return;
    }
    sessionStorage.setItem("amelia-unlocked", "1");
    setUnlocked(true);
    setError(null);
  }

  async function saveUpload(file: File | null, category: "Resume" | "Job description") {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { setError("Each file must be 25 MB or smaller."); return; }
    setUploading(true);
    setError(null);
    try {
      const saved = await saveVaultDocument(file, category);
      setDocuments((items) => [saved, ...items]);
      if (category === "Resume") { setResumeFile(file); setResumeText(saved.text); }
      else {
        setJobFile(file);
        setJobText(saved.text);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  }

  async function saveSources(files: File[]) {
    if (uploading || busy) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024 || !/\.(pdf|docx|txt|md)$/i.test(file.name)) {
          throw new Error("Use PDF, DOCX, TXT, or MD files up to 25 MB.");
        }
        const saved = await saveVaultDocument(file, "Coursework");
        setDocuments((items) => [saved, ...items]);
        setSources((items) => [...items, { id: saved.id, file, text: saved.text }]);
      }
    } catch (e) { setError(String(e)); }
    finally { setUploading(false); }
  }

  async function buildResume() {
    if (!resumeFile || (!jobText.trim() && !/^https?:\/\//i.test(jobUrl.trim()))) {
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
      for (const source of sources) await uploadDocument(profileId, source.file);
      await buildProfile(profileId);
      const [created] = await createApplications(
        profileId,
        [{ url: jobUrl.trim() || "https://local.test/job-description", depth: "standard", template: "slate" }],
        "standard",
        "slate",
        !jobText.trim()
      );
      const description = targetTitle.trim() ? `Preferred target role: ${targetTitle.trim()}\n\n${jobText}` : jobText;
      const queued = jobText.trim() ? await pasteJobText(created.id, description) : created;
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
        <AmeliaLogo />
        <h1>Your Strategic Career &amp; Resume Builder</h1>
        <div className="amelia-panel amelia-login-panel">
          <h2>Welcome back Maya</h2>
          <p className="amelia-muted">Sign in to resume targeting your dream roles</p>
          <label className="amelia-label" htmlFor="access-code">Keyword : Home</label>
          <div className="amelia-input-wrap">
            <svg className="amelia-login-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>
            <input
              id="access-code"
              className="amelia-input"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter Password"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
            />
            <button type="button" className="amelia-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>
              <svg className="amelia-login-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
            </button>
          </div>
          <button className="amelia-primary" onClick={unlock}>Log in to Amelia <span>→</span></button>
          {error && <p className="amelia-error">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="amelia-shell amelia-workspace">
      <header className="amelia-topbar">
        <button className="amelia-wordmark" onClick={() => setStep(2)}><AmeliaLogo /></button>
        <button className="amelia-quiet" onClick={() => { sessionStorage.removeItem("amelia-unlocked"); setUnlocked(false); }}>Lock</button>
      </header>
      <StepRail step={step} onSelect={(previous) => { setStep(previous); setError(null); }} />
      {error && <div className="amelia-error amelia-alert">{error}</div>}

      {step === 4 && (
        <section className="amelia-panel amelia-vault">
          <p className="amelia-eyebrow">YOUR DOCUMENTS</p>
          <h1>Document Vault</h1>
          <p className="amelia-muted">Your uploaded resumes and job descriptions, saved across visits.</p>
          {vaultLoading ? <p role="status">Loading documents...</p> : documents.length === 0 ? (
            <div className="amelia-vault-empty">
              <p>No uploaded files yet.</p>
              <button className="amelia-primary" onClick={() => setStep(2)}>Upload your first document</button>
            </div>
          ) : (
            <ul className="amelia-vault-list">
              {documents.map((document) => (
                <li key={document.id}>
                  <div><strong>{document.filename}</strong><small>{document.category} · {new Date(document.created_at).toLocaleDateString()}</small></div>
                  <a href={`/api/vault/${document.id}/download`} download>
                    {document.original_available ? "Download" : "Download saved text"}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === 3 && (
        <AmeliaChatWorkspace sources={sources} resumeFile={resumeFile} jobFile={jobFile}
          jobText={jobText} jobUrl={jobUrl} targetTitle={targetTitle} wordCount={wordCount}
          busy={busy || Boolean(application && !["ready", "error", "not_started"].includes(application.status))} uploading={uploading}
          onSources={(files) => { void saveSources(files); }}
          onRemoveSource={(id) => setSources((items) => items.filter((item) => item.id !== id))}
          onResume={(file) => { void saveUpload(file, "Resume"); }}
          onJob={(file) => { void saveUpload(file, "Job description"); }}
          onJobText={setJobText} onJobUrl={setJobUrl} onTargetTitle={setTargetTitle}
          onBuild={() => { void buildResume(); }} />
      )}

      {step === 2 && (
        <section className="amelia-resume-grid">
          <div>
            <p className="amelia-eyebrow">BUILD YOUR RESUME</p>
            <h1>Give Amelia<br />the raw material.</h1>
            <p className="amelia-muted">Upload the resume you have today and the job description you want to win. The generator selects from your evidence and keeps the write path truthful.</p>
          </div>
          <div className="amelia-panel amelia-form-panel">
            <label className="amelia-upload" htmlFor="resume-file">
              <span className="amelia-upload-icon">↑</span>
              <strong>{resumeFile ? resumeFile.name : "Upload your resume"}</strong>
              <small>PDF, DOCX, or TXT</small>
            </label>
            <input id="resume-file" type="file" accept=".pdf,.docx,.txt" disabled={uploading || busy} onChange={(e) => { void saveUpload(e.target.files?.[0] ?? null, "Resume"); e.target.value = ""; }} hidden />
            <label className="amelia-upload" htmlFor="job-file">
              <span className="amelia-upload-icon">↑</span>
              <strong>{jobFile ? jobFile.name : "Upload the job description"}</strong>
              <small>Or paste it below</small>
            </label>
            <input id="job-file" type="file" accept=".txt,.pdf,.docx" disabled={uploading || busy} onChange={(e) => { void saveUpload(e.target.files?.[0] ?? null, "Job description"); e.target.value = ""; }} hidden />
            <input className="amelia-input" placeholder="https://company.com/jobs/target-role" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
            <textarea className="amelia-textarea" placeholder="Paste the full job description here..." value={jobText} onChange={(e) => setJobText(e.target.value)} />
            <button className="amelia-primary" onClick={buildResume} disabled={busy || uploading}>{uploading ? "Saving document..." : busy ? "Building resume..." : "Synthesize my resume →"}</button>
          </div>
        </section>
      )}

      {step === 3 && application && (
        <section className="intake-results" aria-label="Resume conversation">
          <h2>Your resume with Amelia</h2>
          <p role="status">{application.status === "ready" ? "Your resume is ready to review." : application.status === "error" ? "Generation could not finish. Please try again." : "Amelia is preparing your resume…"}</p>
          {application.status === "ready" && <a href={exportUrl(application.id, "resume.pdf")} download>Download resume PDF</a>}
          {application.status === "ready" && <button onClick={() => navigate(`/applications/${application.id}`)}>Review and edit resume</button>}
          {chatMessages.map((message, index) => <p key={index}><strong>{message.role === "user" ? "You" : "Amelia"}:</strong> {message.text}</p>)}
          <div className="amelia-chat-row"><input className="amelia-input" aria-label="Refinement message" placeholder="Ask Amelia to refine or rewrite..." value={feedback} onChange={(e) => setFeedback(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendFeedback()} /><button className="amelia-send" onClick={sendFeedback} disabled={busy || application.status !== "ready" || !feedback.trim()} aria-label="Send refinement">↑</button></div>
        </section>
      )}

    </main>
  );
}
