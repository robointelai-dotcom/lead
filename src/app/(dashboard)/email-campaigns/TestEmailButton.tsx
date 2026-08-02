"use client";

import { useState } from "react";
import { Mail, CheckCircle } from "lucide-react";
import { sendTestEmailAction } from "./actions";

export default function TestEmailButton({ id }: { id: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSendTest = async () => {
    if (!email) return;
    setIsSending(true);
    setError("");
    setSuccess(false);
    
    const res = await sendTestEmailAction(id, email);
    
    if (res.success) {
      setSuccess(true);
      setTimeout(() => setIsOpen(false), 2000);
    } else {
      setError(res.error || "Failed to send test email");
    }
    setIsSending(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="btn-secondary text-sm"
      >
        <Mail className="w-4 h-4" />
        Send Test
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input 
        type="email" 
        placeholder="Enter email..." 
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="form-input text-sm py-1.5 w-48"
        autoFocus
      />
      <button 
        onClick={handleSendTest}
        disabled={isSending || !email}
        className="btn-primary text-sm py-1.5"
      >
        {isSending ? "Sending..." : "Send"}
      </button>
      <button 
        onClick={() => { setIsOpen(false); setSuccess(false); setError(""); }}
        className="btn-ghost text-sm py-1.5 px-2 text-gray-500"
      >
        Cancel
      </button>
      {success && <span className="text-emerald-600 flex items-center gap-1 text-sm"><CheckCircle className="w-4 h-4"/> Sent!</span>}
      {error && <span className="text-red-500 text-sm max-w-sm whitespace-normal" title={error}>{error}</span>}
    </div>
  );
}
