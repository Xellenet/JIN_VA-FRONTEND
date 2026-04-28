"use client"

import React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ArrowLeft, Star, Calendar, Clock, MapPin, CreditCard, CheckCircle } from "lucide-react"
import { mockPlumbers, mockServices } from "@/lib/data/mock-data"

export default function BookPlumberPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const user = {
    id: "u1",
    name: "Sarah Williams",
    email: "sarah@example.com",
    role: "user" as const,
    avatar: "/placeholder.svg?height=40&width=40",
  }

  const plumber = mockPlumbers.find((p) => p.id === id) || mockPlumbers[0]
  const activeServices = mockServices.filter((s) => s.status === "active")

  const [selectedService, setSelectedService] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [address, setAddress] = useState("")
  const [description, setDescription] = useState("")
  const [urgency, setUrgency] = useState("")
  const [showConfirmation, setShowConfirmation] = useState(false)

  const selectedServiceData = activeServices.find((s) => s.id === selectedService)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowConfirmation(true)
  }

  const isFormValid = selectedService && date && time && address

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Back button */}
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/user/search">
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Book a Service</h1>
          <p className="text-muted-foreground">Fill in the details below to book {plumber.name}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Booking Form */}
          <div className="space-y-6 lg:col-span-2">
            <form onSubmit={handleSubmit}>
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="font-semibold text-foreground">Service Details</h3>
                </div>
                <CardContent className="space-y-5 p-5">
                  {/* Service selection */}
                  <div className="space-y-2">
                    <Label htmlFor="service">Service Type <span className="text-destructive">*</span></Label>
                    <Select value={selectedService} onValueChange={setSelectedService}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a service" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeServices.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{service.name}</span>
                              <span className="text-xs text-muted-foreground">${service.price}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Urgency */}
                  <div className="space-y-2">
                    <Label htmlFor="urgency">Urgency Level</Label>
                    <Select value={urgency} onValueChange={setUrgency}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select urgency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low - Can wait a few days</SelectItem>
                        <SelectItem value="medium">Medium - Within 24 hours</SelectItem>
                        <SelectItem value="high">High - As soon as possible</SelectItem>
                        <SelectItem value="emergency">Emergency - Right now</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date and Time */}
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="date">Preferred Date <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="date"
                          type="date"
                          className="pl-10"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Preferred Time <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="time"
                          type="time"
                          className="pl-10"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <Label htmlFor="address">Service Address <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea
                        id="address"
                        className="pl-10"
                        placeholder="Enter the full address where the service is needed"
                        rows={2}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Problem description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Describe the Problem</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide details about the issue so the plumber can prepare..."
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" asChild className="flex-1 md:flex-none bg-transparent">
                  <Link href="/dashboard/user/search">Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 md:flex-none md:px-8"
                  disabled={!isFormValid}
                >
                  Confirm Booking
                </Button>
              </div>
            </form>
          </div>

          {/* Sidebar - Plumber card & Price summary */}
          <div className="space-y-6">
            {/* Plumber Card */}
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="font-semibold text-foreground">Selected Plumber</h3>
              </div>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={plumber.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{plumber.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold text-foreground">{plumber.name}</h4>
                    <p className="text-sm text-muted-foreground">{plumber.specialization}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{plumber.avgRating}</span>
                      <span className="text-xs text-muted-foreground">({plumber.reviews} reviews)</span>
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`mt-4 w-full justify-center ${plumber.availability === "available" ? "border-green-200 bg-green-50 text-green-700" : "border-muted bg-muted text-muted-foreground"}`}
                >
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                  {plumber.availability === "available" ? "Available" : "Busy"}
                </Badge>
              </CardContent>
            </Card>

            {/* Price Summary */}
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <CreditCard className="h-4 w-4" />
                  Price Summary
                </h3>
              </div>
              <CardContent className="p-5">
                {selectedServiceData ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{selectedServiceData.name}</span>
                      <span className="font-medium text-foreground">${selectedServiceData.price}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Service fee</span>
                      <span className="font-medium text-foreground">$10</span>
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Total</span>
                        <span className="text-lg font-bold text-primary">
                          ${selectedServiceData.price + 10}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    Select a service to see pricing
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Success Dialog */}
        <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="items-center text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <DialogTitle>Booking Confirmed!</DialogTitle>
              <DialogDescription>
                Your booking with {plumber.name} has been submitted successfully. You will receive a confirmation shortly.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="space-y-2 text-sm">
                {selectedServiceData && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium text-foreground">{selectedServiceData.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium text-foreground">{date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium text-foreground">{time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plumber</span>
                  <span className="font-medium text-foreground">{plumber.name}</span>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => router.push("/dashboard/user/bookings")}
              >
                View My Bookings
              </Button>
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => {
                  setShowConfirmation(false)
                  router.push("/dashboard/user")
                }}
              >
                Back to Dashboard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
