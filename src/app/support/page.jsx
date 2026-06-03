import {
  Mail,
  Shield,
  FileText,
  HelpCircle,
  ExternalLink,
  Globe,
} from "lucide-react";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <HelpCircle className="w-10 h-10 text-emerald-700 dark:text-emerald-400" />
          </div>
          <h1 className="text-4xl font-black text-white mb-4">
            Help & Support
          </h1>
          <p className="text-lg text-white/60">
            We're here to help you with any questions or issues
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

        {/* Contact Information */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Mail className="w-6 h-6 text-purple-700 dark:text-purple-400" />
            <h2 className="text-2xl font-bold text-white">Contact Us</h2>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-white/60 text-sm mb-2">Email</p>
              <a
                href="mailto:Zalsaiari@quarters.sa"
                className="text-xl font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Zalsaiari@quarters.sa
              </a>
            </div>
            <div>
              <p className="text-white/60 text-sm mb-2">Website</p>
              <a
                href="https://quarters.sa"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-2"
              >
                quarters.sa
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-white/70 leading-relaxed">
              You can reach out to us via email for any inquiries or technical
              issues. We will respond as soon as possible.
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <HelpCircle className="w-6 h-6 text-blue-700 dark:text-blue-400" />
            <h2 className="text-2xl font-bold text-white">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-6">
            <FAQItem
              question="How can I reset my password?"
              answer="You can contact your company administrator to reset your password."
            />
            <FAQItem
              question="How can I delete my account?"
              answer="You can delete your account through the app settings. Go to Settings > Danger Zone > Delete Account Permanently. Please note that this action cannot be undone."
            />
            <FAQItem
              question="Is my data secure?"
              answer="Yes, we take your privacy and data security very seriously. All data is stored securely and we do not share it with any third parties. For more information, please see our Privacy Policy."
            />
            <FAQItem
              question="How is my data used?"
              answer="We use your data only to provide app services such as task management and inventory management. We do not use any third-party tracking or advertising."
            />
            <FAQItem
              question="How can I download the app?"
              answer="You can download the app from the Apple App Store. Search for the app name in the store and download it for free."
            />
          </div>
        </div>

        {/* Privacy Policy Link */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="flex items-center gap-4 mb-4">
            <Shield className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-2xl font-bold text-white">
              Privacy & Security
            </h2>
          </div>
          <p className="text-white/70 mb-6 leading-relaxed">
            We are committed to protecting your privacy and data security. For
            more information about how we collect and use your data, please read
            our Privacy Policy.
          </p>
          <a
            href="/privacy-policy"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 font-bold hover:bg-emerald-500/20 transition-colors"
          >
            <FileText className="w-5 h-5" />
            <span>Read Privacy Policy</span>
          </a>
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center space-y-2">
          <p className="text-white/40 text-sm">
            We are always striving to improve our services. Thank you for using
            our app.
          </p>
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Quarters · quarters.sa
          </p>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }) {
  return (
    <div className="border-b border-white/10 pb-6 last:border-0 last:pb-0">
      <h3 className="text-lg font-bold text-white mb-3">{question}</h3>
      <p className="text-white/70 leading-relaxed">{answer}</p>
    </div>
  );
}
