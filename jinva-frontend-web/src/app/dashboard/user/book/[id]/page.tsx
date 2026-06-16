"use client"

import React, { useState, useEffect } from "react"
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
import { ArrowLeft, Star, Calendar, Clock, MapPin, CreditCard, CheckCircle, Loader2 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import { mockArtisans } from "@/lib/data/mock-data"

interface BackendService {
  id: string
  name: string
  description?: string
  price?: number
}

export default function BookArtisanPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const artisan = mockArtisans.find((p) => p.id === id) || mockArtisans[0]

  const [services, setServices] = useState<BackendService[]>([])
  const [selectedService, setSelectedService] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [address, setAddress] = useState("")
  const [description, setDescription] = useState("")
  const [budgetMin, setBudgetMin] = useState("")
  const [budgetMax, setBudgetMax] = useState("")
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<BackendService[]>("/services")
      .then(setServices)
      .catch(() => setServices([]))
  }, [])

  const selectedServiceData = services.find((s) => s.id === selectedService)
  const isFormValid = selectedService && date && time && address && budgetMin && budgetMax

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    setIsSubmitting(true)
    try {
      const payload = {
        title: selectedServiceData?.name ?? "Service Request",
        description: `${description}\n\nPreferred date: ${date} at ${time}`,
        location: address,
        serviceId: selectedService,
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
      }
      const job = await apiFetch<{ id: string }>("/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      setCreatedJobId(job.id)
      setShowConfirmation(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create booking.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard/user/search">
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Book a Service</h1>
          <p className="text-muted-foreground">Fill in the details below to book {artisan.name}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <form onSubmit={handleSubmit}>
              <Card>
                <div className="border-b border-border p-5">
                  <h3 className="font-semibold text-foreground">Service Details</h3>
                </div>
                <CardContent className="space-y-5 p-5">
                  <div className="space-y-2">
                    <Label htmlFor="service">Service Type <span className="text-destructive">*</span></Label>
                    <Select value={selectedService} onValueChange={setSelectedService}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a service" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{service.name}</span>
                              {service.price != null && (
                                <span className="text-xs text-muted-foreground">${service.price}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="budgetMin">Min Budget ($) <span className="text-destructive">*</span></Label>
                      <Input
                        id="budgetMin"
                        type="number"
                        min="0"
                        placeholder="50"
                        value={budgetMin}
                        onChange={(e) => setBudgetMin(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budgetMax">Max Budget ($) <span className="text-destructive">*</span></Label>
                      <Input
                        id="budgetMax"
                        type="number"
                        min="0"
                        placeholder="200"
                        value={budgetMax}
                        onChange={(e) => setBudgetMax(e.target.value)}
                      />
                    </div>
                  </div>

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

                  <div className="space-y-2">
                    <Label htmlFor="description">Describe the Problem</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide details about the issue so the artisan can prepare..."
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
                  disabled={!isFormValid || isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm Booking
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="border-b border-border p-5">
                <h3 className="font-semibold text-foreground">Selected Artisan</h3>
              </div>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={artisan.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{artisan.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold text-foreground">{artisan.name}</h4>
                    <p className="text-sm text-muted-foreground">{artisan.specialization}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{artisan.avgRating}</span>
                      <span className="text-xs text-muted-foreground">({artisan.reviews} reviews)</span>
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`mt-4 w-full justify-center ${artisan.availability === "available" ? "border-green-200 bg-green-50 text-green-700" : "border-muted bg-muted text-muted-foreground"}`}
                >
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                  {artisan.availability === "available" ? "Available" : "Busy"}
                </Badge>
              </CardContent>
            </Card>

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
                      {selectedServiceData.price != null && (
                        <span className="font-medium text-foreground">${selectedServiceData.price}</span>
                      )}
                    </div>
                    {budgetMin && budgetMax && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Your budget</span>
                        <span className="font-medium text-foreground">${budgetMin} – ${budgetMax}</span>
                      </div>
                    )}
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

        <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="items-center text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <DialogTitle>Booking Submitted!</DialogTitle>
              <DialogDescription>
                Your job has been posted. Artisans will apply and you can accept one to confirm the booking.
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
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium text-foreground truncate max-w-[180px]">{address}</span>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => router.push(createdJobId ? `/dashboard/user/bookings/${createdJobId}` : "/dashboard/user/bookings")}
              >
                View My Bookings
              </Button>
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => { setShowConfirmation(false); router.push("/dashboard/user") }}
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
