import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-6">
        <div className="text-center mb-2">
          <div className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
            CodeLaunch
          </div>
          <p className="text-sm text-gray-400 mt-1">Create your account to get started</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-[#13151c] border border-white/10 shadow-2xl",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              socialButtonsBlockButton: "bg-panel-bg border border-white/10 text-white hover:bg-white/5",
              formFieldLabel: "text-gray-300",
              formFieldInput: "bg-[#0f1117] border-white/10 text-white focus:border-blue-500",
              formButtonPrimary: "bg-blue-600 hover:bg-blue-500",
              footerActionLink: "text-blue-400 hover:text-blue-300",
            },
          }}
        />
      </div>
    </div>
  );
}
