import { Shield, Lock, Eye, Trash2, Mail, Globe } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Shield className="w-10 h-10 text-emerald-700 dark:text-emerald-400" />
          </div>
          <h1 className="text-4xl font-black text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-lg text-white/60">
            Last updated:{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "Asia/Riyadh",
            })}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Globe className="w-4 h-4 text-slate-400 dark:text-white/40" />
            <a
              href="https://quarters.sa"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/40 hover:text-emerald-400 transition-colors"
            >
              quarters.sa
            </a>
          </div>
        </div>

        {/* Introduction */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
          <p className="text-white/80 leading-relaxed">
            At Quarters, we respect your privacy and are committed to protecting
            your personal data. This Privacy Policy explains how we collect,
            use, and protect your information when you use our application.
          </p>
        </div>

        {/* Data Collection */}
        <Section
          icon={<Eye className="w-6 h-6 text-blue-700 dark:text-blue-400" />}
          title="Data We Collect"
        >
          <ul className="space-y-3 text-white/70">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>Employee information: Name, username, job role</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>Branch information associated with your account</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>Login token for secure authentication</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>Task and inventory data you enter in the app</span>
            </li>
          </ul>
        </Section>

        {/* Data Usage */}
        <Section
          icon={<Lock className="w-6 h-6 text-purple-700 dark:text-purple-400" />}
          title="How We Use Your Data"
        >
          <ul className="space-y-3 text-white/70">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>Login and secure authentication</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>Display and manage your tasks and inventory</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>
                Securely share employee ID and login token with the internal web
                interface to enable specific features
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>Improve app experience</span>
            </li>
          </ul>
        </Section>

        {/* Data Storage */}
        <Section
          icon={<Shield className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />}
          title="Data Storage"
        >
          <p className="text-white/70 leading-relaxed mb-4">
            Your data is securely stored on your device and on our protected
            servers. We use advanced encryption and security technologies to
            protect your information.
          </p>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-sm leading-relaxed">
              💡 Data is only shared with the internal parts of the app service
              (server and internal web interface) and will not be shared with
              any third parties. The internal web interface does not use any
              third-party tracking or advertising.
            </p>
          </div>
        </Section>

        {/* Data Sharing */}
        <Section
          icon={<Lock className="w-6 h-6 text-yellow-700 dark:text-yellow-400" />}
          title="Data Sharing"
        >
          <p className="text-white/70 leading-relaxed mb-4">
            We do not share your personal data with any third parties. Data is
            only shared with:
          </p>
          <ul className="space-y-3 text-white/70">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>
                Internal parts of the app service (server and internal web
                interface)
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>
                The internal web interface does not use any third-party tracking
                or advertising
              </span>
            </li>
          </ul>
        </Section>

        {/* User Rights */}
        <Section
          icon={<Trash2 className="w-6 h-6 text-red-700 dark:text-red-400" />}
          title="Your Rights"
        >
          <ul className="space-y-3 text-white/70">
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>Access your personal data at any time</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>Update or correct your information</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>
                Permanently delete your account and all your data through the
                app settings
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-emerald-400 mt-1">•</span>
              <span>Withdraw your consent to data processing at any time</span>
            </li>
          </ul>
        </Section>

        {/* Contact */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="flex items-center gap-4 mb-6">
            <Mail className="w-6 h-6 text-purple-700 dark:text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Contact Us</h2>
          </div>
          <p className="text-white/70 leading-relaxed mb-4">
            If you have any questions or inquiries about this Privacy Policy,
            you can contact us via:
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="mailto:Zalsaiari@quarters.sa"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 font-bold hover:bg-purple-500/20 transition-colors"
            >
              <Mail className="w-5 h-5" />
              <span>Zalsaiari@quarters.sa</span>
            </a>
            <a
              href="/support"
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 font-bold hover:bg-emerald-500/20 transition-colors"
            >
              <Globe className="w-5 h-5" />
              <span>Support Page</span>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center space-y-2">
          <p className="text-white/40 text-sm">
            We reserve the right to update this Privacy Policy at any time. You
            will be notified of any material changes.
          </p>
          <p className="text-white/30 text-xs">
            © {new Date().toLocaleDateString("en-US", { year: "numeric", timeZone: "Asia/Riyadh" })} Quarters · quarters.sa
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
      <div className="flex items-center gap-4 mb-6">
        {icon}
        <h2 className="text-2xl font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}
