"use client"

import { useState } from "react"
import {
  HelpCircle,
  MessageSquare,
  Phone,
  Mail,
  FileText,
  Search,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Paperclip,
  ExternalLink,
  Headphones,
  BookOpen,
  ShieldCheck,
  Wrench,
  CreditCard,
  Users,
  CalendarDays,
  UserRound,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { UserRole } from "@/lib/types"
import { naviiAvatar } from "@/lib/utils"

interface SupportPageProps {
  role: UserRole
}

const faqsByRole: Record<UserRole, { question: string; answer: string; category: string }[]> = {
  user: [
    { category: "Booking", question: "How do I book a artisan?", answer: "Navigate to 'Find Artisans' from the sidebar, browse available artisans by specialization, rating, or availability, then click 'Book Now' on any artisan card. Fill in the booking form with your service details, preferred date and time, and submit your request." },
    { category: "Booking", question: "Can I cancel or reschedule a booking?", answer: "Yes. Go to 'My Bookings', find the booking you want to modify, and click 'View Details'. From there you can cancel the booking using the 'Cancel Booking' button. To reschedule, cancel the current booking and create a new one with your preferred date." },
    { category: "Payment", question: "What payment methods are accepted?", answer: "We accept all major credit and debit cards, mobile money, and bank transfers. Payment is processed securely after the job is completed and you confirm satisfaction with the work." },
    { category: "Payment", question: "How do refunds work?", answer: "If a booking is cancelled before the artisan arrives, a full refund is issued within 3-5 business days. If the job was partially completed, a proportional refund will be calculated and processed." },
    { category: "Account", question: "How do I update my profile information?", answer: "Go to Settings from the sidebar, then update your name, email, phone number, and address in the Profile tab. Make sure to click 'Save Changes' to apply your updates." },
    { category: "Service", question: "What types of plumbing services are available?", answer: "We offer a wide range of services including emergency leak repair, pipe installation, water heater maintenance, bathroom fixture installation, pipe inspection, drain cleaning, and more. Browse all available services in the 'Services' section." },
    { category: "Service", question: "How are artisan ratings calculated?", answer: "Artisan ratings are based on an average of all client reviews. After each completed job, clients can leave a star rating (1-5) and a written review. The overall rating reflects the artisan's quality and reliability over time." },
    { category: "Safety", question: "Are the artisans verified?", answer: "Yes, all artisans on Plumbify undergo a thorough verification process including identity checks, license verification, insurance confirmation, and background checks before being approved on the platform." },
  ],
  artisan: [
    { category: "Jobs", question: "How do I accept or decline a job?", answer: "When a new job is assigned to you, it appears in your 'My Jobs' section with a 'Pending' status. Click the job card to view details, then use the 'Accept' or 'Decline' buttons. Accepting confirms your availability for the scheduled time." },
    { category: "Jobs", question: "How do I mark a job as completed?", answer: "Once you finish a job, go to 'My Jobs', find the active job, and click 'Mark Complete'. The client will be notified and prompted to confirm the completion and leave a review." },
    { category: "Profile", question: "How do I update my portfolio?", answer: "Navigate to your Profile page and select the 'Portfolio' tab. Use the 'Add to Portfolio' button to upload photos and videos of your completed work. You can add titles, descriptions, and categorize each item." },
    { category: "Profile", question: "How do I set my availability?", answer: "Go to Settings, then the 'Availability' tab. Set your weekly schedule with available hours for each day, toggle vacation mode when needed, and configure auto-accept preferences for incoming jobs." },
    { category: "Payment", question: "When do I receive payment for completed jobs?", answer: "Payments are processed within 2-3 business days after the client confirms job completion. You can view your earnings history and pending payments in the Report section." },
    { category: "Payment", question: "How are service fees calculated?", answer: "Plumbify charges a 10% platform fee on each completed job. The remaining 90% is deposited to your registered account. You can view a detailed breakdown in your earnings report." },
    { category: "Account", question: "How do I improve my rating?", answer: "Provide quality work, arrive on time, communicate clearly with clients, and maintain a clean work area. Positive reviews from satisfied clients will naturally improve your overall rating." },
    { category: "Support", question: "What if I have a dispute with a client?", answer: "If a dispute arises, contact our support team through the ticket system below. Provide the job details and your account of the situation. Our team will mediate and resolve the issue fairly within 48 hours." },
  ],
  admin: [
    { category: "Management", question: "How do I add or remove a artisan?", answer: "Go to the Artisans section and click 'Add Artisan' to register a new artisan. To remove a artisan, find their card, click the options menu, and select 'Remove'. The artisan will be notified of their account deactivation." },
    { category: "Management", question: "How do I manage products and inventory?", answer: "Navigate to Products in the sidebar. You can add new products, update stock levels, adjust pricing, and delete discontinued items. Low-stock and out-of-stock items are highlighted automatically." },
    { category: "Orders", question: "How do I handle order disputes?", answer: "Go to Orders, find the disputed order, and click 'View Details'. Review the client and artisan communication, then use the admin tools to resolve the dispute by issuing a refund, reassigning the job, or mediating between parties." },
    { category: "System", question: "How do I configure platform-wide settings?", answer: "Go to Admin Settings for system-wide controls including maintenance mode, new registration toggles, auto-assign settings, notification preferences, and security policies like 2FA and session timeouts." },
    { category: "Reports", question: "What analytics are available?", answer: "The Report section provides comprehensive analytics including revenue trends, order volume, artisan performance rankings, client retention rates, service category breakdowns, and downloadable CSV/PDF exports." },
    { category: "System", question: "How do I broadcast a system announcement?", answer: "Go to Admin Settings, then the Notifications tab. Use the 'System Announcements' section to compose and send platform-wide notifications to all users, artisans, or specific user groups." },
  ],
}

const previousTickets = [
  { id: "TKT-1024", subject: "Payment not received for completed job", status: "resolved" as const, date: "Feb 10, 2026", lastReply: "Support Agent" },
  { id: "TKT-1019", subject: "Unable to update availability schedule", status: "resolved" as const, date: "Jan 28, 2026", lastReply: "Support Agent" },
  { id: "TKT-1031", subject: "Client dispute on job #o3", status: "in-progress" as const, date: "Feb 18, 2026", lastReply: "You" },
]

const quickLinks = [
  { label: "Getting Started Guide", icon: BookOpen, href: "#" },
  { label: "Platform Policies", icon: ShieldCheck, href: "#" },
  { label: "Service Categories", icon: Wrench, href: "#" },
  { label: "Billing & Payments", icon: CreditCard, href: "#" },
  { label: "Account Management", icon: Users, href: "#" },
  { label: "Scheduling Help", icon: CalendarDays, href: "#" },
]

export function SupportPage({ role }: SupportPageProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [ticketSubject, setTicketSubject] = useState("")
  const [ticketCategory, setTicketCategory] = useState("")
  const [ticketMessage, setTicketMessage] = useState("")
  const [ticketPriority, setTicketPriority] = useState("")
  const [ticketSubmitted, setTicketSubmitted] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<(typeof previousTickets)[0] | null>(null)

  const faqs = faqsByRole[role]
  const categories = [...new Set(faqs.map((f) => f.category))]
  const [activeCategory, setActiveCategory] = useState("All")

  const filteredFaqs = faqs.filter((faq) => {
    const matchesSearch =
      searchQuery === "" ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === "All" || faq.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const handleSubmitTicket = () => {
    if (!ticketSubject || !ticketCategory || !ticketMessage) return
    setTicketSubmitted(true)
  }

  const resetTicketForm = () => {
    setTicketSubject("")
    setTicketCategory("")
    setTicketMessage("")
    setTicketPriority("")
    setTicketSubmitted(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
        <p className="text-sm text-muted-foreground">
          Find answers, submit tickets, or reach out to our support team.
        </p>
      </div>

      {/* Contact Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="group cursor-pointer border-border transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
              <Headphones className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Live Chat</p>
              <p className="text-xs text-muted-foreground">Avg. response: 2 min</p>
            </div>
            <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">Online</Badge>
          </CardContent>
        </Card>
        <Card className="group cursor-pointer border-border transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
              <Mail className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Email Support</p>
              <p className="text-xs text-muted-foreground">support@plumbify.com</p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="group cursor-pointer border-border transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
              <Phone className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Phone Support</p>
              <p className="text-xs text-muted-foreground">+1 (800) 555-PLUMB</p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="faq" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-muted w-max md:w-auto">
            <TabsTrigger value="faq" className="gap-1.5 text-xs">
              <HelpCircle className="h-3.5 w-3.5" />
              FAQ
            </TabsTrigger>
            <TabsTrigger value="ticket" className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Submit </span>Ticket
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">My </span>Tickets
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              Resources
            </TabsTrigger>
          </TabsList>
        </div>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search frequently asked questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button
                variant={activeCategory === "All" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory("All")}
                className={activeCategory === "All" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-transparent"}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(cat)}
                  className={activeCategory === cat ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-transparent"}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {filteredFaqs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <HelpCircle className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-foreground">No results found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different search term or submit a support ticket.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                  {filteredFaqs.map((faq, i) => (
                    <AccordionItem key={i} value={`faq-${i}`} className="border-border px-6">
                      <AccordionTrigger className="py-4 text-left text-sm font-medium hover:no-underline">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                            {faq.category}
                          </Badge>
                          {faq.question}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Submit Ticket Tab */}
        <TabsContent value="ticket">
          {ticketSubmitted ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Ticket Submitted Successfully</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Your support ticket has been created with ID{" "}
                  <span className="font-mono font-semibold text-foreground">TKT-{Math.floor(1000 + Math.random() * 9000)}</span>.
                  Our team will respond within 24 hours. You will receive an email notification when there is an update.
                </p>
                <div className="mt-6 flex gap-3">
                  <Button variant="outline" onClick={resetTicketForm} className="bg-transparent">
                    Submit Another Ticket
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New Support Ticket</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ticket-subject">Subject</Label>
                    <Input
                      id="ticket-subject"
                      placeholder="Brief description of your issue"
                      value={ticketSubject}
                      onChange={(e) => setTicketSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={ticketCategory} onValueChange={setTicketCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="billing">Billing & Payments</SelectItem>
                        <SelectItem value="booking">Booking Issues</SelectItem>
                        <SelectItem value="account">Account & Profile</SelectItem>
                        <SelectItem value="technical">Technical Problem</SelectItem>
                        <SelectItem value="dispute">Dispute Resolution</SelectItem>
                        <SelectItem value="feedback">Feedback & Suggestions</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={ticketPriority} onValueChange={setTicketPriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - General inquiry</SelectItem>
                      <SelectItem value="medium">Medium - Need help soon</SelectItem>
                      <SelectItem value="high">High - Urgent issue</SelectItem>
                      <SelectItem value="critical">Critical - Service down</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ticket-message">Describe your issue</Label>
                  <Textarea
                    id="ticket-message"
                    placeholder="Please provide as much detail as possible, including any error messages, order IDs, or steps to reproduce the issue..."
                    rows={6}
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Attachments (optional)</Label>
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4">
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Drag files here or click to browse</p>
                      <p className="text-xs text-muted-foreground">Supports PNG, JPG, PDF up to 10MB</p>
                    </div>
                    <Button variant="outline" size="sm" className="ml-auto bg-transparent">
                      Browse
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-border pt-5">
                  <Button variant="outline" onClick={resetTicketForm} className="bg-transparent">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitTicket}
                    disabled={!ticketSubject || !ticketCategory || !ticketMessage}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Submit Ticket
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Ticket History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {previousTickets.map((ticket) => (
                  <button
                    type="button"
                    key={ticket.id}
                    className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      {ticket.status === "resolved" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{ticket.id}</span>
                        <Badge
                          variant="secondary"
                          className={
                            ticket.status === "resolved"
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : "bg-muted text-primary hover:bg-muted"
                          }
                        >
                          {ticket.status === "resolved" ? "Resolved" : "In Progress"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        Last reply by {ticket.lastReply} &middot; {ticket.date}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ticket Detail Dialog */}
          <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span className="font-mono text-xs text-muted-foreground">{selectedTicket?.id}</span>
                  {selectedTicket?.subject}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className={
                      selectedTicket?.status === "resolved"
                        ? "bg-green-100 text-green-700 hover:bg-green-100"
                        : "bg-muted text-primary hover:bg-muted"
                    }
                  >
                    {selectedTicket?.status === "resolved" ? "Resolved" : "In Progress"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Opened {selectedTicket?.date}</span>
                </div>

                {/* Mock conversation thread */}
                <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg bg-muted/50 p-4">
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={naviiAvatar("current-user", 32)} />
                      <AvatarFallback><UserRound className="h-3 w-3" /></AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-medium text-foreground">You <span className="font-normal text-muted-foreground">&middot; {selectedTicket?.date}</span></p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        I am experiencing an issue with {selectedTicket?.subject?.toLowerCase()}. This has been happening since last week and I have tried clearing my cache and restarting the app but the problem persists.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={naviiAvatar("support-agent", 32)} />
                      <AvatarFallback><UserRound className="h-3 w-3" /></AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-medium text-foreground">Support Agent <span className="font-normal text-muted-foreground">&middot; {selectedTicket?.date}</span></p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Thank you for reaching out. I have looked into your account and identified the issue.
                        {selectedTicket?.status === "resolved"
                          ? " The problem has been resolved on our end. Please try again and let us know if the issue persists."
                          : " We are currently working on a fix and will update you shortly. Thank you for your patience."}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedTicket?.status !== "resolved" && (
                  <div className="flex gap-2">
                    <Input placeholder="Type a reply..." className="flex-1" />
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90" size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((link) => {
              const Icon = link.icon
              return (
                <Card key={link.label} className="group cursor-pointer border-border transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{link.label}</p>
                      <p className="text-xs text-muted-foreground">View documentation</p>
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Still need help?</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 py-4 text-center sm:flex-row sm:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted">
                <Headphones className="h-7 w-7 text-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Contact our support team directly</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Our dedicated support team is available Monday through Friday, 8:00 AM to 8:00 PM EST. Average response time is under 2 hours.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="bg-transparent">
                  <Phone className="mr-2 h-4 w-4" />
                  Call Us
                </Button>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Start Chat
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
