import type React from "react"
import { Logo } from "@/components/logo"
import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AuthSplitLayoutProps {
  children: React.ReactNode
}

export function AuthSplitLayout({ children }: Readonly<AuthSplitLayoutProps>) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Form */}
      <div className="flex flex-col bg-white">
        <div className="p-8">
          <Logo />
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>

      {/* Right side - Marketing Content */}
      <div className="hidden lg:flex relative bg-gradient-to-br from-[#1c4532] to-[#2d5a42] p-12 items-center justify-center overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
              <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* Support Button */}
        <Button
          variant="ghost"
          className="absolute top-8 right-8 text-white/90 hover:text-white hover:bg-white/10 transition-all duration-300"
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Support
        </Button>

        {/* Main Content */}
        <div className="relative z-10 space-y-8 max-w-lg">
          {/* Feature Card */}
          <div className="bg-white rounded-2xl p-8 shadow-2xl space-y-6 transform transition-all duration-500 hover:scale-105 hover:shadow-3xl">
            <div className="transition-opacity duration-300">
              <h3 className="text-3xl font-bold text-gray-900 mb-3 transition-colors duration-300">
                Grow your beauty business
              </h3>
              <p className="text-gray-600 leading-relaxed transition-colors duration-300">
                Manage your salon, barber shop, or makeup studio with ease. Book appointments, track clients, and grow
                your beauty empire.
              </p>
            </div>

            <Button className="bg-[#1c4532] hover:bg-[#2d5a42] text-white px-8 transition-all duration-300 hover:scale-105">
              Learn more
            </Button>

            {/* Card Visual */}
            <div className="relative pt-2">
              <div className="absolute -top-4 right-0 w-64 h-40 bg-gradient-to-br from-[#2d5a42] to-[#1c4532] rounded-xl shadow-xl transform rotate-6 p-6 text-white transition-all duration-500 hover:rotate-3 hover:scale-105">
                <div className="text-sm opacity-80 mb-8">JinVa Pro</div>
                <div className="text-xl font-mono tracking-wider">7812 2139 0823 XXXX</div>
                <div className="mt-4 flex justify-between text-xs opacity-80">
                  <span>08/27</span>
                  <span>08●●</span>
                </div>
              </div>

              {/* Bookings Widget */}
              <div className="absolute -bottom-8 -right-4 bg-white rounded-xl shadow-lg p-4 w-48 transition-all duration-500 hover:scale-105 hover:shadow-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center transition-colors duration-300">
                    <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Monthly Bookings</div>
                    <div className="text-2xl font-bold text-gray-900">347</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="pt-12 space-y-4 transition-opacity duration-500">
            <h4 className="text-3xl font-bold text-white transition-all duration-300 hover:text-white/90">
              Empowering beauty professionals
            </h4>
            <p className="text-white/80 leading-relaxed transition-all duration-300 hover:text-white/90">
              From hair stylists to makeup artists, our platform helps you manage appointments, track inventory, handle
              payments, and build lasting client relationships.
            </p>

            {/* Pagination Dots */}
            <div className="flex items-center gap-3 pt-4">
              <button className="w-2 h-2 rounded-full bg-white/40 hover:bg-white/60 transition-all duration-300 hover:scale-125" />
              <button className="w-2 h-2 rounded-full bg-white hover:bg-white transition-all duration-300 hover:scale-125" />
              <button className="w-2 h-2 rounded-full bg-white/40 hover:bg-white/60 transition-all duration-300 hover:scale-125" />
            </div>
          </div>
        </div>

        {/* Decorative Gradient Orb */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-gradient-to-br from-[#2d5a42]/30 to-transparent rounded-full blur-3xl transition-opacity duration-700" />
      </div>
    </div>
  )
}
