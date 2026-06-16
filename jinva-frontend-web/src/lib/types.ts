export type UserRole = "admin" | "artisan" | "user"

export interface User {
  id: string
  name: string
  email: string
  phone?: string
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

export interface Product {
  id: string
  name: string
  category: string
  description: string
  price: number
  stock: number
  sku: string
  status: "in-stock" | "low-stock" | "out-of-stock"
  image?: string
}

export interface PortfolioItem {
  id: string
  title: string
  description: string
  category: string
  image: string
  date: string
  type: "image" | "video"
  videoUrl?: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: "booking" | "payment" | "system" | "review" | "assignment" | "message"
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
