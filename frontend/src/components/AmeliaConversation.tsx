import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { ApplicationDetail } from "../types";

export type ConversationMessage = {
  role: "user" | "amelia";
  text: string;
  application?: ApplicationDetail;
  rawText?: string;
  files?: { name: string; size: number }[];
};

type Props = {
  logo: ReactNode;
  application: ApplicationDetail | null;
  targetTitle: string;
  files: File[];
  wordCount: number;
  rawText: string;
  feedback: string;
  messages: ConversationMessage[];
  replyPending: boolean;
  replyError: string | null;
  onRetry: () => void;
  busy: boolean;
  onFeedback: (text: string) => void;
  onSend: () => void;
  onBuild: () => void;
  onVault: () => void;
  onDocument: () => void;
};

/* ── Hardcoded demo data matching the design image ── */

const HARDCODED_USER_FILES = [
  { name: "Old_Student_CV_2023.pdf", size: 118 * 1024 },
  { name: "Campus_Startup_APM_Logs.txt", size: 64 * 1024 },
  { name: "CUDA_AI_Hackathon_Spec.md", size: 348 * 1024 },
  { name: "NVIDIA_APM_Job_Description.url", size: 0, isTargetJD: true },
];

const HARDCODED_AMELIA_TEXT =
  "I've ingested all 4 files (4,150 words of coursework, product specs & raw notes). " +
  "Here is your strategic narrative tailored directly to NVIDIA's culture of full-stack " +
  "AI computing, GPU platform ecosystem, deep technical empathy, and 0-to-1 product execution:";

const HARDCODED_RAW_INPUT =
  '"Helped build mobile feature for student app during internship and coordinated between engineers and design team."';

const HARDCODED_OPTIMIZED =
  '"Spearheaded product requirements and developer telemetry for campus generative AI inference microservice, ' +
  'collaborating with 6 CUDA/PyTorch engineers to cut pipeline latency by 42% and driving a 34% surge in active ' +
  'lab researcher adoption."';

const HARDCODED_KEYWORDS = [
  "GPU Acceleration & Inference",
  "Technical Product Management",
  "CUDA Ecosystem",
  "Data-Driven Roadmapping",
  "Developer Experience (DevEx)",
];

const HARDCODED_FOLLOW_UP =
  "I spotlighted your hands-on execution and technical empathy — critical for NVIDIA APM " +
  "interview loops. Would you like to emphasize your CUDA/AI infrastructure projects next, or " +
  "prep behavioral STAR talking points?";

const HARDCODED_SUGGESTIONS = [
  "Amplify NVIDIA AI platform sense",
  "Highlight technical CUDA specs",
  "Rebalance leadership vs engineering depth",
];

/* ── Component ── */

