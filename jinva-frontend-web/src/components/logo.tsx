export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-[#1c4532]"
      >
        <rect width="32" height="32" rx="6" fill="currentColor" />
        <path
          d="M12 8C12 7.44772 12.4477 7 13 7C13.5523 7 14 7.44772 14 8V18C14 20.7614 16.2386 23 19 23C19.5523 23 20 23.4477 20 24C20 24.5523 19.5523 25 19 25C15.134 25 12 21.866 12 18V8Z"
          fill="white"
        />
        <circle cx="19" cy="9" r="2" fill="white" />
      </svg>
      <span className="text-2xl font-bold text-gray-400">JinVa</span>
    </div>
  )
}
