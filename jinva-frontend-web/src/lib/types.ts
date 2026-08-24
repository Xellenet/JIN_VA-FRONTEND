export type UserRole = "admin" | "artisan" | "user"

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  address?: { id?: number; street?: string; city?: string; country?: string; zipCode?: string }
  nationalId?: string
  role: UserRole
  avatar?: string
  rating?: number
  specialization?: string
  jobsCompleted?: number
  reviews?: number
}

export interface Service {
  id: string
  name: string
  category: string
  description: string
  price: number
  status: "active" | "inactive"
}

export interface Order {
  id: string
  clientId: string
  clientName: string
  clientAvatar?: string
  artisanId: string
  artisanName: string
  serviceId: string
  serviceName: string
  orderDate: string
  deadline?: string
  status: "pending" | "in-progress" | "completed" | "cancelled" | "available"
  paymentStatus: "paid" | "pending" | "refunded"
}

export interface Activity {
  id: string
  clientId: string
  clientName: string
  clientAvatar?: string
  serviceName: string
  status: "in-progress" | "completed" | "cancelled" | "pending"
  time: string
}

export interface Review {
  id: string
  clientName: string
  clientAvatar?: string
  rating: number
  reviewCount: number
}

export interface ArtisanProfile extends User {
  avgRating: number
  jobsCompleted: number
  reviews: number
  availability: "available" | "busy"
}

export interface Client {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
  address: string
  totalOrders: number
  totalSpent: number
  status: "active" | "inactive"
  joinedDate: string
}

export type PortfolioStatus = "PENDING" | "APPROVED" | "REJECTED"

// Matches api-contract.md §8 `PortfolioItem` — the real, backend-backed
// portfolio record.
export interface ApiPortfolioItem {
  id: number
  artisanId: number
  fileUrl: string
  fileType: string
  caption: string | null
  tag: string | null
  status: PortfolioStatus
  rejectionReason: string | null
  sortOrder: number
  createdAt: string
}

// Matches api-contract.md §3 `ReviewResponseDto` — shape returned by every
// review read/write endpoint (POST /reviews, GET /reviews*, PATCH
// /reviews/:id, POST /reviews/:id/replies). Reviewer/artisan/job sub-objects
// are deliberately scoped DTOs, not the raw entities (see api-contract §0).
export type ReviewStatus = "ACTIVE" | "FLAGGED" | "REMOVED"

export interface ReviewPhoto {
  id: number
  url: string
  fileType: string
  createdAt: string
}

export interface ReviewUserSummary {
  id: number
  firstname: string
  lastname: string
  profilePicture?: string | null
}

export interface ReviewArtisanSummary {
  id: number
  businessName?: string | null
  averageRating: number
  totalReviews: number
  isVerified: boolean
}

export interface ReviewJobSummary {
  id: number
  title: string
  status: string
}

export interface ApiReview {
  id: number
  rating: number
  review: string | null
  reviewerName: string
  status: ReviewStatus
  verifiedBooking: boolean
  editedAt: string | null
  artisanReply: string | null
  artisanRepliedAt: string | null
  photos: ReviewPhoto[]
  reviewerUser?: ReviewUserSummary
  reviewedUser?: ReviewUserSummary
  artisanProfile?: ReviewArtisanSummary
  job?: ReviewJobSummary
  createdAt: string
  updatedAt: string
}

// AM2 — GET /admin/reviews adds `flags` (sourced from the moderation log,
// api-contract.md §12) on top of every ReviewResponseDto field.
export interface AdminApiReview extends ApiReview {
  flags: { reason: string; actorName: string; createdAt: string }[]
}

// AM5 — GET /admin/reviews/moderation-log, api-contract.md §9. No FKs by
// design: every field is a snapshot captured at the moment of the action.
export type ModerationAction = "FLAG" | "REMOVE" | "RESTORE"

export interface ReviewModerationLogEntry {
  id: number
  reviewId: number
  action: ModerationAction
  reason: string | null
  actorId: number
  actorName: string
  actorRole: string
  reviewerId: number
  reviewerName: string
  artisanProfileId: number
  artisanName: string
  rating: number
  reviewExcerpt: string
  createdAt: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: "booking" | "payment" | "system" | "review" | "assignment" | "message" | "dispute"
  isRead: boolean
  time: string
  link?: string
}

export interface ChatConversation {
  id: string
  participantId: string
  participantName: string
  participantAvatar?: string
  participantRole: UserRole
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  isOnline: boolean
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  content: string
  timestamp: string
  isRead: boolean
}
