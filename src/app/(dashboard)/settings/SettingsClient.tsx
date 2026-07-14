"use client";

import { useState } from "react";
import { User, Building2, Bell, Lock, Shield } from "lucide-react";

interface SettingsClientProps {
  user: { name: string | null; email: string };
  org: { name: string; slug: string; website: string | null; industry: string | null; timezone: string };
}

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
];

export default function SettingsClient({ user, org }: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState("profile");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm">Manage your account and organization preferences</p>
      </div>

      <div className="tab-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab flex items-center gap-2 ${activeTab === tab.id ? "active" : ""}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "profile" && (
        <div className="card p-6 max-w-lg">
          <h2 className="font-semibold text-gray-900 mb-5">Profile Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="form-label">Full Name</label>
              <input type="text" className="form-input" defaultValue={user.name || ""} />
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input type="email" className="form-input" defaultValue={user.email} />
            </div>
            <div>
              <label className="form-label">Profile Photo</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold text-white">
                    {(user.name || user.email)[0].toUpperCase()}
                  </span>
                </div>
                <button className="btn-secondary text-sm">Upload Photo</button>
              </div>
            </div>
            <button onClick={handleSave} className="btn-primary">
              {saved ? "✓ Saved!" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "organization" && (
        <div className="card p-6 max-w-lg">
          <h2 className="font-semibold text-gray-900 mb-5">Organization Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="form-label">Organization Name</label>
              <input type="text" className="form-input" defaultValue={org.name} />
            </div>
            <div>
              <label className="form-label">Slug (URL identifier)</label>
              <input type="text" className="form-input" defaultValue={org.slug} />
            </div>
            <div>
              <label className="form-label">Website</label>
              <input type="url" className="form-input" defaultValue={org.website || ""} placeholder="https://yourcompany.com" />
            </div>
            <div>
              <label className="form-label">Industry</label>
              <input type="text" className="form-input" defaultValue={org.industry || ""} placeholder="e.g. Marketing Agency" />
            </div>
            <div>
              <label className="form-label">Timezone</label>
              <select className="form-input" defaultValue={org.timezone}>
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
              </select>
            </div>
            <button onClick={handleSave} className="btn-primary">
              {saved ? "✓ Saved!" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="card p-6 max-w-lg">
          <h2 className="font-semibold text-gray-900 mb-5">Notification Preferences</h2>
          <div className="space-y-4">
            {[
              { label: "New lead found", desc: "Get notified when a search finds new leads", checked: true },
              { label: "Email campaign completed", desc: "When your email campaign finishes sending", checked: true },
              { label: "Lead status changed", desc: "When a lead's status is updated", checked: false },
              { label: "Campaign assigned to you", desc: "When a campaign is assigned to your account", checked: true },
              { label: "Weekly summary", desc: "Receive a weekly performance summary", checked: true },
            ].map((n) => (
              <label key={n.label} className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked={n.checked} className="rounded accent-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{n.label}</p>
                  <p className="text-xs text-gray-400">{n.desc}</p>
                </div>
              </label>
            ))}
            <button onClick={handleSave} className="btn-primary">
              {saved ? "✓ Saved!" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div className="card p-6 max-w-lg">
          <h2 className="font-semibold text-gray-900 mb-5">Security Settings</h2>
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Change Password</h3>
              <div className="space-y-3">
                <div>
                  <label className="form-label">Current Password</label>
                  <input type="password" className="form-input" placeholder="••••••••" />
                </div>
                <div>
                  <label className="form-label">New Password</label>
                  <input type="password" className="form-input" placeholder="Min 8 characters" />
                </div>
                <div>
                  <label className="form-label">Confirm New Password</label>
                  <input type="password" className="form-input" placeholder="••••••••" />
                </div>
                <button className="btn-primary">Update Password</button>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-5">
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                <Shield className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-700">Danger Zone</p>
                  <p className="text-xs text-red-500">Permanently delete your account and all data</p>
                </div>
                <button className="btn-danger text-sm">Delete Account</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