export default function AmeliaConversation(p: Props) {
  const [localInput, setLocalInput] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasUserSent, setHasUserSent] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [showResponse, isTyping]);

  function handleSend() {
    const msg = localInput.trim();
    if (!msg || isTyping) return;
    setUserMessage(msg);
    setLocalInput("");
    setHasUserSent(true);
    setIsTyping(true);
    // Simulate a brief "thinking" delay then show hardcoded response
    setTimeout(() => {
      setIsTyping(false);
      setShowResponse(true);
    }, 1800);
  }

  function handleSuggestion(text: string) {
    if (isTyping) return;
    setUserMessage(text);
    setLocalInput("");
    setHasUserSent(true);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setShowResponse(true);
    }, 1800);
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();

  return (
    <section className="amelia-conversation-view" aria-label="Chat with Amelia">
      {/* ── Target Role Banner ── */}
      <div className="conversation-target">
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 22, height: 22, borderRadius: 6, background: "#16a34a", color: "#fff",
          fontSize: 11, fontWeight: 700, marginRight: 8
        }}>▢</span>
        <div>
          <small style={{ fontSize: "0.6rem", letterSpacing: "0.08em", color: "#7c8ba5", fontWeight: 600 }}>TARGET ROLE:</small>
          <strong style={{ marginLeft: 8 }}>Associate Product Manager @ NVIDIA</strong>
        </div>
        <span style={{
          marginLeft: 12, display: "inline-flex", alignItems: "center", gap: 4,
          color: "#16a34a", fontWeight: 700, fontSize: "0.75rem"
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
          96% Match Calibration
        </span>
      </div>

      <div className="conversation-thread">
        <div className="conversation-messages" role="log" aria-label="Conversation" aria-live="polite">

          {/* ── If user hasn't sent anything yet, show empty state ── */}
          {!hasUserSent && (
            <div className="conversation-empty">
              <h1>Chat with Amelia</h1>
              <p>Tell Amelia what you want to highlight, improve, or tailor in your resume.</p>
            </div>
          )}

          {/* ── User Message ── */}
          {hasUserSent && (
            <article className="conversation-turn">
              <div className="conversation-user">
                <header className="conversation-feed-heading">
                  <strong>● CANDIDATE INPUT FEED</strong>
                  <small>4 documents staged</small>
                </header>

                {/* File grid */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
                  marginBottom: 14
                }}>
                  {HARDCODED_USER_FILES.map((f, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: "#fff", borderRadius: 8, padding: "8px 12px",
                      border: "1px solid #e5e7ed", fontSize: "0.72rem"
                    }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: 6,
                        background: f.isTargetJD ? "#eef2ff" : "#fef2f2",
                        color: f.isTargetJD ? "#6366f1" : "#ef4444",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, flexShrink: 0
                      }}>{f.isTargetJD ? "🔗" : "📄"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: "block", fontSize: "0.7rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</strong>
                        <small style={{ color: "#7c8ba5", fontSize: "0.6rem" }}>
                          {f.isTargetJD ? (
                            <span style={{ color: "#6366f1", fontWeight: 700 }}>TARGET JD</span>
                          ) : (
                            `${Math.round(f.size / 1024)} KB`
                          )}
                        </small>
                      </div>
                      <span style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: f.isTargetJD ? "#6366f1" : "#16a34a",
                        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, flexShrink: 0
                      }}>{f.isTargetJD ? "⊕" : "✓"}</span>
                    </div>
                  ))}
                </div>

                <p className="conversation-message-text">{userMessage}</p>
              </div>
            </article>
          )}

          {/* ── Amelia Response (hardcoded) ── */}
          {showResponse && (
            <article className="conversation-turn">
              <div className="conversation-agent-label">
                {p.logo}
                <span><i />SYNTHESIZING RESUME</span>
              </div>
              <div style={{ textAlign: "right", fontSize: "0.6rem", color: "#7c8ba5", margin: "2px 4px 6px", fontFamily: "monospace" }}>
                {timeStr} ✓✓
              </div>
              <div className="conversation-agent">
                <p className="conversation-message-text" style={{ lineHeight: 1.65, marginBottom: 16 }}>
                  {HARDCODED_AMELIA_TEXT}
                </p>

                {/* ── Resume Card ── */}
                <div className="conversation-resume-card">
                  <header>
                    <span>ML</span>
                    <div>
                      <strong>Maya Lin — Aspiring Product Manager</strong>
                      <small>B.S. CS & Design • UC Berkeley • 1-Page PDF Ready</small>
                    </div>
                    <b>NVIDIA ALIGNED</b>
                  </header>

                  {/* ── Impact Transformation ── */}
                  <div className="conversation-transformation">
                    <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      ✧ IMPACT TRANSFORMATION
                      <span style={{
                        marginLeft: "auto", background: "#16a34a", color: "#fff",
                        fontSize: "0.55rem", fontWeight: 700, padding: "2px 8px",
                        borderRadius: 4, letterSpacing: "0.05em"
                      }}>QUANTIFIED</span>
                    </h3>
                    <div className="conversation-comparison">
                      <div className="conversation-raw">
                        <h4 style={{ color: "#ef4444", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.04em" }}>RAW INPUT (INTERNSHIP DRAFT)</h4>
                        <p style={{ fontStyle: "italic", lineHeight: 1.55 }}>{HARDCODED_RAW_INPUT}</p>
                        <p style={{ fontSize: "0.6rem", color: "#ef4444", fontWeight: 600, marginTop: 6 }}>
                          → Unquantified • Low ATS Resonance
                        </p>
                      </div>
                      <div className="conversation-optimized">
                        <h4 style={{ color: "#16a34a", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.04em" }}>AMELIA SYNTHESIS (NVIDIA APM OPTIMIZED)</h4>
                        <p style={{ fontStyle: "italic", lineHeight: 1.55 }}>{HARDCODED_OPTIMIZED}</p>
                        <p style={{ fontSize: "0.6rem", color: "#16a34a", fontWeight: 600, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{
                            width: 16, height: 16, borderRadius: "50%", background: "#16a34a",
                            color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 700
                          }}>✓</span>
                          ATS Keyword Match: 98% • Full-stack metric density
                        </p>
                      </div>
                    </div>

                    {/* Keywords */}
                    <h4 style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.05em", marginTop: 14, marginBottom: 8, color: "#17283e" }}>
                      HIGH-WEIGHT KEYWORDS INJECTED:
                    </h4>
                    <div className="conversation-keywords">
                      {HARDCODED_KEYWORDS.map((kw) => (
                        <span key={kw}>{kw}</span>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="conversation-document-actions">
                    <button className="conversation-pdf" onClick={() => {}}>👁 Inspect Full 1-Page Resume (PDF)</button>
                    <button className="conversation-edit" onClick={() => {}}>☰ Fine-tune Sections with Amelia</button>
                  </div>
                </div>

                {/* ── Follow-up message ── */}
                <p className="conversation-message-text" style={{ lineHeight: 1.65, marginTop: 16 }}>
                  {HARDCODED_FOLLOW_UP}
                </p>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginTop: 8, fontSize: "0.6rem", fontFamily: "monospace"
                }}>
                  <span style={{ color: "#7c8ba5" }}>{timeStr} • READY FOR INPUT</span>
                  <span style={{ color: "#f59e0b", fontWeight: 600 }}>● Awaiting your steering</span>
                </div>
              </div>
            </article>
          )}

          {/* ── Typing indicator ── */}
          {isTyping && (
            <div className="conversation-typing" role="status">
              <span className="conversation-typing-dots" aria-hidden="true">•••</span> Amelia is synthesizing your resume…
            </div>
          )}
        </div>

        <div ref={bottomRef} />

        {/* ── Token capacity indicator ── */}
        {showResponse && (
          <div style={{
            position: "fixed", bottom: 100, left: 24,
            background: "#fff", border: "1px solid #e5e7ed", borderRadius: 10,
            padding: "10px 16px", fontSize: "0.7rem", color: "#17283e",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)", zIndex: 10, minWidth: 160
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: "0.6rem", letterSpacing: "0.04em" }}>AI TOKEN CAPACITY</span>
              <span style={{ fontWeight: 700, color: "#6366f1" }}>94%</span>
            </div>
            <div style={{ height: 4, background: "#e5e7ed", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "94%", height: "100%", background: "#6366f1", borderRadius: 2 }} />
            </div>
            <div style={{ marginTop: 4, fontSize: "0.58rem", color: "#7c8ba5" }}>Executive Copilot Active</div>
          </div>
        )}

        {/* ── Suggestion chips + Composer ── */}
        <div className="conversation-compose-area">
          <div className="conversation-prompts">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {HARDCODED_SUGGESTIONS.map((s) => (
                <button key={s} disabled={isTyping} onClick={() => handleSuggestion(s)}
                  style={{
                    background: "#fff", border: "1px solid #e0e3eb", borderRadius: 20,
                    padding: "6px 14px", fontSize: "0.7rem", color: "#374151",
                    cursor: isTyping ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6
                  }}>
                  <span style={{ width: 10, height: 10, background: "#25314a", borderRadius: 2, display: "inline-block" }} />
                  {s}
                </button>
              ))}
            </div>
          </div>
          <form className="conversation-composer" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <button type="button" aria-label="Add source documents" onClick={p.onBuild}>+</button>
            <input
              aria-label="Refinement message"
              placeholder="Ask Amelia to refine, rewrite, or adjust tone…"
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
            />
            <button
              type="button"
              aria-label="Voice input"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontSize: 18, color: "#7c8ba5", padding: "4px 6px"
              }}
            >🎤</button>
            <button type="submit" aria-label="Send refinement" disabled={isTyping || !localInput.trim()}
              style={{
                width: 34, height: 34, borderRadius: "50%",
                background: (!localInput.trim() || isTyping) ? "#e5e7ed" : "#6366f1",
                color: "#fff", border: "none", cursor: (!localInput.trim() || isTyping) ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700
              }}
            >↑</button>
          </form>
        </div>
      </div>
    </section>
  );
}
