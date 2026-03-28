import ayratechLogo from "@/assets/ayratech_logo.jpg";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-purple-600/10 blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full bg-orange-500/8 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/3 right-1/3 w-[300px] h-[300px] rounded-full bg-violet-500/8 blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        <img
          src={ayratechLogo}
          alt="AyraTech Logo"
          className="w-[320px] md:w-[480px] lg:w-[560px] object-contain drop-shadow-[0_0_40px_rgba(168,85,247,0.4)]"
        />
        <p className="text-gray-500 text-sm tracking-[0.3em] uppercase">
          Tecnologia &amp; Inovação
        </p>
      </div>
    </div>
  );
}
